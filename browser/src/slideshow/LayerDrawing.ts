/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * LayerDrawing is handling the slideShow action
 */

declare var app: any;
declare var SlideShow: any;
declare var ThisIsTheAndroidApp: any;
declare var ThisIsTheiOSApp: any;

type LayerContentType =
	| ImageInfo
	| PlaceholderInfo
	| AnimatedShapeInfo
	| TextFieldInfo;

type TextFieldsType = 'SlideNumber' | 'Footer' | 'DateTime';

type TextFields = {
	SlideNumber: string;
	DateTime: string;
	Footer: string;
};

interface TextFieldInfo {
	type: TextFieldsType;
	content: ImageInfo;
}

interface ImageInfo {
	type: 'png' | 'zstd';
	checksum: string;
	data?: any;
}

interface AnimatedShapeInfo {
	hash: string;
	initVisible: boolean;
	type: 'bitmap' | 'svg';
	content: ImageInfo | SVGElement;
}

interface PlaceholderInfo {
	type: TextFieldsType;
}

interface LayerInfo {
	group: 'Background' | 'MasterPage' | 'DrawPage' | 'TextFields';
	slideHash: string;
	index?: number;
	type?: 'bitmap' | 'placeholder' | 'animated';
	content: LayerContentType;
}

interface LayerEntry {
	type: 'bitmap' | 'placeholder' | 'animated';
	content: LayerContentType;
}

class LayerDrawing {
	private map: any = null;
	private helper: LayersCompositor;

	private renderedSlides: Map<string, ImageBitmap> = new Map();
	private requestedSlideHash: string = null;
	private prefetchedSlideHash: string = null;
	private resolutionWidth: number = 960;
	private resolutionHeight: number = 540;
	private canvasWidth: number = 0;
	private canvasHeight: number = 0;
	private backgroundChecksums: Map<string, string> = new Map();
	private cachedBackgrounds: Map<string, ImageInfo> = new Map();
	private cachedMasterPages: Map<string, Array<LayerEntry>> = new Map();
	private cachedDrawPages: Map<string, Array<LayerEntry>> = new Map();
	private cachedTextFields: Map<string, TextFieldInfo> = new Map();
	private slideTextFieldsMap: Map<string, Map<TextFieldsType, string>> =
		new Map();
	private offscreenCanvas: OffscreenCanvas = null;
	private offscreenContext: OffscreenCanvasRenderingContext2D = null;
	private currentCanvas: OffscreenCanvas = null;
	private currentCanvasContext: ImageBitmapRenderingContext = null;
	private onSlideRenderingCompleteCallback: VoidFunction = null;

	constructor(
		mapObj: any,
		helper: LayersCompositor
	) {
		this.map = mapObj;
		this.helper = helper;

		this.currentCanvas = new OffscreenCanvas(
			this.canvasWidth,
			this.canvasHeight,
		);
		if (!this.currentCanvas) {
			window.app.console.log(
				'LayerDrawing: no canvas element found',
			);
			return;
		}

		this.currentCanvasContext = this.currentCanvas.getContext('bitmaprenderer');
		if (!this.currentCanvasContext) {
			window.app.console.log(
				'LayerDrawing: can not get a valid context for current canvas',
			);
			return;
		}
	}

	addHooks() {
		this.map.on('slidelayer', this.onSlideLayerMsg, this);
		this.map.on('sliderenderingcomplete', this.onSlideRenderingComplete, this);
	}

	removeHooks() {
		this.map.off('slidelayer', this.onSlideLayerMsg, this);
		this.map.off('sliderenderingcomplete', this.onSlideRenderingComplete, this);
	}

	private getSlideInfo(slideHash: string) {
		return this.helper.getSlideInfo(slideHash);
	}

	public getSlide(slideNumber: number): ImageBitmap {
		const startSlideHash = this.helper.getSlideHash(slideNumber);
		return this.renderedSlides.get(startSlideHash);
	}

