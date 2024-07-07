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

interface PresentationInfo {
	slides: Array<any>;
	docWidth: number;
	docHeight: number;
}

class SlideShowPresenter {
	_map: any = null;
	_presentationInfo: any = null;
	_docWidth: number = 0;
	_docHeight: number = 0;
	_fullscreen: Element = null;
	_slideShowCanvas: HTMLCanvasElement = null;
	_currentSlide: number = 0;
	_slides: Array<string | null> = null;
	_FETCH_ID_: number = 1000; // TODO

	constructor(map: any) {
		this._map = map;
		this.addHooks();
	}

	addHooks() {
		this._map.on('newfullscreen', this._onStart, this);
		this._map.on('tilepreview', this._onGotPreview, this);
	}

	removeHooks() {
		this._map.off('newfullscreen', this._onStart, this);
	}

	_getSlidesCount() {
		return this._presentationInfo ? this._presentationInfo.slides.length : 0;
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

	_onCanvasClick() {
		if (this._currentSlide + 1 >= this._getSlidesCount())
			this._stopFullScreen();

		const slide = this._fetchSlide(this._currentSlide);
		if (!slide) {
			console.debug('SlideShow: no content for next slide yet.');
			return;
		}

		const previousSlide = new Image();
		previousSlide.src = slide;
		this._doTransition(previousSlide, this._currentSlide + 1);
		this._currentSlide++;
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

		return canvas;
	}

	/// called when we receive slide content
	_onGotPreview(e: any) {
		if (!this._slides || !this._slides.length) return;

		console.debug('SlideShow: received slide: ' + e.part);
		this._slides[parseInt(e.part)] = e.tile.src;
	}

	_requestPreview(slideNumber: number) {
		this._map.getPreview(
			this._FETCH_ID_,
			slideNumber,
			this._docWidth,
			this._docHeight,
			{
				autoUpdate: false,
			},
		);
	}

	_fetchSlide(slideNumber: number) {
		// use cache if possible
		const slide =
			this._slides && this._slides[slideNumber]
				? this._slides[slideNumber]
				: this._map._docLayer._preview._previewTiles[slideNumber].src;

		// pre-fetch next slide
		this._requestPreview(slideNumber + 1);

		return slide;
	}

	_doTransition(previousSlide: HTMLImageElement, nextSlideNumber: number) {
		const nextSlide = new Image();
		nextSlide.src = this._fetchSlide(nextSlideNumber);
		nextSlide.onload = () => {
			SlideShow.PerformTransition(
				this._slideShowCanvas,
				previousSlide,
				nextSlide,
				"FADE"
			);
		};
	}

	_doPresentation() {
		const previousSlide = new Image();

		if (this._currentSlide === 0) {
			// TODO: use black background as an initial slide
			previousSlide.src = this._fetchSlide(0);
		} else {
			previousSlide.src = this._fetchSlide(this._currentSlide);
		}

		this._doTransition(previousSlide, this._currentSlide);
	}

	_doFallbackPresentation = () => {
		// fallback to "open in new tab"
		this._stopFullScreen();
		this._doPresentation();
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
				window.innerWidth,
				window.innerHeight,
			);
			if (this._slideShowCanvas.requestFullscreen) {
				this._slideShowCanvas
					.requestFullscreen()
					.then(() => {
						this._doPresentation();
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

		this._slides = new Array<string>(numberOfSlides);

		this._docWidth = data.docWidth;
		this._docHeight = data.docHeight;

		this._requestPreview(this._currentSlide);
	}
}

SlideShow.SlideShowPresenter = SlideShowPresenter;
