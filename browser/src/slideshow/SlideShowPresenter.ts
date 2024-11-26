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
 * SlideShowPresenter is responsible for presenting the slide show and transitions
 */

declare var SlideShow: any;

interface VideoInfo {
	id: number;
	url: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface ClickRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

function hitTest(bounds: ClickRect, x: number, y: number) {
	return (
		x >= bounds.x &&
		x <= bounds.x + bounds.width &&
		y >= bounds.y &&
		y <= bounds.y + bounds.height
	);
}

interface ClickAction {
	action:
		| 'bookmark'
		| 'document'
		| 'prevpage'
		| 'nextpage'
		| 'firstpage'
		| 'lastpage'
		| 'sound'
		| 'verb'
		| 'program'
		| 'macro'
		| 'stoppresentation';
	bookmark?: string;
	document?: string;
	sound?: string;
	verb?: string;
	program?: string;
	macro?: string;
}

interface Interaction {
	bounds: ClickRect;
	clickAction?: ClickAction;
}

interface Trigger {
	hash: string;
	bounds: DOMRect;
}

interface SlideInfo {
	hash: string;
	index: number;
	name: string;
	notes: string;
	empty: boolean;
	hidden?: boolean;
	masterPage: string;
	masterPageObjectsVisibility: boolean;
	videos: Array<VideoInfo>;
	interactions: Array<Interaction>;
	transitionDuration: number;
	nextSlideDuration: number;
	transitionDirection: boolean;
	transitionType: string | undefined;
	transitionSubtype: string | undefined;
	transitionFadeColor: string | undefined;
	background: {
		isCustom: boolean;
		fillColor: string;
	};
	animations: any;
	triggers: Array<Trigger>;
	next: string;
	prev: string;
	indexInSlideShow?: number;
}

interface PresentationInfo {
	slides: Array<SlideInfo>;
	docWidth: number;
	docHeight: number;
	isEndless: boolean;
	loopAndRepeatDuration: number | undefined;
}

class SlideShowPresenter {
	_map: any = null;
	_presentationInfo: PresentationInfo = null;
	_slideCompositor: SlideCompositor = null;
	_fullscreen: Element = null;
	_presenterContainer: HTMLDivElement = null;
	_slideShowCanvas: HTMLCanvasElement = null;
	_slideShowWindowProxy: ReturnType<typeof window.open> = null;
	_windowCloseInterval: ReturnType<typeof setInterval> = null;
	_pauseRenderTimer: number = null;
	_pauseEnterFunc: () => void;
	_slideRenderer: SlideRenderer = null;
	_canvasLoader: CanvasLoader | null = null;
	private _pauseTimer: PauseTimerGl | PauseTimer2d;
	private _slideShowHandler: SlideShowHandler;
	private _slideShowNavigator: SlideShowNavigator;
	private _metaPresentation: MetaPresentation;
	private _startSlide: number;
	private _presentationInfoChanged: boolean = false;
	private _cypressSVGPresentationTest: boolean = false;
	private _onKeyDownHandler: (e: KeyboardEvent) => void;

	constructor(map: any) {
		this._cypressSVGPresentationTest =
			L.Browser.cypressTest || 'Cypress' in window;
		this._map = map;
		this._init();
		this.addHooks();
	}

	addHooks() {
		this._map.on('presentationinfo', this.onSlideShowInfo, this);
		this._map.on('newfullscreen', this._onStart, this);
		this._map.on('newpresentinwindow', this._onStartInWindow, this);
		L.DomEvent.on(document, 'fullscreenchange', this._onFullScreenChange, this);
		this._map.on('updateparts', this.onUpdateParts, this);
	}

	removeHooks() {
		this._map.off('presentationinfo', this.onSlideShowInfo, this);
		this._map.off('newfullscreen', this._onStart, this);
		this._map.off('newpresentinwindow', this._onStartInWindow, this);
		L.DomEvent.off(
			document,
			'fullscreenchange',
			this._onFullScreenChange,
			this,
		);
		this._map.off('updateparts', this.onUpdateParts, this);
	}

	private _init() {
		this._slideShowHandler = new SlideShowHandler(this);
		this._slideShowNavigator = new SlideShowNavigator(this._slideShowHandler);
		// do not allow user interaction until we get presentation info
		this._slideShowNavigator.disable();
		this._slideShowHandler.setNavigator(this._slideShowNavigator);
		this._slideShowNavigator.setPresenter(this);
		this._onKeyDownHandler = this._slideShowNavigator.onKeyDown.bind(
			this._slideShowNavigator,
		);
	}