	public requestSlide(slideNumber: number, callback: VoidFunction) {
		this.onSlideRenderingCompleteCallback = callback;
		this.computeInitialResolution();
		this.initializeCanvas();

		const startSlideHash = this.helper.getSlideHash(slideNumber);
		this.requestSlideImpl(startSlideHash);
	}

	private initializeCanvas() {
		this.computeCanvasSize(this.resolutionWidth, this.resolutionHeight);
		this.createRenderingCanvas();
	}

	private createRenderingCanvas() {
		this.offscreenCanvas = new OffscreenCanvas(
			this.canvasWidth,
			this.canvasHeight,
		);
		this.offscreenContext = this.offscreenCanvas.getContext('2d');
	}

	private requestSlideImpl(slideHash: string, prefetch: boolean = false) {
		const slideInfo = this.getSlideInfo(slideHash);
		if (!slideInfo) {
			window.app.console.log(
				'LayerDrawing.requestSlideImpl: No info for requested slide: hash: ' +
					slideHash,
			);
			return;
		}
		if (
			slideHash === this.requestedSlideHash ||
			slideHash === this.prefetchedSlideHash
		)
			return;

		// TODO: queue
		if (this.requestedSlideHash || this.prefetchedSlideHash) {
			setTimeout(this.requestSlideImpl.bind(this), 500, slideHash, prefetch);
		}

		if (prefetch) {
			this.prefetchedSlideHash = slideHash;
		} else {
			this.requestedSlideHash = slideHash;
		}

		const backgroundRendered = this.drawBackground(slideHash);
		const masterPageRendered = this.drawMasterPage(slideHash);
		if (backgroundRendered && masterPageRendered) {
			if (this.drawDrawPage(slideHash)) {
				this.onSlideRenderingComplete();
				return;
			}
		}

		app.socket.sendMessage(
			`getslide part=${slideInfo.index} width=${this.canvasWidth} height=${this.canvasHeight} ` +
				`renderBackground=${backgroundRendered ? 0 : 1} renderMasterPage=${masterPageRendered ? 0 : 1}`,
		);
	}

	onSlideLayerMsg(e: any) {
		const info = e.message;
		if (!info) {
			window.app.console.log(
				'LayerDrawing.onSlideLayerMsg: no json data available.',
			);
			return;
		}
		if (!this.getSlideInfo(info.slideHash)) {
			window.app.console.log(
				'LayerDrawing.onSlideLayerMsg: no slide info available for ' +
					info.slideHash +
					'.',
			);
			return;
		}
		if (!info.content) {
			window.app.console.log(
				'LayerDrawing.onSlideLayerMsg: no layer content available.',
			);
			return;
		}

		switch (info.group) {
			case 'Background':
				this.handleBackgroundMsg(info, e.image);
				break;
			case 'MasterPage':
				this.handleMasterPageLayerMsg(info, e.image);
				break;
			case 'DrawPage':
				this.handleDrawPageLayerMsg(info, e.image);
				break;
			case 'TextFields':
				this.handleTextFieldMsg(info, e.image);
		}
	}

	handleTextFieldMsg(info: LayerInfo, img: any) {
		const textFieldInfo = info.content as TextFieldInfo;
		const imageInfo = textFieldInfo.content;
		if (!this.checkAndAttachImageData(imageInfo, img)) return;

		let textFields = this.slideTextFieldsMap.get(info.slideHash);
		if (!textFields) {
			textFields = new Map<TextFieldsType, string>();
			this.slideTextFieldsMap.set(info.slideHash, textFields);
		}
		textFields.set(textFieldInfo.type, imageInfo.checksum);

		this.cachedTextFields.set(imageInfo.checksum, textFieldInfo);
	}

