/* -*- js-indent-level: 8 -*- */

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
	bounds: BoundingBoxType;
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
	isField?: boolean;
}

interface LayerEntry {
	type: 'bitmap' | 'placeholder' | 'animated';
	content: LayerContentType;
	isField?: boolean;
}

class LayerDrawing {
	private map: any = null;
	private helper: LayersCompositor;

	private slideCache: SlideCache = new SlideCache();
	private requestedSlideHash: string = null;
	private prefetchedSlideHash: string = null;
	private nextRequestedSlideHash: string = null;
	private nextPrefetchedSlideHash: string = null;
	private slideRequestTimeout: any = null;
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
	private onSlideRenderingCompleteCallback: VoidFunction = null;
	private layerRenderer: LayerRenderer;

	constructor(mapObj: any, helper: LayersCompositor) {
		this.map = mapObj;
		this.helper = helper;
	}

	addHooks() {
		this.map.on('slidelayer', this.onSlideLayerMsg, this);
		this.map.on('sliderenderingcomplete', this.onSlideRenderingComplete, this);
	}

	removeHooks() {
		this.map.off('slidelayer', this.onSlideLayerMsg, this);
		this.map.off('sliderenderingcomplete', this.onSlideRenderingComplete, this);
	}

	private getSlideInfo(slideHash: string): SlideInfo {
		return this.helper.getSlideInfo(slideHash);
	}

	public getSlide(slideNumber: number): ImageBitmap {
		const startSlideHash = this.helper.getSlideHash(slideNumber);
		return this.slideCache.get(startSlideHash);
	}

	public getLayerBounds(
		slideHash: string,
		targetElement: string,
	): BoundingBoxType {
		const layers = this.cachedDrawPages.get(slideHash);
		if (!layers) return null;
		for (const i in layers) {
			const animatedInfo = layers[i].content as AnimatedShapeInfo;
			if (
				animatedInfo &&
				animatedInfo.hash === targetElement &&
				animatedInfo.content
			)
				return animatedInfo.bounds;
		}
		return null;
	}

	public getAnimatedSlide(slideIndex: number): ImageBitmap {
		console.debug('LayerDrawing.getAnimatedSlide: slide index: ' + slideIndex);
		const slideHash = this.helper.getSlideHash(slideIndex);
		this.composeLayers(slideHash);
		return this.offscreenCanvas.transferToImageBitmap();
	}

	public composeLayers(slideHash: string): void {
		this.drawBackground(slideHash);
		this.drawMasterPage(slideHash);
		this.drawDrawPage(slideHash);
	}

	public getAnimatedLayerInfo(
		slideHash: string,
		targetElement: string,
	): AnimatedShapeInfo {
		console.debug(
			`LayerDrawing.getAnimatedLayerInfo(${slideHash}, ${targetElement})`,
		);
		const layers = this.cachedDrawPages.get(slideHash);
		if (!layers) return null;
		for (const i in layers) {
			const animatedInfo = layers[i].content as AnimatedShapeInfo;
			if (animatedInfo && animatedInfo.hash === targetElement)
				return animatedInfo;
		}
		return null;
	}

	public getLayerImage(slideHash: string, targetElement: string): ImageBitmap {
		const layers = this.cachedDrawPages.get(slideHash);
		if (!layers) return null;
		for (const i in layers) {
			const animatedInfo = layers[i].content as AnimatedShapeInfo;
			if (
				animatedInfo &&
				animatedInfo.hash === targetElement &&
				animatedInfo.content
			)
				return (animatedInfo.content as ImageInfo).data;
		}
		return null;
	}

	public invalidateAll(): void {
		this.slideCache.invalidateAll();
	}

	public getCanvasSize(): [number, number] {
		return [this.canvasWidth, this.canvasHeight];
	}

	public onUpdatePresentationInfo() {
		this.computeInitialResolution();
		this.initializeCanvas();
	}