	private onUpdateParts() {
		if (this._checkAlreadyPresenting()) this.onSlideShowInfoChanged();
	}

	public getNavigator() {
		return this._slideShowNavigator;
	}

	public getSlideInfo(slideNumber: number): SlideInfo | null {
		return this._presentationInfo
			? this._presentationInfo.slides[slideNumber]
			: null;
	}

	_getSlidesCount() {
		return this._presentationInfo ? this._presentationInfo.slides.length : 0;
	}

	public isFullscreen() {
		if (this._cypressSVGPresentationTest) return false;
		return !!this._fullscreen;
	}

	public getCanvas(): HTMLCanvasElement {
		return this._slideShowCanvas;
	}

	public getNotes(slide: number) {
		const info = this.getSlideInfo(slide);
		return info.notes;
	}

	_onFullScreenChange() {
		this._fullscreen = document.fullscreenElement;
		if (this._fullscreen) {
			// window.addEventListener('keydown', this._onCanvasKeyDown.bind(this));
			window.addEventListener('keydown', this._onKeyDownHandler);
			this.centerCanvas();
		} else {
			// we need to cleanup current/prev slide
			this._slideShowNavigator.quit();
		}
	}

	_stopFullScreen() {
		if (!this._slideShowCanvas) return;

		if (this._slideCompositor) this._slideCompositor.deleteResources();
		this._slideRenderer.deleteResources();

		// window.removeEventListener('keydown', this._onCanvasKeyDown.bind(this));
		window.removeEventListener('keydown', this._onKeyDownHandler);

		L.DomUtil.remove(this._slideShowCanvas);
		this._slideShowCanvas = null;
		if (this._presenterContainer) {
			L.DomUtil.remove(this._presenterContainer);
			this._presenterContainer = null;
		}
		// #7102 on exit from fullscreen we don't get a 'focus' event
		// in chome so a later second attempt at launching a presentation
		// fails
		this._map.focus();
	}

	private centerCanvas() {
		if (!this._slideShowCanvas) return;
		let winWidth = 0;
		let winHeight = 0;
		if (this._slideShowWindowProxy && !this._slideShowWindowProxy.closed) {
			winWidth = this._slideShowWindowProxy.innerWidth;
			winHeight = this._slideShowWindowProxy.innerHeight;
		} else if (this.isFullscreen()) {
			winWidth = window.screen.width;
			winHeight = window.screen.height;
		}

		// set canvas styles
		if (
			winWidth * this._slideShowCanvas.height <
			winHeight * this._slideShowCanvas.width
		) {
			// clean previous styles
			this._slideShowCanvas.style.height = '';
			this._slideShowCanvas.style.left = '';
			// set new styles
			this._slideShowCanvas.style.width = '100%';
			this._slideShowCanvas.style.top = '50%';
			this._slideShowCanvas.style.transform = 'translateY(-50%)';
		} else {
			// clean previous styles
			this._slideShowCanvas.style.width = '';
			this._slideShowCanvas.style.top = '';
			// set new styles
			this._slideShowCanvas.style.height = '100%';
			this._slideShowCanvas.style.left = '50%';
			this._slideShowCanvas.style.transform = 'translateX(-50%)';
		}
	}

	private _createPresenterHTML(parent: Element, width: number, height: number) {
		const presenterContainer = L.DomUtil.create(
			'div',
			'leaflet-slideshow2',
			parent,
		);
		presenterContainer.id = 'presenter-container';
		const slideshowContainer = L.DomUtil.create(
			'div',
			'leaflet-slideshow2',
			presenterContainer,
		);
		slideshowContainer.id = 'slideshow-container';
		this._slideShowCanvas = this._createCanvas(
			slideshowContainer,
			width,
			height,
		);
		return presenterContainer;
	}

	_createCanvas(parent: Element, width: number, height: number) {
		const canvas = L.DomUtil.create('canvas', 'leaflet-slideshow2', parent);

		canvas.id = 'slideshow-canvas';
		// set canvas styles
		canvas.style.margin = 0;
		canvas.style.position = 'absolute';

		canvas.addEventListener(
			'click',
			this._slideShowNavigator.onClick.bind(this._slideShowNavigator),
		);
		canvas.addEventListener(
			'mousemove',
			this._slideShowNavigator.onMouseMove.bind(this._slideShowNavigator),
		);

		this._slideShowHandler.getContext().aCanvas = canvas;

		try {
			this._slideRenderer = new SlideRendererGl(canvas);
		} catch (error) {
			this._slideRenderer = new SlideRenderer2d(canvas);
		}

		return canvas;
	}