	private handleBackgroundMsg(info: LayerInfo, img: any) {
		const slideInfo = this.getSlideInfo(info.slideHash);
		if (!slideInfo.background) {
			return;
		}
		if (info.type === 'bitmap') {
			const imageInfo = info.content as ImageInfo;
			if (!this.checkAndAttachImageData(imageInfo, img)) return;

			const pageHash = slideInfo.background.isCustom
				? info.slideHash
				: slideInfo.masterPage;
			this.backgroundChecksums.set(pageHash, imageInfo.checksum);
			this.cachedBackgrounds.set(imageInfo.checksum, imageInfo);

			if (info.slideHash === this.requestedSlideHash) {
				this.clearCanvas();
				this.drawBitmap(imageInfo);
			}
		}
	}

	private handleMasterPageLayerMsg(info: LayerInfo, img: any) {
		const slideInfo = this.getSlideInfo(info.slideHash);
		if (!slideInfo.masterPageObjectsVisibility) {
			return;
		}
		if (info.index === 0) {
			this.cachedMasterPages.set(slideInfo.masterPage, new Array<LayerEntry>());
		}
		const layers = this.cachedMasterPages.get(slideInfo.masterPage);
		if (layers.length !== info.index) {
			window.app.console.log(
				'LayerDrawing.handleMasterPageLayerMsg: missed any layers ?',
			);
		}
		const layerEntry: LayerEntry = {
			type: info.type,
			content: info.content,
		};
		if (info.type === 'bitmap') {
			if (!this.checkAndAttachImageData(layerEntry.content as ImageInfo, img))
				return;
		}
		layers.push(layerEntry);

		if (info.slideHash === this.requestedSlideHash) {
			this.drawMasterPageLayer(layerEntry, info.slideHash);
		}
	}

	private handleDrawPageLayerMsg(info: LayerInfo, img: any) {
		if (info.index === 0) {
			this.cachedDrawPages.set(info.slideHash, new Array<LayerEntry>());
		}
		const layers = this.cachedDrawPages.get(info.slideHash);
		if (layers.length !== info.index) {
			window.app.console.log(
				'LayerDrawing.handleDrawPageLayerMsg: missed any layers ?',
			);
		}
		const layerEntry: LayerEntry = {
			type: info.type,
			content: info.content,
		};
		if (info.type === 'bitmap') {
			if (!this.checkAndAttachImageData(layerEntry.content as ImageInfo, img))
				return;
		} else if (info.type === 'animated') {
			const content = layerEntry.content as AnimatedShapeInfo;
			if (content.type === 'bitmap') {
				if (!this.checkAndAttachImageData(content.content as ImageInfo, img))
					return;
			}
		}
		layers.push(layerEntry);

		if (info.slideHash === this.requestedSlideHash) {
			this.drawDrawPageLayer(layerEntry);
		}
	}

	private clearCanvas() {
		this.offscreenContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
	}

	private drawBackground(slideHash: string) {
		this.clearCanvas();
		const slideInfo = this.getSlideInfo(slideHash);
		if (!slideInfo.background) return true;

		if (slideInfo.background.fillColor) {
			this.offscreenContext.fillStyle = '#' + slideInfo.background.fillColor;
			window.app.console.log(
				'LayerDrawing.drawBackground: ' + this.offscreenContext.fillStyle,
			);
			this.offscreenContext.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
			return true;
		}

		const pageHash = slideInfo.background.isCustom
			? slideHash
			: slideInfo.masterPage;
		const checksum = this.backgroundChecksums.get(pageHash);
		if (!checksum) return false;

		const imageInfo = this.cachedBackgrounds.get(checksum);
		if (!imageInfo) {
			window.app.console.log(
				'LayerDrawing: no cached background for slide: ' + slideHash,
			);
			return false;
		}

		this.drawBitmap(imageInfo);
		return true;
	}

