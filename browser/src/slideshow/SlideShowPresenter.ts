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

interface SlideInfo {
	hash: string;
	index: number;
	empty: boolean;
	masterPage: string;
	masterPageObjectsVisibility: boolean;
	videos: Array<VideoInfo>;
	transitionDuration: number;
	nextSlideDuration: number;
	transitionDirection: boolean;
	transitionType: string | undefined;
	transitionSubtype: string | undefined;
	transitionFadeColor: string | undefined;
	isEndless: boolean;
	loopAndRepeatDuration: number | undefined;
	background: {
		isCustom: boolean;
		fillColor: string;
	};
	animations: any;
	next: string;
	prev: string;
}

interface PresentationInfo {
	slides: Array<SlideInfo>;
	docWidth: number;
	docHeight: number;
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
	_currentSlide: number = 0;
	_slideRenderer: SlideRenderer = null;
	_animationsHandler: SlideAnimations = null;
	_canvasLoader: CanvasLoader | null = null;
	_isAnimationPlaying: boolean = false;
	_isPresentInWindow: boolean = false;

	constructor(map: any) {
		this._map = map;
		this.addHooks();
	}

	addHooks() {
		this._map.on('newfullscreen', this._onStart, this);
		this._map.on('newpresentinwindow', this._onStartInWindow, this);
		this._map.on('animationstatechanged', this._onAnimationStateChanged, this);
		L.DomEvent.on(document, 'fullscreenchange', this._onFullScreenChange, this);
	}

	removeHooks() {
		this._map.off('newfullscreen', this._onStart, this);
		this._map.off('newpresentinwindow', this._onStartInWindow, this);
		this._map.off('animationstatechanged', this._onAnimationStateChanged, this);
		L.DomEvent.off(
			document,
			'fullscreenchange',
			this._onFullScreenChange,
			this,
		);
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
		return !!this._fullscreen;
	}

	public getCanvas(): HTMLCanvasElement {
		return this._slideShowCanvas;
	}

	_onFullScreenChange() {
		this._fullscreen = document.fullscreenElement;
		if (this._fullscreen) {
			window.addEventListener('keydown', this._onCanvasKeyDown.bind(this));
			this.centerCanvas();
		} else {
			this._stopFullScreen();
		}
	}