	exitSlideshowWithWarning(): boolean {
		// TODO 2D version for disabled webGL
		if (this._slideRenderer._context.is2dGl()) return false;
		new SlideShow.StaticTextRenderer(this._slideRenderer._context).display(
			_('Click to exit presentation...'),
		);
		return true;
	}

	private startTimer(loopAndRepeatDuration: number) {
		console.debug('SlideShowPresenter.startTimer');
		const renderContext = this._slideRenderer._context;
		const onTimeoutHandler = this._slideShowNavigator.goToFirstSlide.bind(
			this._slideShowNavigator,
		);
		const PauseTimerType =
			renderContext instanceof RenderContextGl ? PauseTimerGl : PauseTimer2d;
		this._pauseTimer = new PauseTimerType(
			renderContext,
			loopAndRepeatDuration,
			onTimeoutHandler,
		);

		this._pauseTimer.startTimer();
	}

	endPresentation(force: boolean) {
		console.debug('SlideShowPresenter.endPresentation');
		if (this._pauseTimer) this._pauseTimer.stopTimer();

		const settings = this._presentationInfo;
		if (force || !settings.isEndless) {
			if (!force && this.exitSlideshowWithWarning()) {
				return;
			}
			this._closeSlideShowWindow();
			this._stopFullScreen();
			return;
		}
		this.startTimer(settings.loopAndRepeatDuration);
	}

	private startLoader(): void {
		try {
			this._canvasLoader = new CanvasLoaderGl(this._slideRenderer._context);
		} catch (error) {
			this._canvasLoader = new CanvasLoader2d(this._slideRenderer._context);
		}

		this._canvasLoader.startLoader();
	}

	public stopLoader(): void {
		if (!this._canvasLoader) return;

		this._canvasLoader.stopLoader();
		this._canvasLoader = null;
	}

	private _stylePauseOverlay(windowDocument: HTMLElement, show: boolean) {
		const overlay = windowDocument.querySelector(
			'#overlay-in-window',
		) as HTMLElement;

		const display = show ? 'block' : 'none';

		overlay.style.display = display;
		overlay.style.position = 'fixed';

		overlay.style.top = '0';
		overlay.style.bottom = '0';
		overlay.style.right = '0';
		overlay.style.left = '0';

		overlay.style.opacity = '65%';
		overlay.style.backgroundColor = 'black';
		overlay.style.color = 'white';

		overlay.style.alignContent = 'center';
		overlay.style.textAlign = 'center';
		overlay.style.fontWeight = 'bolder';
		overlay.style.fontSize = 'xxx-large';
		overlay.style.fontFamily = 'sans';

		overlay.style.userSelect = 'none';
	}