	public requestSlide(slideNumber: number, callback: VoidFunction) {
		this.onSlideRenderingCompleteCallback = callback;

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

		try {
			this.layerRenderer = new SlideShow.LayerRendererGl(this.offscreenCanvas);
		} catch (error) {
			console.log('LayerDrawing: WebGl offscreen rendering not supported');
			this.layerRenderer = new SlideShow.LayerRenderer2d(this.offscreenCanvas);
		}
	}

	private requestSlideImpl(slideHash: string, prefetch: boolean = false) {
		console.debug(
			'LayerDrawing.requestSlideImpl: slide hash: ' +
				slideHash +
				', prefetching: ' +
				prefetch,
		);
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
			slideHash === this.prefetchedSlideHash ||
			slideHash === this.nextRequestedSlideHash ||
			slideHash === this.nextPrefetchedSlideHash
		) {
			console.debug(
				'LayerDrawing.requestSlideImpl: no need to fetch slide again',
			);
			return;
		}

		if (
			this.requestedSlideHash ||
			this.prefetchedSlideHash ||
			this.slideRequestTimeout
		) {
			if (!prefetch || !this.slideRequestTimeout) {
				if (!prefetch) {
					// maybe user has switched to a new slide
					clearTimeout(this.slideRequestTimeout);
					this.nextRequestedSlideHash = slideHash;
					this.nextPrefetchedSlideHash = null;
				} else {
					// prefetching and nothing already queued
					this.nextPrefetchedSlideHash = slideHash;
				}
				this.slideRequestTimeout = setTimeout(() => {
					if (!this.helper.isSlideShowPlaying()) return;
					this.slideRequestTimeout = null;
					this.nextRequestedSlideHash = null;
					this.nextPrefetchedSlideHash = null;

					this.requestSlideImpl(slideHash, prefetch);
				}, 500);
			}
			return;
		}

		if (prefetch) {
			this.prefetchedSlideHash = slideHash;
			this.requestedSlideHash = null;
		} else {
			this.requestedSlideHash = slideHash;
			this.prefetchedSlideHash = null;
		}

		if (this.slideCache.has(slideHash)) {
			this.onSlideRenderingComplete({ success: true });
			return;
		}

		const backgroundRendered = this.drawBackground(slideHash);
		const masterPageRendered = this.drawMasterPage(slideHash);
		if (backgroundRendered && masterPageRendered) {
			if (this.drawDrawPage(slideHash)) {
				this.onSlideRenderingComplete({ success: true });
				return;
			}
		}