	_stopFullScreen() {
		if (!this._slideShowCanvas) return;

		this._slideRenderer.deleteResources();

		window.removeEventListener('keydown', this._onCanvasKeyDown.bind(this));
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

	_nextSlide() {
		if (this._isAnimationPlaying) {
			this._map.fire('skipanimation');
			return;
		}

		if (this._currentSlide + 1 >= this._getSlidesCount()) {
			const currSlideInfo = this.getSlideInfo(this._currentSlide);
			if (currSlideInfo?.isEndless == undefined || !currSlideInfo.isEndless) {
				if (this._currentSlide + 1 === this._getSlidesCount()) {
					this._currentSlide++;
					this.exitSlideshowWithWarning();
					return;
				}
				this._closeSlideShowWindow();
				this._stopFullScreen();
				return;
			}

			this.startTimer(currSlideInfo.loopAndRepeatDuration);
			return;
		}

		this._slideCompositor.fetchAndRun(this._currentSlide, () => {
			this._currentSlide++;
			this.createAnimationsHandler();
			this._doTransition(
				this._slideRenderer.getSlideTexture(),
				this._currentSlide,
			);
		});
	}

	_previoustSlide() {
		if (this._isAnimationPlaying) {
			this._map.fire('skipanimation');
			return;
		}

		if (this._currentSlide <= 0) {
			return;
		}

		// if we are at exit text slide, we have to go back....
		if (this._currentSlide === this._getSlidesCount()) {
			this._currentSlide--;
			this._slideCompositor.fetchAndRun(this._currentSlide, () => {
				this._doPresentation();
			});
			return;
		}

		this._slideCompositor.fetchAndRun(this._currentSlide, () => {
			this._currentSlide--;
			this.createAnimationsHandler();
			this._doPresentation();
		});
	}

	_onCanvasClick() {
		this._nextSlide();
	}

	_onCanvasKeyDown(event: KeyboardEvent) {
		if (event.code === 'Space' || event.code === 'ArrowRight')
			this._nextSlide();
		else if (event.code === 'Backspace' || event.code === 'ArrowLeft')
			this._previoustSlide();
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
		if (
			winWidth * this._slideShowCanvas.height <
			winHeight * this._slideShowCanvas.width
		) {
			this._slideShowCanvas.className =
				'leaflet-slideshow2 slideshow-vertical-center';
		} else {
			this._slideShowCanvas.className =
				'leaflet-slideshow2 slideshow-horizontal-center';
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

		canvas.addEventListener('click', this._onCanvasClick.bind(this));

		try {
			this._slideRenderer = new SlideRendererGl(canvas);
		} catch (error) {
			this._slideRenderer = new SlideRenderer2d(canvas);
		}

		return canvas;
	}

	private exitSlideshowWithWarning() {
		const transitionParameters = new TransitionParameters();
		transitionParameters.context = this._slideRenderer._context;

		new SlideShow.StaticTextRenderer(transitionParameters).display(
			_('Click to exit presentation...'),
		);
	}

	private startTimer(loopAndRepeatDuration: number) {
		const transitionParameters = new TransitionParameters();
		transitionParameters.context = this._slideRenderer._context;

		let pauseTimer: PauseTimer;

		// reset current slide to first slide
		this._currentSlide = 0;

		if (this._slideRenderer._context instanceof RenderContextGl) {
			pauseTimer = new SlideShow.PauseTimerGl(
				transitionParameters,
				loopAndRepeatDuration,
				() => {
					const currSlideInfo = this.getSlideInfo(this._currentSlide);

					if (
						currSlideInfo?.transitionType == undefined ||
						currSlideInfo.transitionType == 'NONE'
					) {
						this._slideCompositor.fetchAndRun(this._currentSlide, () => {
							this._doPresentation();
						});
						return;
					}

					this._doTransition(
						this._slideRenderer.getSlideTexture(),
						this._currentSlide,
					);
				},
			);
		} else {
			pauseTimer = new SlideShow.PauseTimer2d(
				transitionParameters,
				loopAndRepeatDuration,
				() => {
					this._doTransition(
						this._slideRenderer.getSlideTexture(),
						this._currentSlide,
					);
					// TODO: May be add alert for user: Repeat slideshow not supported on your device.
				},
			);
		}

		pauseTimer.startTimer();
	}

	private startLoader(): void {
		const transitionParameters = new TransitionParameters();
		transitionParameters.context = this._slideRenderer._context;

		try {
			this._canvasLoader = new SlideShow.CanvasLoaderGl(transitionParameters);
		} catch (error) {
			this._canvasLoader = new SlideShow.CanvasLoader2d(transitionParameters);
		}

		this._canvasLoader.startLoader();
	}

	private stopLoader(): void {
		if (!this._canvasLoader) return;

		this._canvasLoader.stopLoader();
		this._canvasLoader = null;
	}

	_doTransition(
		currentTexture: WebGLTexture | ImageBitmap,
		nextSlideNumber: number,
	) {
		this._slideCompositor.fetchAndRun(nextSlideNumber, () => {
			const slideInfo = this.getSlideInfo(nextSlideNumber);
			if (
				slideInfo.transitionType == undefined ||
				slideInfo.transitionType.length == 0
			) {
				slideInfo.transitionType = 'NONE';
			}

			this.stopLoader();

			const nextSlide = this._slideCompositor.getSlide(nextSlideNumber);
			const nextTexture = this._slideRenderer.createTexture(nextSlide);

			const transitionParameters = new TransitionParameters();
			transitionParameters.context = this._slideRenderer._context;
			transitionParameters.current = currentTexture;
			transitionParameters.next = nextTexture;
			transitionParameters.slideInfo = slideInfo;
			transitionParameters.callback = () => {
				this._slideRenderer.renderSlide(
					nextTexture,
					slideInfo,
					this._presentationInfo.docWidth,
					this._presentationInfo.docHeight,
				);
			};

			SlideShow.PerformTransition(transitionParameters);

			if (slideInfo?.nextSlideDuration && slideInfo.nextSlideDuration > 0) {
				setTimeout(() => {
					this._nextSlide();
				}, slideInfo.transitionDuration + slideInfo.nextSlideDuration);
			}
		});
	}

	_generateSlideWindowHtml(title: string) {
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
					.slideshow-vertical-center {
						margin: 0;
						position: absolute;
						width: 100%;
						top: 50%;
						transform: translateY(-50%);
					}
					.slideshow-horizontal-center {
						margin: 0;
						position: absolute;
						height: 100%;
						left: 50%;
						transform: translateX(-50%);
					}
				</style>
			</head>
			<body>
				<div id="root-in-window"></div>
			</body>
			</html>
			`;
	}

	_closeSlideShowWindow() {
		if (this._slideShowWindowProxy == null) return;
		this._slideShowWindowProxy.opener.focus();
		this._slideShowWindowProxy.close();
		this._map.uiManager.closeSnackbar();
	}

	_doPresentation(isStarting = false) {
		this._slideRenderer.pauseVideos();
		const slideInfo = this.getSlideInfo(this._currentSlide);
		// To speed up the process, if we have transition info, then only render
		// a black empty slide as the first slide. otherwise, directly render the first slide.
		if (
			isStarting &&
			slideInfo?.transitionType != undefined &&
			slideInfo.transitionType != 'NONE'
		) {
			// generate empty black slide
			const blankTexture = this._slideRenderer.createEmptyTexture();

			this._doTransition(blankTexture, this._currentSlide);
		} else {
			this._slideCompositor.fetchAndRun(this._currentSlide, () => {
				const slideInfo = this.getSlideInfo(this._currentSlide);
				const slideImage = this._slideCompositor.getSlide(this._currentSlide);
				const currentTexture = this._slideRenderer.createTexture(slideImage);
				this._slideRenderer.renderSlide(
					currentTexture,
					slideInfo,
					this._presentationInfo.docWidth,
					this._presentationInfo.docHeight,
				);
				this.stopLoader();
			});
		}
	}

	_doFallbackPresentation() {
		// TODO: fallback to "open in new tab"
		this._stopFullScreen();
	}

	_doInWindowPresentation() {
		const popupTitle =
			_('Windowed Presentation: ') + this._map['wopi'].BaseFileName;
		const htmlContent = this._generateSlideWindowHtml(popupTitle);

		this._slideShowWindowProxy = window.open('', '_blank', 'popup');

		if (!this._slideShowWindowProxy) {
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
			return;
		}

		this._slideShowWindowProxy.document.documentElement.innerHTML = htmlContent;
		this._slideShowWindowProxy.document.close();
		this._slideShowWindowProxy.focus();

		const body =
			this._slideShowWindowProxy.document.querySelector('#root-in-window');
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
			this._onCanvasKeyDown.bind(this),
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
					clearInterval(this._windowCloseInterval);
					this._map.uiManager.closeSnackbar();
					this._slideShowCanvas = null;
					this._presenterContainer = null;
					this._slideShowWindowProxy = null;
				}
			}.bind(this),
			500,
		);
	}

	_onPrepareScreen(inWindow: boolean) {
		if (this._checkPresentationDisabled()) {
			this._notifyPresentationDisabled();
			return;
		}

		if (this._checkAlreadyPresenting()) {
			this._notifyAlreadyPresenting();
			return;
		}

		if (
			(window as any).ThisIsTheiOSApp ||
			(window as any).ThisIsTheAndroidApp
		) {
			window.postMobileMessage('SLIDESHOW');
			return;
		}

		if (this._map._docLayer.hiddenSlides() >= this._map.getNumberOfParts()) {
			this._notifyAllSlidesHidden();
			return;
		}

		if (!this._map['wopi'].DownloadAsPostMessage) {
			if (inWindow) {
				this._doInWindowPresentation();
				return;
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
				return;
			}
		}

		this._doFallbackPresentation();
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
		this._onPrepareScreen(false); // opens full screen, has to be on user interaction
		this._currentSlide = that?.startSlideNumber ?? 0;
		app.socket.sendMessage('getpresentationinfo');
	}

	/// called when user triggers the in-window presentation using UI
	_onStartInWindow() {
		this._onPrepareScreen(true); // opens full screen, has to be on user interaction
		this._currentSlide = 0;
		app.socket.sendMessage('getpresentationinfo');
	}

	_onAnimationStateChanged(e: any) {
		this._isAnimationPlaying = !!e.isPlaying;
	}

	/// called as a response on getpresentationinfo
	onSlideShowInfo(data: PresentationInfo) {
		console.debug('SlideShow: received information about presentation');
		this._presentationInfo = data;

		const numberOfSlides = this._getSlidesCount();
		if (numberOfSlides === 0) return;

		if (!this._slideCompositor) {
			this._slideCompositor = new SlideShow.LayersCompositor(
				this,
				this._presentationInfo,
			);
		}

		this.createAnimationsHandler();

		this._slideCompositor.updatePresentationInfo(this._presentationInfo);
		const canvasSize = this._slideCompositor.getCanvasSize();
		this._slideShowCanvas.width = canvasSize[0];
		this._slideShowCanvas.height = canvasSize[1];
		this.centerCanvas();

		this.startLoader();

		this._slideCompositor.fetchAndRun(0, () => {
			this._doPresentation(true);
		});
	}

	createAnimationsHandler() {
		const slideInfo = this.getSlideInfo(this._currentSlide);
		if (slideInfo.animations) {
			this._animationsHandler = new SlideAnimations();
			this._animationsHandler.importAnimations(slideInfo.animations.root);
			this._animationsHandler.parseInfo();
			const animationTree = this._animationsHandler.getAnimationsTree();
			if (animationTree) {
				const info = animationTree.getInfo(true);
				window.app.console.log('animations info: \n' + info);
			}
		}
	}
}

SlideShow.SlideShowPresenter = SlideShowPresenter;