	_generateSlideWindowHtml(title: string) {
		const sanitizer = document.createElement('div');
		sanitizer.innerText = title;

		const sanitizedTitle = sanitizer.innerHTML;
		const pauseText = _('Presentation is paused - main window is hidden');

		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>${sanitizedTitle}</title>
			</head>
			<body>
				<div id="root-in-window"></div>
				<div id="overlay-in-window">
					<span>${pauseText}</span>
				</div>
			</body>
			</html>
			`;
	}

	_closeSlideShowWindow() {
		if (
			this._slideShowWindowProxy == null ||
			this._slideShowWindowProxy.closed
		) {
			return;
		}
		this._slideShowWindowProxy.opener.focus();
		this._slideShowWindowProxy.close();
		this._map.uiManager.closeSnackbar();
	}

	_doFallbackPresentation() {
		this._stopFullScreen();
		this._doInWindowPresentation();
	}

	_getProxyDocumentNode() {
		if (this._cypressSVGPresentationTest)
			return (this._slideShowWindowProxy as any as HTMLIFrameElement)
				.contentWindow.document;
		else return this._slideShowWindowProxy.document;
	}

	_requestPauseFrame() {
		if (!document.hidden) return;

		const logRefresh = function () {
			console.debug(
				'_requestPauseFrame: after onTabSwitch pause was activated',
			);
		};
		requestAnimationFrame(logRefresh);
	}

	onTabSwitch() {
		const windowDocument = this._getProxyDocumentNode().documentElement;

		if (document.hidden) this._stylePauseOverlay(windowDocument, true);
		else this._stylePauseOverlay(windowDocument, false);

		this._requestPauseFrame();
	}

	enablePauseHandler() {
		if (this._cypressSVGPresentationTest) return;

		// allow rendering in paused mode in Firefox at least 1 per sec
		// Chrome doesn't draw anything when main window is hidden
		this._pauseRenderTimer = this._slideShowWindowProxy.setInterval(
			this._requestPauseFrame.bind(this),
			1000,
		);

		this._pauseEnterFunc = this.onTabSwitch.bind(this);

		document.addEventListener('visibilitychange', this._pauseEnterFunc);
	}

	disablePauseHandler() {
		if (this._cypressSVGPresentationTest) return;

		document.removeEventListener('visibilitychange', this._pauseEnterFunc);
		this._pauseEnterFunc = undefined;
		this._slideShowWindowProxy.clearInterval(this._pauseRenderTimer);
	}

	_doInWindowPresentation() {
		const popupTitle =
			_('Windowed Presentation: ') + this._map['wopi'].BaseFileName;
		const htmlContent = this._generateSlideWindowHtml(popupTitle);

		if (this._cypressSVGPresentationTest) {
			this._slideShowWindowProxy = L.DomUtil.createWithId(
				'iframe',
				'slideshow-cypress-iframe',
				document.body,
			);
			this._getProxyDocumentNode().open();
			this._getProxyDocumentNode().write('<html><body></body></html>');
			this._getProxyDocumentNode().close();
		} else {
			this._slideShowWindowProxy = window.open('', '_blank', 'popup');
		}

		if (!this._slideShowWindowProxy) {
			this._notifyBlockedPresenting();
			return;
		}

		this.enablePauseHandler();

		this._getProxyDocumentNode().documentElement.innerHTML = htmlContent;
		this._getProxyDocumentNode().close();
		this._slideShowWindowProxy.focus();

		// set body styles
		this._getProxyDocumentNode().body.style.margin = '0';
		this._getProxyDocumentNode().body.style.padding = '0';
		this._getProxyDocumentNode().body.style.height = '100%';
		this._getProxyDocumentNode().body.style.overflow = 'hidden';

		this._stylePauseOverlay(
			this._getProxyDocumentNode().documentElement,
			false,
		);

		const body = this._getProxyDocumentNode().querySelector('#root-in-window');
		this._presenterContainer = this._createPresenterHTML(
			body,
			window.screen.width,
			window.screen.height,
		);
		this._slideShowCanvas.focus();

		this._slideShowWindowProxy.addEventListener(
			'resize',
			this.onSlideWindowResize.bind(this),
		);
		this._slideShowWindowProxy.addEventListener(
			'keydown',
			this._onKeyDownHandler,
		);

		const slideShowWindow = this._slideShowWindowProxy;
		this._map.uiManager.showSnackbar(
			_('Presenting in window'),
			_('Close Presentation'),
			function () {
				slideShowWindow.close();
			},
			-1,
			false,
			true,
		);

		this._windowCloseInterval = setInterval(
			function () {
				if (slideShowWindow.closed) {
					this.disablePauseHandler();
					clearInterval(this._windowCloseInterval);
					this._slideShowNavigator.quit();
					this._map.uiManager.closeSnackbar();
					this._slideShowCanvas = null;
					this._presenterContainer = null;
					this._slideShowWindowProxy = null;
				}
			}.bind(this),
			500,
		);
	}

	/// returns true on success
	_onPrepareScreen(inWindow: boolean) {
		if (this._checkPresentationDisabled()) {
			this._notifyPresentationDisabled();
			return false;
		}

		if (this._checkAlreadyPresenting()) {
			this._notifyAlreadyPresenting();
			return false;
		}

		if (
			(window as any).ThisIsTheiOSApp ||
			(window as any).ThisIsTheAndroidApp
		) {
			window.postMobileMessage('SLIDESHOW');
			return false;
		}

		if (app.impress.areAllSlidesHidden()) {
			this._notifyAllSlidesHidden();
			return false;
		}

		if (!this._map['wopi'].DownloadAsPostMessage) {
			if (inWindow) {
				this._doInWindowPresentation();
				return true;
			}

			// fullscreen
			this._presenterContainer = this._createPresenterHTML(
				this._map._container,
				window.screen.width,
				window.screen.height,
			);
			if (this._presenterContainer.requestFullscreen) {
				this._presenterContainer
					.requestFullscreen()
					.then(() => {
						// success
					})
					.catch(() => {
						this._doFallbackPresentation();
					});
				return true;
			}
		}

		this._doFallbackPresentation();
		return true;
	}

	onSlideWindowResize() {
		this.centerCanvas();
	}

	_checkAlreadyPresenting() {
		if (this._slideShowCanvas) return true;
		return false;
	}

	_notifyAllSlidesHidden() {
		this._map.uiManager.showInfoModal(
			'allslidehidden-modal',
			_('Empty Slide Show'),
			'All slides are hidden!',
			'',
			_('OK'),
			() => {
				0;
			},
			false,
			'allslidehidden-modal-response',
		);
	}

	_notifyAlreadyPresenting() {
		this._map.uiManager.showInfoModal(
			'already-presenting-modal',
			_('Already presenting'),
			_('You are already presenting this document'),
			'',
			_('OK'),
			null,
			false,
		);
	}

	_notifyBlockedPresenting() {
		this._map.uiManager.showInfoModal(
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

	_checkPresentationDisabled() {
		return this._map['wopi'].DisablePresentation;
	}

	_notifyPresentationDisabled() {
		this._map.uiManager.showInfoModal(
			'presentation-disabled-modal',
			_('Presentation disabled'),
			_('Presentation mode has been disabled for this document'),
			'',
			_('OK'),
			null,
			false,
		);
	}

	/// called when user triggers the presentation using UI
	_onStart(that: any) {
		if (!this._onPrepareScreen(false))
			// opens full screen, has to be on user interaction
			return;
		// disable slide sorter or it will receive key events
		this._map._docLayer._preview.partsFocused = false;

		this._startSlide = that?.startSlideNumber ?? 0;
		app.socket.sendMessage('getpresentationinfo');
	}

	/// called when user triggers the in-window presentation using UI
	_onStartInWindow(that: any) {
		if (!this._onPrepareScreen(true))
			// opens full screen, has to be on user interaction
			return;

		this._startSlide = that?.startSlideNumber ?? 0;
		app.socket.sendMessage('getpresentationinfo');
	}

	/// called as a response on getpresentationinfo
	onSlideShowInfo(data: PresentationInfo) {
		console.debug('SlideShow: received information about presentation');
		this._presentationInfo = data;

		const numberOfSlides = this._getSlidesCount();
		if (numberOfSlides === 0) return;

		if (!this.getCanvas()) {
			console.debug('onSlideShowInfo: no canvas available');
			return;
		}

		let skipTransition = false;

		if (!this._metaPresentation) {
			this._metaPresentation = new MetaPresentation(
				data,
				this._slideShowHandler,
				this._slideShowNavigator,
			);
			this._slideShowHandler.setMetaPresentation(this._metaPresentation);
			this._slideShowNavigator.setMetaPresentation(this._metaPresentation);
		} else {
			// don't allow user interaction
			this._slideShowNavigator.disable();
			const currentSlideHash = this._metaPresentation.getCurrentSlideHash();
			if (this._presentationInfoChanged || currentSlideHash) {
				// presentation is changed and presentation info has been updated
				this._presentationInfoChanged = false;
				// clean
				if (this._slideRenderer.isAnyVideoPlaying) {
					this._slideRenderer.pauseVideos();
				}
				this._slideShowHandler.skipAllEffects();
				this._slideShowHandler.cleanLeavingSlideStatus(
					this._slideShowNavigator.currentSlideIndex,
					true,
				);

				this._metaPresentation.update(data);
				// try to restore previously displayed slide
				const slideInfo = this._metaPresentation.getSlideInfo(currentSlideHash);
				this._startSlide = slideInfo ? slideInfo.indexInSlideShow : 0;
				skipTransition = true;
			} else {
				// slideshow has been started again
				this._metaPresentation.update(data);
			}
		}

		if (!this._slideCompositor) {
			this._slideCompositor = new SlideShow.LayersCompositor(
				this,
				this._metaPresentation,
			);
		}

		this._slideCompositor.onUpdatePresentationInfo();
		const canvasSize = this._slideCompositor.getCanvasSize();
		this._slideShowCanvas.width = canvasSize[0];
		this._slideShowCanvas.height = canvasSize[1];
		this.centerCanvas();

		// animated elements needs to update canvas size
		this._metaPresentation.getMetaSlides().forEach((metaSlide) => {
			if (metaSlide.animationsHandler) {
				const animElemMap = metaSlide.animationsHandler.getAnimatedElementMap();
				animElemMap.forEach((animatedElement) => {
					animatedElement.updateCanvasSize(canvasSize);
				});
			}
		});

		this.startLoader();

		// allow user interaction
		this._slideShowNavigator.enable();

		this._slideShowNavigator.startPresentation(
			this._startSlide,
			skipTransition,
		);
	}

	onSlideShowInfoChanged() {
		if (this._presentationInfoChanged) return;

		this._presentationInfoChanged = true;
		app.socket.sendMessage('getpresentationinfo');
	}
}

SlideShow.SlideShowPresenter = SlideShowPresenter;