	private drawMasterPage(slideHash: string) {
		const slideInfo = this.getSlideInfo(slideHash);
		if (!slideInfo.masterPageObjectsVisibility) return true;

		const layers = this.cachedMasterPages.get(slideInfo.masterPage);
		if (!layers || layers.length === 0) {
			window.app.console.log(
				'LayerDrawing: No layer cached for master page: ' +
					slideInfo.masterPage,
			);
			return false;
		}

		for (const layer of layers) {
			this.drawMasterPageLayer(layer, slideHash);
		}
		return true;
	}

	private drawMasterPageLayer(layer: LayerEntry, slideHash: string) {
		if (layer.type === 'bitmap') {
			this.drawBitmap(layer.content as ImageInfo);
		} else if (layer.type === 'placeholder') {
			const placeholder = layer.content as PlaceholderInfo;
			const slideTextFields = this.slideTextFieldsMap.get(slideHash);
			const checksum = slideTextFields
				? slideTextFields.get(placeholder.type)
				: null;
			if (!checksum) {
				window.app.console.log(
					'LayerDrawing: No content found for text field placeholder, type: ' +
						placeholder.type,
				);
				return;
			}
			const imageInfo = this.cachedTextFields.get(checksum).content;
			this.drawBitmap(imageInfo);
		}
	}

	private drawDrawPage(slideHash: string) {
		const slideInfo = this.getSlideInfo(slideHash);
		if (slideInfo.empty) {
			return true;
		}

		const layers = this.cachedDrawPages.get(slideHash);
		if (!layers || layers.length === 0) {
			window.app.console.log(
				'LayerDrawing: No layer cached for draw page: ' + slideHash,
			);
			return false;
		}

		for (const layer of layers) {
			this.drawDrawPageLayer(layer);
		}
		return true;
	}

	private drawDrawPageLayer(layer: LayerEntry) {
		if (layer.type === 'bitmap') {
			this.drawBitmap(layer.content as ImageInfo);
		} else if (layer.type === 'animated') {
			const content = layer.content as AnimatedShapeInfo;
			if (content.initVisible) {
				if (content.type === 'bitmap') {
					const imageInfo = content.content as ImageInfo;
					this.drawBitmap(imageInfo);
				}
			}
		}
	}

	private drawBitmap(imageInfo: ImageInfo) {
		if (!imageInfo) {
			window.app.console.log('LayerDrawing.drawBitmap: no image');
			return;
		}
		if (imageInfo.type === 'png') {
			this.offscreenContext.drawImage(imageInfo.data as HTMLImageElement, 0, 0);
		}
	}

	onSlideRenderingComplete() {
		if (!this.offscreenCanvas) {
			window.app.console.log(
				'LayerDrawing.onSlideRenderingComplete: no offscreen canvas available.',
			);
			return;
		}

		const renderedSlide = this.offscreenCanvas.transferToImageBitmap();
		this.renderedSlides.set(this.requestedSlideHash, renderedSlide);

		if (this.requestedSlideHash)
			this.requestedSlideHash = null;

		const oldCallback = this.onSlideRenderingCompleteCallback;
		this.onSlideRenderingCompleteCallback = null;
		oldCallback.call(this.helper);
	}

	private checkAndAttachImageData(imageInfo: ImageInfo, img: any): boolean {
		if (!img || (imageInfo.type === 'png' && !img.src)) {
			window.app.console.log(
				'LayerDrawing.checkAndAttachImageData: no bitmap available.',
			);
			return false;
		}
		imageInfo.data = img;
		return true;
	}

	private computeInitialResolution() {
		const viewWidth = window.screen.width;
		const viewHeight = window.screen.height;
		this.computeResolution(viewWidth, viewHeight);
	}

	private computeResolution(viewWidth: number, viewHeight: number) {
		[this.resolutionWidth, this.resolutionHeight] =
			this.helper.computeLayerResolution(viewWidth, viewHeight);
	}

	private computeCanvasSize(resWidth: number, resHeight: number) {
		[this.canvasWidth, this.canvasHeight] = this.helper.computeLayerSize(
			resWidth,
			resHeight,
		);
	}
}

SlideShow.LayerDrawing = LayerDrawing;
