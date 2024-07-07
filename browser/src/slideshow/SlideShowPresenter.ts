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

interface SlideInfo {
	hash: string;
	index: number;
	empty: boolean;
	masterPage: string;
	masterPageObjectsVisible: boolean;
	background: {
		isCustom: boolean;
		fillColor: string;
	};
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
		if (this._currentSlide + 1 >= this._getSlidesCount()) {
			this._stopFullScreen();
			return;
		}

		const previousSlide = this._slideCompositor.getSlide(this._currentSlide);

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

	_doTransition(previousSlide: HTMLImageElement, nextSlideNumber: number) {
		const nextSlide = this._slideCompositor.getSlide(nextSlideNumber);
		nextSlide.onload = () => {
			SlideShow.PerformTransition(
				this._slideShowCanvas,
				previousSlide,
				nextSlide,
				'FADE',
			);
		};
	}

	_doPresentation() {
		const previousSlide = this._slideCompositor.getSlide(this._currentSlide);
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

		if (this._slideCompositor)
			this._slideCompositor.updatePresentationInfo(this._presentationInfo);
		else
			this._slideCompositor = new SlideShow.SlideCompositor(this._presentationInfo);
	}
}

SlideShow.SlideShowPresenter = SlideShowPresenter;
