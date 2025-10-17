// @ts-strict-ignore
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
	a11y?: string;
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
	transitionLabel: string | undefined;
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
	uniqueID: number;
	slideWidth: number;
	slideHeight: number;
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
	_slideShowWindowProxy: HTMLIFrameElement = null;
	_windowCloseInterval: ReturnType<typeof setInterval> = null;
	_slideRenderer: SlideRenderer = null;
	_canvasLoader: CanvasLoader | null = null;
	_progressBarContainer: HTMLDivElement | null = null;
	_slideNavContainer: HTMLDivElement | null = null;
	_enableA11y: boolean = false;
	private _pauseTimer: PauseTimerGl | PauseTimer2d;
	private _slideControlsTimer: ReturnType<typeof setTimeout> | null = null;
	private _slideShowHandler: SlideShowHandler;
	private _slideShowNavigator: SlideShowNavigator;
	private _metaPresentation: MetaPresentation;
	private _startSlide: number;
	private _startEffect: number;
	private _presentationInfoChanged: boolean = false;
	private _navigateSkipTransition: boolean = false;
	_skipNextSlideShowInfoChangedMsg: boolean = false;
	private _cypressSVGPresentationTest: boolean = false;
	private _onKeyDownHandler: (e: KeyboardEvent) => void;
	private _onImpressModeChanged: any = null;
	private _startingPresentation: boolean = false;
	private _hammer: HammerManager;
	private _wasInDarkMode: boolean = false;
	private _isLeader: boolean = false;
	// sometimes user may start presentation by themselves
	// which means they are not leader but they are not follower either
	private _isFollower: boolean = false;
	private _isFollowing: boolean = false;

	private showFollow(me: boolean) {
		if (app.isExperimentalMode()) {
			this._map.uiManager.showButton('slide-presentation-follow', !me);
			this._map.uiManager.showButton('slide-presentation-follow-me', me);
		}
	}

	constructor(map: any, enableA11y: boolean) {
		this._cypressSVGPresentationTest =
			window.L.Browser.cypressTest || 'Cypress' in window;
		this._map = map;
		this._enableA11y = enableA11y;
		this._init();
		this.addHooks();
		this.showFollow(true);
	}

	addHooks() {
		this._map.on('presentationinfo', this.onSlideShowInfo, this);
		this._map.on('newfullscreen', this._onStart, this);
		this._map.on('newpresentinwindow', this._onStartInWindow, this);
		window.L.DomEvent.on(
			document,
			'fullscreenchange',
			this._onFullScreenChange,
			this,
		);
		this._map.on('updateparts', this.onUpdateParts, this);
		this._map.on(
			'handleslideshowprogressbar',
			this.handleSlideShowProgressBar,
			this,
		);
		this._map.on(
			'presentercanvasclick',
			this._handlePresenterCanvasClick,
			this,
		);

		// Follow me slide hooks
		this._map.on(
			'newfollowmepresentation dispatcheffect rewindeffect followvideo endpresentation displayslide effect skipalleffect slideshowfollowon',
			this.handleFollowMeEvents,
			this,
		);
	}

	removeHooks() {
		this._map.off('presentationinfo', this.onSlideShowInfo, this);
		this._map.off('newfullscreen', this._onStart, this);
		this._map.off('newpresentinwindow', this._onStartInWindow, this);
		window.L.DomEvent.off(
			document,
			'fullscreenchange',
			this._onFullScreenChange,
			this,
		);
		this._map.off('updateparts', this.onUpdateParts, this);
		this._map.off(
			'handleslideshowprogressbar',
			this.handleSlideShowProgressBar,
			this,
		);
		this._map.off(
			'presentercanvasclick',
			this._handlePresenterCanvasClick,
			this,
		);

		// Follow me slide hooks
		this._map.off(
			'newfollowmepresentation dispatcheffect rewindeffect followvideo endpresentation displayslide effect skipalleffect slideshowfollowon',
			this.handleFollowMeEvents,
			this,
		);
	}

	handleFollowMeEvents(info: any) {
		this.setFollower(true);
		switch (info.type) {
			case 'newfollowmepresentation':
				this.setFollowing(true);
				this.showFollow(false);
				this._onStartInWindow({
					startSlideNumber:
						this._slideShowNavigator.getLeaderSlide() === -1
							? 0
							: this._slideShowNavigator.getLeaderSlide(),
					startEffectNumber:
						this._slideShowNavigator.getLeaderEffect() === -1
							? undefined
							: this._slideShowNavigator.getLeaderEffect(),
				});
				break;
			case 'dispatcheffect':
				if (this.isFollowing()) this._slideShowNavigator.dispatchEffect();
				break;
			case 'rewindeffect':
				if (this.isFollowing()) this._slideShowNavigator.rewindEffect();
				break;
			case 'followvideo':
				if (this.isFollowing()) this._slideShowNavigator.followVideo(info);
				break;
			case 'displayslide':
				this._slideShowNavigator.setLeaderSlide(info);
				this._slideShowNavigator.resetLeaderEffect();
				break;
			case 'effect':
				this._slideShowNavigator.setLeaderEffect(info);
				break;
			case 'skipalleffect':
				info.currentEffect = Number.POSITIVE_INFINITY;
				this._slideShowNavigator.setLeaderEffect(info);
				break;
			case 'endpresentation':
				this.setLeader(false);
				this.setFollower(false);
				this._slideShowNavigator.resetLeaderEffect();
				this._slideShowNavigator.resetLeaderSlide();
				this.showFollow(true);
				if (!this.isFollowing()) return;
				this.setFollowing(false);
				this.endPresentation(true);

				break;
			case 'slideshowfollowon':
				this.showFollow(false);
				break;
		}
	}

	private _handlePresenterCanvasClick(event: any) {
		const navigator = this._slideShowNavigator;
		if (!navigator) return;

		const currentSlideIndex = navigator.currentSlideIndex;
		if (currentSlideIndex === undefined) return;

		const slideInfo =
			this._metaPresentation.getSlideInfoByIndex(currentSlideIndex);
		if (!slideInfo || !slideInfo.videos || slideInfo.videos.length === 0) {
			return;
		}

		if (event.relativeX !== undefined && event.relativeY !== undefined) {
			const x = event.relativeX * this._metaPresentation.getDocWidth;
			const y = event.relativeY * this._metaPresentation.getDocHeight;

			const clickedVideo = slideInfo.videos.find((videoInfo) =>
				this.isPointInVideoArea(videoInfo, x, y),
			);

			if (clickedVideo) {
				const videoRenderer = this.getVideoRenderer(
					slideInfo.hash,
					clickedVideo,
				);
				if (videoRenderer) {
					videoRenderer.handleClick();
					return;
				}
			}
		}
	}

	private isPointInVideoArea(bounds: VideoInfo, x: number, y: number): boolean {
		return (
			x >= bounds.x &&
			x <= bounds.x + bounds.width &&
			y >= bounds.y &&
			y <= bounds.y + bounds.height
		);
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
		if (this._checkAlreadyPresenting() && !this._startingPresentation)
			this.onSlideShowInfoChanged();
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

	_getRepeatDuration() {
		return this._presentationInfo
			? this._presentationInfo.loopAndRepeatDuration
			: 0;
	}

	public isSlideHidden(slideNumber: number) {
		const slideInfo = this.getSlideInfo(slideNumber);
		return slideInfo ? slideInfo.hidden : true;
	}

	public getVisibleSlidesCount() {
		let count = 0;
		const slideCount = this._getSlidesCount();
		for (let i = 0; i < slideCount; ++i) {
			if (this.isSlideHidden(i)) continue;
			++count;
		}
		return count;
	}

	public getNextVisibleSlide(slideNumber: number) {
		let next = slideNumber;
		while (next < this._getSlidesCount()) {
			++next;
			if (!this.isSlideHidden(next)) break;
		}
		return next;
	}

	public getVisibleIndex(slideNumber: number) {
		let index = slideNumber;
		for (let i = 0; i < slideNumber; ++i) {
			if (this.isSlideHidden(i)) --index;
		}
		return index;
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
		return info ? info.notes : null;
	}

	public getVideoRenderer(
		slideHash: string,
		videoInfo: VideoInfo,
	): VideoRenderer {
		return this._slideCompositor.getVideoRenderer(slideHash, videoInfo);
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

		window.removeEventListener('keydown', this._onKeyDownHandler);

		window.L.DomUtil.remove(this._slideShowCanvas);
		this._slideShowCanvas = null;
		if (this._presenterContainer) {
			window.L.DomUtil.remove(this._presenterContainer);
			this._presenterContainer = null;
		}
		// #7102 on exit from fullscreen we don't get a 'focus' event
		// in Chrome so a later second attempt at launching a presentation
		// fails
		this._map.focus();
	}

	private centerCanvas() {
		if (!this._slideShowCanvas) return;
		let winWidth = 0;
		let winHeight = 0;
		if (this._slideShowWindowProxy) {
			winWidth = this._slideShowWindowProxy.clientWidth;
			winHeight = this._slideShowWindowProxy.clientHeight;
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
		const presenterContainer = window.L.DomUtil.create(
			'div',
			'leaflet-slideshow2',
			parent,
		);
		presenterContainer.id = 'presenter-container';
		const slideshowContainer = window.L.DomUtil.create(
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
		const canvas = window.L.DomUtil.create(
			'canvas',
			'leaflet-slideshow2',
			parent,
		);

		canvas.id = 'slideshow-canvas';
		// set canvas styles
		canvas.style.margin = 0;
		canvas.style.position = 'absolute';

		if (this._enableA11y) {
			canvas.setAttribute('aria-live', 'assertive');
		}

		this._progressBarContainer = this._createProgressBar(parent);
		this._slideNavContainer = this._createSlideNav(parent);

		canvas.addEventListener(
			'click',
			this._slideShowNavigator.onClick.bind(this._slideShowNavigator),
		);
		canvas.addEventListener(
			'mousemove',
			this._slideShowNavigator.onMouseMove.bind(this._slideShowNavigator),
		);
		canvas.addEventListener('mousemove', this._showSlideControls.bind(this));

		if (this._hammer) {
			this._hammer.off('swipe');
		}
		this._hammer = new Hammer(canvas);
		this._hammer.get('swipe').set({
			direction: Hammer.DIRECTION_ALL,
		});
		this._hammer.on(
			'swipe',
			window.touch
				.touchOnly(this._slideShowNavigator.onSwipe)
				.bind(this._slideShowNavigator),
		);

		this._slideShowHandler.getContext()._canvas = canvas;

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
	private _createProgressBar(parent: Element): HTMLDivElement {
		const progressContainer = window.L.DomUtil.create(
			'div',
			'slideshow-progress-container',
			parent,
		);

		this._configureProgressBarStyles(progressContainer);
		this._initializeProgressBarWidget(progressContainer);
		return progressContainer;
	}

	private _configureProgressBarStyles(container: HTMLDivElement): void {
		container.style.position = 'absolute';
		container.style.bottom = '0';
		container.style.left = '0';
		container.style.width = '100%';
		container.style.zIndex = '1000000000000';
		container.style.display = 'none';
		container.style.height = '6px';
	}

	private _initializeProgressBarWidget(container: HTMLDivElement): void {
		const progressData = {
			id: 'slideshow-progress-bar',
			type: 'progressbar',
			value: 0,
			maxValue: 100,
			infinite: true,
		};

		const builderOptions = {
			options: {
				cssClass: 'slideshow-progress',
			},
		};

		JSDialog.progressbar(container, progressData, builderOptions);
	}

	private _createSlideNav(parent: Element): HTMLDivElement {
		const slideNavContainer = window.L.DomUtil.create(
			'div',
			'slideshow-nav-container',
			parent,
		);
		slideNavContainer.tabIndex = -1;
		this._configureSlideNavStyles(slideNavContainer);
		this._initializeSlideNavWidget(slideNavContainer);
		return slideNavContainer;
	}

	private _configureSlideNavStyles(container: HTMLDivElement): void {
		container.style.backgroundColor = 'rgba(0, 0, 0, 0.25)';
		container.style.position = 'absolute';
		container.style.bottom = '8px';
		container.style.left = '8px';
		container.style.zIndex = '1000000000000';
		container.style.display = 'flex';
		container.style.padding = '2px';
		container.style.borderRadius = '25px';
	}

	private _onA11yString(target: any) {
		if (!target) {
			return;
		}

		this._slideShowHandler.addA11yString(target.getAttribute('aria-label'));
	}

	private _onPrevSlide = (e: Event) => {
		e.stopPropagation();
		this._slideShowNavigator.rewindEffect();
	};

	private _onNextSlide = (e: Event) => {
		e.stopPropagation();
		if (this._navigateSkipTransition) this._slideShowNavigator.skipEffect();
		else this._slideShowNavigator.dispatchEffect();
	};

	private _onQuit = (e: Event) => {
		e.stopPropagation();
		this.endPresentation(true);
	};

	_hideSlideControls() {
		this._slideNavContainer.style.visibility = 'hidden';
		this._slideNavContainer.style.opacity = '0';
		this._slideNavContainer.style.transition =
			'visibility 0s 0.5s, opacity 0.5s ease-in-out';
	}

	_showSlideControls() {
		this._slideNavContainer.style.visibility = 'visible';
		this._slideNavContainer.style.opacity = '1';
		this._slideNavContainer.style.transition = 'opacity 1s linear';

		clearTimeout(this._slideControlsTimer);
		this._slideControlsTimer = setTimeout(
			this._hideSlideControls.bind(this),
			3000,
		);
	}

	private _initializeSlideNavWidget(container: HTMLDivElement): void {
		const closeImg = window.L.DomUtil.create('img', 'left-img', container);
		closeImg.id = 'endshow';
		const slideshowCloseText = _('End Show');
		app.LOUtil.setImage(closeImg, 'slideshow-exit.svg', this._map);
		closeImg.setAttribute('aria-label', slideshowCloseText);
		closeImg.setAttribute('data-cooltip', slideshowCloseText);
		window.L.control.attachTooltipEventListener(closeImg, this._map);
		closeImg.addEventListener('click', this._onQuit);

		const leftImg = window.L.DomUtil.create('img', 'left-img', container);
		leftImg.id = 'previous';
		const slideshowPrevText = _('Previous');
		leftImg.setAttribute('aria-label', slideshowPrevText);
		leftImg.setAttribute('data-cooltip', slideshowPrevText);
		window.L.control.attachTooltipEventListener(leftImg, this._map);
		app.LOUtil.setImage(leftImg, 'slideshow-slidePrevious.svg', this._map);
		leftImg.addEventListener('click', this._onPrevSlide);

		const rightImg = window.L.DomUtil.create('img', 'right-img', container);
		rightImg.id = 'next';
		const slideshowNextText = _('Next');
		window.L.control.attachTooltipEventListener(rightImg, this._map);
		rightImg.setAttribute('aria-label', slideshowNextText);
		rightImg.setAttribute('data-cooltip', slideshowNextText);
		app.LOUtil.setImage(rightImg, 'slideshow-slideNext.svg', this._map);
		rightImg.addEventListener('click', this._onNextSlide);

		const animationsImage = window.L.DomUtil.create(
			'img',
			'animations-img skipTransition-false',
			container,
		);
		animationsImage.id = 'disableanimation';
		const slideshowAnimIniText = _('Disable Animations');
		animationsImage.setAttribute('aria-label', slideshowAnimIniText);
		animationsImage.setAttribute('data-cooltip', slideshowAnimIniText);
		window.L.control.attachTooltipEventListener(animationsImage, this._map);
		app.LOUtil.setImage(animationsImage, 'slideshow-transition.svg', this._map);
		animationsImage.addEventListener(
			'click',
			function (this: SlideShowPresenter, e: Event) {
				this._onA11yString(e.target);
				this._navigateSkipTransition = !this._navigateSkipTransition;
				const slideshowAnimToggleText = this._navigateSkipTransition
					? _('Enable Animations')
					: _('Disable Animations');
				animationsImage.setAttribute('aria-label', slideshowAnimToggleText);
				animationsImage.setAttribute('data-cooltip', slideshowAnimToggleText);

				animationsImage.className =
					'animations-img skipTransition-' + this._navigateSkipTransition;
			}.bind(this),
		);

		if (this.isFollower()) {
			const FollowImg = window.L.DomUtil.create('img', 'right-img', container);
			FollowImg.id = 'follow';
			const followText = _('Follow Presentation');
			window.L.control.attachTooltipEventListener(FollowImg, this._map);
			FollowImg.setAttribute('aria-label', followText);
			FollowImg.setAttribute('data-cooltip', followText);
			app.LOUtil.setImage(FollowImg, 'slideshow-slideNext.svg', this._map);
			FollowImg.addEventListener('click', (e: Event) => {
				e.stopPropagation();
				this._onA11yString(e.target);
				this._slideShowNavigator.followLeaderSlide();
			});
		}

		// Make sure slide controls don't disappear when mouse is over them
		container.addEventListener(
			'mouseenter',
			function (this: SlideShowPresenter) {
				clearTimeout(this._slideControlsTimer);
			}.bind(this),
		);
		container.addEventListener('click', () => {
			this.setFollowing(false);
		});
	}

	private startTimer(loopAndRepeatDuration: number) {
		app.console.debug('SlideShowPresenter.startTimer');
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
		this.sendSlideShowFollowMessage('endpresentation');
		this.checkDarkMode(false);
		this.setLeader(false);
		this.setFollowing(false);

		app.console.debug('SlideShowPresenter.endPresentation');
		if (this._pauseTimer) this._pauseTimer.stopTimer();

		const settings = this._presentationInfo;
		if (force || !settings.isEndless) {
			if (!force && this.exitSlideshowWithWarning()) {
				return;
			}
			this._stopFullScreen();
			this._closeSlideShowWindow();
			return;
		}
		this.startTimer(settings.loopAndRepeatDuration);
	}

	public handleSlideShowProgressBar(event: { isVisible: boolean }): void {
		try {
			if (!this._progressBarContainer) return;
			this._progressBarContainer.style.display = event?.isVisible
				? 'block'
				: 'none';
		} catch (error) {
			app.console.error('Not able to Slideshow progress bar', error);
		}
	}

	private startLoader(): void {
		try {
			this._canvasLoader = new CanvasLoaderGl(this._slideRenderer._context);
		} catch (error) {
			this._canvasLoader = new CanvasLoader2d(this._slideRenderer._context);
		}

		this._canvasLoader.startLoader();
		this._startingPresentation = false;
	}

	public stopLoader(): void {
		if (!this._canvasLoader) return;

		this._canvasLoader.stopLoader();
		this._canvasLoader = null;
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
				<meta name="viewport" content="width=device-width, initial-scale=1">
				<title>${sanitizedTitle}</title>
				<link rel="stylesheet" href="progressbar.css" />
			</head>
			<body>
				<div id="root-in-window"></div>
			</body>
			</html>
			`;
	}

	_closeSlideShowWindow() {
		if (this._slideShowWindowProxy) {
			this._slideShowWindowProxy.parentElement.removeChild(
				this._slideShowWindowProxy,
			);
			this._map.fire('presentinwindowclose');
			this._slideShowWindowProxy = null;
		}
		// enable present in console on closeSlideShowWindow
		this._enablePresenterConsole(false);
		this._map.uiManager.closeSnackbar();
		this._map.focus();
	}

	_doFallbackPresentation() {
		this._stopFullScreen();
		this._doInWindowPresentation();
	}

	_getProxyDocumentNode() {
		return this._slideShowWindowProxy.contentWindow.document;
	}

	_doInWindowPresentation() {
		const popupTitle =
			_('Windowed Presentation: ') + this._map['wopi'].BaseFileName;
		const htmlContent = this._generateSlideWindowHtml(popupTitle);

		this._slideShowWindowProxy = window.L.DomUtil.createWithId(
			'iframe',
			'slideshow-cypress-iframe',
			document.body,
		);
		this._getProxyDocumentNode().open();
		this._getProxyDocumentNode().write(htmlContent);

		if (!this._slideShowWindowProxy) {
			this._notifyBlockedPresenting();
			return;
		}

		this._slideShowWindowProxy.focus();

		// set body styles
		this._getProxyDocumentNode().body.style.margin = '0';
		this._getProxyDocumentNode().body.style.padding = '0';
		this._getProxyDocumentNode().body.style.height = '100%';
		this._getProxyDocumentNode().body.style.overflow = 'hidden';

		const body = this._getProxyDocumentNode().querySelector('#root-in-window');
		this._presenterContainer = this._createPresenterHTML(
			body,
			window.screen.width,
			window.screen.height,
		);

		window.addEventListener('resize', this.onSlideWindowResize);
		this._getProxyDocumentNode().addEventListener(
			'keydown',
			this._onKeyDownHandler,
		);
		this._slideShowWindowProxy.addEventListener(
			'unload',
			window.L.bind(this._closeSlideShowWindow, this),
		);
		const slideShowWindow = this._slideShowWindowProxy;
		this._map.uiManager.showSnackbar(
			_('Presenting in window'),
			_('Close Presentation'),
			window.L.bind(this._closeSlideShowWindow, this),
			-1,
			false,
			true,
		);

		this._windowCloseInterval = setInterval(
			function () {
				if (!slideShowWindow.isConnected) this.slideshowWindowCleanUp();
			}.bind(this),
			500,
		);

		window.addEventListener(
			'beforeunload',
			this.slideshowWindowCleanUp.bind(this),
		);
		this._slideShowCanvas.focus();
	}

	slideshowWindowCleanUp = () => {
		clearInterval(this._windowCloseInterval);
		this._slideShowNavigator.quit();
		this._map.uiManager.closeSnackbar();
		this._slideShowCanvas = null;
		this._presenterContainer = null;
		this._slideShowWindowProxy = null;
		window.removeEventListener('resize', this.onSlideWindowResize);
		window.removeEventListener('beforeunload', this.slideshowWindowCleanUp);
	};

	_onImpressModeChangedImpl(e: any, inWindow: boolean) {
		if (this._onImpressModeChanged && e.mode === 0) {
			this._map.off('impressmodechanged', this._onImpressModeChanged, this);
			this._onImpressModeChanged = null;
			const startSlide = {
				startSlideNumber: this._startSlide,
			};
			const startSlideshow = inWindow ? this._onStartInWindow : this._onStart;
			setTimeout(startSlideshow.bind(this, startSlide), 500);
		}
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

		if (app.impress.notesMode) {
			app.console.debug(
				'SlideShowPresenter._onPrepareScreen: notes mode is enabled, exiting',
			);
			// exit notes view mode and wait for status update notification
			// so we're sure that impress mode is changed
			// finally skip next partsupdate event,
			// since it's only due to the mode change
			this._skipNextSlideShowInfoChangedMsg = true;
			this._onImpressModeChanged = function (e: any) {
				this._onImpressModeChangedImpl(e, inWindow);
			};
			this._map.on('impressmodechanged', this._onImpressModeChanged, this);
			app.map.sendUnoCommand('.uno:NormalMultiPaneGUI');
			return false;
		}

		if (app.impress.areAllSlidesHidden()) {
			this._notifyAllSlidesHidden();
			return false;
		}

		// if we're playing a video, it'll continue *under* the presentation if we aren't careful
		// that's not a problem for visuals, but the audio of the video will also play
		// we don't currently need to do this for <audio> elements, since as we just use <video> tags for that anyway
		const videos = document.getElementsByTagName('video');
		for (const video of Array.from(videos)) {
			video.pause();
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

	onSlideWindowResize = () => {
		this.centerCanvas();
	};

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
				/*do nothing*/
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
		this._enablePresenterConsole(false);
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

	_enablePresenterConsole(state: boolean) {
		this._map.fire('commandstatechanged', {
			commandName: 'presenterconsole',
			disabled: state,
		});
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

	// We want to present the slides in default mode. So we check the state here and change when needed.
	private checkDarkMode(starting: boolean) {
		if (starting) {
			const isDarkMode = window.prefs.getBoolean('darkTheme');
			if (isDarkMode) {
				this._wasInDarkMode = true;
				app.map.uiManager.toggleDarkMode();
			}
		} else if (this._wasInDarkMode) {
			app.map.uiManager.toggleDarkMode();
			this._wasInDarkMode = false;
		}
	}

	/// called when user triggers the presentation using UI
	_onStart(that: any) {
		this._startSlide = that?.startSlideNumber ?? 0;
		if (!this._onPrepareScreen(false))
			// opens full screen, has to be on user interaction
			return;

		this.checkDarkMode(true);

		// disable slide sorter or it will receive key events
		this._map._docLayer._preview.partsFocused = false;
		this._startingPresentation = true;
		app.socket.sendMessage('getpresentationinfo');
	}

	/// called when user triggers the in-window presentation using UI
	_onStartInWindow(that: any) {
		this.sendSlideShowFollowMessage('newfollowmepresentation');
		this._startSlide = that?.startSlideNumber ?? 0;
		this._startEffect = that?.startEffectNumber;
		if (!this._onPrepareScreen(true))
			// opens full screen, has to be on user interaction
			return;

		this.checkDarkMode(true);

		// disable present in console onStartInWindow
		this._enablePresenterConsole(true);
		this._startingPresentation = true;
		app.socket.sendMessage('getpresentationinfo');
	}

	/// called as a response on getpresentationinfo
	onSlideShowInfo(data: PresentationInfo) {
		app.console.debug('SlideShow: received information about presentation');
		this._presentationInfo = data;

		const numberOfSlides = this._getSlidesCount();
		if (numberOfSlides === 0) return;

		if (!this.getCanvas()) {
			app.console.debug('onSlideShowInfo: no canvas available');
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
				if (currentSlideHash)
					this._slideCompositor.pauseVideos(currentSlideHash);
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
			this._startEffect,
		);
	}

	onSlideShowInfoChanged() {
		if (this._presentationInfoChanged) return;
		if (this._skipNextSlideShowInfoChangedMsg) {
			this._skipNextSlideShowInfoChangedMsg = false;
			return;
		}

		this._presentationInfoChanged = true;
		app.socket.sendMessage('getpresentationinfo');
	}

	isLeader(): boolean {
		return this._isLeader;
	}

	setLeader(leader: boolean): void {
		this._isLeader = leader;
	}

	setFollower(follower: boolean): void {
		this._isFollower = follower;
	}

	isFollower(): boolean {
		return this._isFollower;
	}

	setFollowing(follow: boolean): void {
		this._isFollowing = follow;
	}

	isFollowing(): boolean {
		return this._isFollowing;
	}

	sendSlideShowFollowMessage(msg: string): void {
		if (this.isLeader()) app.socket.sendMessage('slideshowfollow ' + msg);
	}
}

SlideShow.SlideShowPresenter = SlideShowPresenter;
