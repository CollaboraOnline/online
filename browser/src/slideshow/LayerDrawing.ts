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

	private presentInWindow: boolean = false;
	private slideShowWindowProxy: any = null;
	private requestedSlideHash: string = null;
	private displayedSlideHash: string = null;
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
	private currentCanvas: HTMLCanvasElement = null;
	private currentCanvasContext: ImageBitmapRenderingContext = null;

	private startSlideNumber: number = 0;
	private initialSlide: boolean;
	private slideShow: HTMLIFrameElement;

	private fullscreen: Element;

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

	isFullscreen(): boolean {
		return !!this.fullscreen;
	}

	private getSlideInfo(slideHash: string) {
		return this.helper.getSlideInfo(slideHash);
	}

	startPresentation(startSlideNumber: number, presentInWindow: boolean) {
		if (this.checkPresentationDisabled()) {
			this.notifyPresentationDisabled();
			return;
		}

		if (this.isPresenting()) {
			this.notifyAlreadyPresenting();
			return;
		}

		this.presentInWindow = presentInWindow;
		this.startSlideNumber = startSlideNumber;

		this.initializeSlideShow();
	}

	initializeSlideShow() {
		this.computeInitialResolution();
		this.initializeCanvas();
		this.requestInitialSlide();
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

	requestInitialSlide() {
		this.initialSlide = true;
		const startSlideHash = this.helper.getSlideHash(this.startSlideNumber);
		this.requestSlide(startSlideHash);
	}

	requestSlide(slideHash: string, prefetch: boolean = false) {
		const slideInfo = this.getSlideInfo(slideHash);
		if (!slideInfo) {
			window.app.console.log(
				'LayerDrawing.requestSlide: No info for requested slide: hash: ' +
					slideHash,
			);
			return;
		}
		if (
			slideHash === this.requestedSlideHash ||
			slideHash === this.prefetchedSlideHash
		)
			return;
		if (this.requestedSlideHash || this.prefetchedSlideHash) {
			setTimeout(this.requestSlide.bind(this), 500, slideHash, prefetch);
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
		const slideInfo = this.getSlideInfo(info.slideHash);

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
		if (this.initialSlide) {
			this.initialSlide = false;
			this.startPlaying();
		}
		this.showRenderedSlide();
	}

	private startPlaying() {
		// Windowed Presentation
		if (this.presentInWindow) {
			const popupTitle =
				_('Windowed Presentation: ') + this.map['wopi'].BaseFileName;
			const htmlContent = this.generateSlideWindowHtml(popupTitle);

			this.slideShowWindowProxy = window.open('', '_blank', 'popup');

			// this.slideShowWindowProxy.addEventListener('load', this._handleSlideWindowLoaded.bind(this), false);

			if (!this.slideShowWindowProxy) {
				this.map.uiManager.showInfoModal(
					'popup-blocked-modal',
					_('Windowed Presentation Blocked'),
					_(
						'Presentation was blocked. Please allow pop-ups in your browser. This lets slide shows to be displayed in separated windows, allowing for easy screen sharing.',
					),
					'',
					_('OK'),
					null,
					false,
				);
			}

			this.slideShowWindowProxy.document.documentElement.innerHTML =
				htmlContent;
			this.slideShowWindowProxy.document.close();
			this.slideShowWindowProxy.focus();

			const canvas = this.slideShowWindowProxy.document.getElementById(
				'canvas',
			) as HTMLCanvasElement;
			if (!canvas) {
				window.app.console.log(
					'LayerDrawing.startPlaying: no canvas element found',
				);
				return;
			}
			canvas.width = this.canvasWidth;
			canvas.height = this.canvasHeight;

			const ctx = canvas.getContext('bitmaprenderer');
			if (!ctx) {
				window.app.console.log(
					'LayerDrawing.startPlaying: can not get a valid context for current canvas',
				);
				return;
			}
			this.currentCanvas = canvas;
			this.currentCanvasContext = ctx;

			this.slideShowWindowProxy.addEventListener(
				'keydown',
				this.onSlideWindowKeyPress.bind(this),
			);
			this.slideShowWindowProxy.addEventListener(
				'resize',
				this.onSlideWindowResize.bind(this),
			);

			this.centerCanvasInSlideWindow();
		}
	}

	private showRenderedSlide() {
		if (!this.offscreenCanvas) {
			window.app.console.log(
				'LayerDrawing.showRenderedSlide: no offscreen canvas available.',
			);
			return;
		}
		if (!this.currentCanvasContext) {
			window.app.console.log(
				'LayerDrawing.showRenderedSlide: no valid context for current canvas',
			);
			return;
		}

		if (this.requestedSlideHash) {
			this.displayedSlideHash = this.requestedSlideHash;
			this.requestedSlideHash = null;
		}
		const bitmap = this.offscreenCanvas.transferToImageBitmap();
		this.currentCanvasContext.transferFromImageBitmap(bitmap);
	}

	private generateSlideWindowHtml(title: string) {
		const sanitizer = document.createElement('div');
		sanitizer.innerText = title;
		const sanitizedTitle = sanitizer.innerHTML;

		return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${sanitizedTitle}</title>
			<style>
				body, html {
					margin: 0;
					padding: 0;
					height: 100%;
					overflow: hidden; /* Prevent scrollbars */
				}
		        .vertical-center {
					margin: 0;
					position: absolute;
					width: 100%;
					top: 50%;
					/*-ms-transform: translateY(-50%);*/
					transform: translateY(-50%);
				}
				.horizontal-center {
					margin: 0;
					position: absolute;
					height: 100%;
					left: 50%;
					/*-ms-transform: translateY(-50%);*/
					transform: translateX(-50%);
				}
			</style>
		</head>
		<body>
			<canvas id="canvas"></canvas>
		</body>
		</html>
		`;
	}

	/*
	handleSlideWindowLoaded () {
		window.app.console.log('LayerDrawing._handleSlideWindowLoaded');
	}
	*/

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
		let viewWidth = window.innerWidth;
		let viewHeight = window.innerHeight;
		if (!this.presentInWindow) {
			viewWidth = window.screen.width;
			viewHeight = window.screen.height;
		}
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

	private centerCanvasInSlideWindow() {
		const winWidth = this.slideShowWindowProxy.innerWidth;
		const winHeight = this.slideShowWindowProxy.innerHeight;
		if (winWidth * this.canvasHeight < winHeight * this.canvasWidth) {
			this.currentCanvas.className = 'vertical-center';
		} else {
			this.currentCanvas.className = 'horizontal-center';
		}
	}

	onSlideWindowResize() {
		this.centerCanvasInSlideWindow();
	}

	isPresenting() {
		if (this.slideShowWindowProxy && !this.slideShowWindowProxy.closed)
			return true;
		if (this.slideShow) return true;
		return false;
	}

	notifyAlreadyPresenting() {
		this.map.uiManager.showInfoModal(
			'already-presenting-modal',
			_('Already presenting'),
			_('You are already presenting this document'),
			'',
			_('OK'),
			null,
			false,
		);
	}

	checkPresentationDisabled() {
		return this.map['wopi'].DisablePresentation;
	}

	notifyPresentationDisabled() {
		this.map.uiManager.showInfoModal(
			'presentation-disabled-modal',
			_('Presentation disabled'),
			_('Presentation mode has been disabled for this document'),
			'',
			_('OK'),
			null,
			false,
		);
	}

	onSlideWindowKeyPress(e: any) {
		if (e.code === 'Escape') {
			this.slideShowWindowProxy.opener.focus();
			this.slideShowWindowProxy.close();
			this.map.uiManager.closeSnackbar();
		} else if (e.code === 'ArrowRight') {
			const slideInfo = this.getSlideInfo(this.displayedSlideHash);
			this.requestSlide(slideInfo.next);
		} else if (e.code === 'ArrowLeft') {
			const slideInfo = this.getSlideInfo(this.displayedSlideHash);
			this.requestSlide(slideInfo.prev);
		}
	}
}

SlideShow.LayerDrawing = LayerDrawing;