		app.socket.sendMessage(
			`getslide hash=${slideInfo.hash} part=${slideInfo.index} width=${this.canvasWidth} height=${this.canvasHeight} ` +
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

			this.clearCanvas();
			this.drawBitmap(imageInfo);
		}
	}

	private handleMasterPageLayerMsg(info: LayerInfo, img: any) {
		const slideInfo = this.getSlideInfo(info.slideHash);
		if (!slideInfo.masterPageObjectsVisibility) {
			return;
		}

		if (info.index === 0 || !this.cachedMasterPages.get(slideInfo.masterPage))
			this.cachedMasterPages.set(slideInfo.masterPage, new Array<LayerEntry>());

		const layers = this.cachedMasterPages.get(slideInfo.masterPage);
		if (layers.length !== info.index) {
			window.app.console.log(
				'LayerDrawing.handleMasterPageLayerMsg: missed any layers ?',
			);
		}
		const layerEntry: LayerEntry = {
			type: info.type,
			content: info.content,
			isField: info.isField,
		};
		if (info.type === 'bitmap') {
			if (!this.checkAndAttachImageData(layerEntry.content as ImageInfo, img))
				return;
		}
		layers.push(layerEntry);

		this.drawMasterPageLayer(layerEntry, info.slideHash);
	}

	private handleDrawPageLayerMsg(info: LayerInfo, img: any) {
		if (info.index === 0 || !this.cachedDrawPages.get(info.slideHash)) {
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
				const animatedElement = this.helper.getAnimatedElement(
					info.slideHash,
					content.hash,
				);
				if (animatedElement) {
					animatedElement.updateAnimationInfo(content);
				}
			}
		}
		layers.push(layerEntry);

		this.drawDrawPageLayer(info.slideHash, layerEntry);
	}

	private clearCanvas() {
		this.layerRenderer.clearCanvas();
	}
	private drawBackground(slideHash: string) {
		this.clearCanvas();

		const slideInfo = this.getSlideInfo(slideHash);

		if (this.layerRenderer.fillColor(slideInfo)) return true;

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

		var hasField = false;
		for (const layer of layers) {
			this.drawMasterPageLayer(layer, slideHash);
			if (layer.isField) {
				this.cachedMasterPages.delete(slideInfo.masterPage);
				hasField = true;
			}
		}

		if (hasField) return false;

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
			this.drawDrawPageLayer(slideHash, layer);
		}
		return true;
	}

	private drawDrawPageLayer(slideHash: string, layer: LayerEntry) {
		if (layer.type === 'bitmap') {
			this.drawBitmap(layer.content as ImageInfo);
		} else if (layer.type === 'animated') {
			const content = layer.content as AnimatedShapeInfo;
			if (content.type === 'bitmap') {
				const animatedElement = this.helper.getAnimatedElement(
					slideHash,
					content.hash,
				);
				if (animatedElement) {
					console.debug(
						'LayerDrawing.drawDrawPageLayer: retrieved animatedElement',
					);
					if (animatedElement.isValid()) {
						if (this.layerRenderer.isGlRenderer()) {
							animatedElement.renderLayer(this.layerRenderer);
							return;
						} else {
							const nextFrame = animatedElement.getAnimatedLayer();
							if (nextFrame) {
								console.debug(
									'LayerDrawing.drawDrawPageLayer: draw next frame',
								);
								this.drawBitmap(nextFrame);
								return;
							}
							return; // no layer means it is not visible
						}
					}
				}
				this.drawBitmap(content.content as ImageInfo);
			}
		}
	}

	private drawBitmap(imageInfo: ImageInfo | ImageBitmap) {
		this.layerRenderer.drawBitmap(imageInfo);
	}

	onSlideRenderingComplete(e: any) {
		if (!e.success) {
			const slideHash = this.requestedSlideHash || this.prefetchedSlideHash;
			const slideInfo = this.getSlideInfo(slideHash);
			const index = slideInfo ? slideInfo.index : undefined;
			this.requestedSlideHash = null;
			this.prefetchedSlideHash = null;
			console.debug(
				'LayerDrawing.onSlideRenderingComplete: rendering failed for slide: ' +
					index,
			);
			return;
		}

		if (this.prefetchedSlideHash) {
			this.prefetchedSlideHash = null;
			return;
		}
		const reqSlideInfo = this.getSlideInfo(this.requestedSlideHash);

		this.cacheAndNotify();
		// fetch next slide and draw it on offscreen canvas
		if (reqSlideInfo.next && !this.slideCache.has(reqSlideInfo.next)) {
			this.requestSlideImpl(reqSlideInfo.next, true);
		}
	}

	private cacheAndNotify() {
		if (!this.offscreenCanvas) {
			window.app.console.log(
				'LayerDrawing.onSlideRenderingComplete: no offscreen canvas available.',
			);
			return;
		}
		if (!this.slideCache.has(this.requestedSlideHash)) {
			const renderedSlide = this.offscreenCanvas.transferToImageBitmap();
			this.slideCache.set(this.requestedSlideHash, renderedSlide);
		}
		this.requestedSlideHash = null;

		const oldCallback = this.onSlideRenderingCompleteCallback;
		this.onSlideRenderingCompleteCallback = null;
		if (oldCallback)
			// if we already closed presentation it is missing
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
