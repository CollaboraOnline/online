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
	background: {
		isCustom: boolean;
		fillColor: string;
	};
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
	_slideShowCanvas: HTMLCanvasElement = null;
	_currentSlide: number = 0;
	_slideRenderer: SlideRenderer = new SlideRenderer();

	constructor(map: any) {
		this._map = map;
		this.addHooks();
	}

	addHooks() {
		this._map.on('newfullscreen', this._onStart, this);
	}

	removeHooks() {
		this._map.off('newfullscreen', this._onStart, this);
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
		if (!this._fullscreen) this._stopFullScreen();
	}

	_stopFullScreen() {
		if (!this._slideShowCanvas) return;

		L.DomUtil.remove(this._slideShowCanvas);
		this._slideShowCanvas = null;
		// #7102 on exit from fullscreen we don't get a 'focus' event
		// in chome so a later second attempt at launching a presentation
		// fails
		this._map.focus();
	}

	_nextSlide() {
		if (this._currentSlide + 1 >= this._getSlidesCount()) {
			this._stopFullScreen();
			return;
		}

		this._slideCompositor.fetchAndRun(this._currentSlide, () => {
			this._currentSlide++;
			this._doTransition(this._slideRenderer._slideTexture, this._currentSlide);
		});
	}

	_previoustSlide() {
		if (this._currentSlide <= 0) {
			return;
		}

		this._slideCompositor.fetchAndRun(this._currentSlide, () => {
			this._currentSlide--;
			this._doPresentation();
		});
	}

	_onCanvasClick() {
		this._nextSlide();
	}

	_onCanvasKeyDown(event: KeyboardEvent) {
		if (event.code === 'Space') this._nextSlide();
		else if (event.code === 'Backspace') this._previoustSlide();
	}

	_createCanvas(width: number, height: number) {
		const canvas = L.DomUtil.create(
			'canvas',
			'leaflet-slideshow2',
			this._map._container,
		);

		canvas.id = 'fullscreen-canvas';
		canvas.width = width;
		canvas.height = height;

		canvas.addEventListener('click', this._onCanvasClick.bind(this));
		window.addEventListener('keydown', this._onCanvasKeyDown.bind(this));

		this._slideRenderer.setup(canvas);

		return canvas;
	}

	_doTransition(currentTexture: WebGLTexture, nextSlideNumber: number) {
		this._slideCompositor.fetchAndRun(nextSlideNumber, () => {
			const nextSlide = this._slideCompositor.getSlide(nextSlideNumber);
			const slideInfo = this.getSlideInfo(nextSlideNumber);
			if (
				slideInfo.transitionType == undefined ||
				slideInfo.transitionType.length == 0
			) {
				slideInfo.transitionType = 'NONE';
			}

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

	_doPresentation() {
		this._slideCompositor.fetchAndRun(this._currentSlide, () => {
			const slideImage = this._slideCompositor.getSlide(this._currentSlide);
			const currentTexture = this._slideRenderer.createTexture(slideImage);
			const slideInfo = this.getSlideInfo(this._currentSlide);
			this._slideRenderer.renderSlide(
				currentTexture,
				slideInfo,
				this._presentationInfo.docWidth,
				this._presentationInfo.docHeight,
			);
		});
	}

	_doFallbackPresentation = () => {
		// TODO: fallback to "open in new tab"
		this._stopFullScreen();
	};

	_onFullScreen() {
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

		L.DomEvent.on(document, 'fullscreenchange', this._onFullScreenChange, this);

		if (!this._map['wopi'].DownloadAsPostMessage) {
			this._slideShowCanvas = this._createCanvas(
				window.screen.width,
				window.screen.height,
			);
			if (this._slideShowCanvas.requestFullscreen) {
				this._slideShowCanvas
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
	_onStart() {
		this._onFullScreen(); // opens full screen, has to be on user interaction

		this._currentSlide = 0; // TODO: setup from parameter
		app.socket.sendMessage('getpresentationinfo');
	}

	/// called as a response on getpresentationinfo
	onSlideShowInfo(data: PresentationInfo) {
		console.debug('SlideShow: received information about presentation');
		this._presentationInfo = data;

		const numberOfSlides = this._getSlidesCount();
		if (numberOfSlides === 0) return;

		if (!this._slideCompositor)
			this._slideCompositor = new SlideShow.PreviewsCompositor(
				this,
				this._presentationInfo,
				this._slideShowCanvas.width,
				this._slideShowCanvas.height,
			);

		this._slideCompositor.updatePresentationInfo(this._presentationInfo);
		this._slideCompositor.fetchAndRun(0, () => {
			this._doPresentation();
		});
	}
}

SlideShow.SlideShowPresenter = SlideShowPresenter;
