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
	_slideCurrent: string = null;
	_slideNext: string = null;
	_fullscreen: Element = null;
	_slideShow: Element = null;
	_startSlideNumber: number = 0;
	_presentInWindow: boolean = null;
	_cypressSVGPresentationTest: boolean = false; // TODO: unused

	constructor(map: any) {
		this._map = map;
		this.addHooks();
	}

	addHooks() {
		this._map.on('newfullscreen', this._onFullScreen, this);
		this._map.on('start-slide-show', this._onStart, this);
		this._map.on('tilepreview', this._onGotPreview);
	}

	removeHooks() {
		this._map.off('newfullscreen', this._onFullScreen, this);
		this._map.off('start-slide-show', this._onStart, this);
		this._map.off('tilepreview', this._onGotPreview);
	}

	_onFullScreenChange() {
		this._fullscreen = document.fullscreenElement;
		if (!this._fullscreen) {
			this._stopFullScreen();
			const canvas = document.getElementById('fullscreen-canvas');
			if (canvas) {
				L.DomUtil.removeChild(canvas);
			}
		}
	}

	_stopFullScreen() {
		L.DomUtil.remove(this._slideShow);
		this._slideShow = null;
		// #7102 on exit from fullscreen we don't get a 'focus' event
		// in chome so a later second attempt at launching a presentation
		// fails
		this._map.focus();
	}

	_onFullScreen(e: any) {
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
			return;
		}

		const doPresentation = (e: any) => {
			this._presentInWindow = false;
			this._startSlideNumber = 0; // Default: start from page 0
			if (typeof e.startSlideNumber !== 'undefined') {
				this._startSlideNumber = e.startSlideNumber;
			}

			// TODO: Need to start Slide from _startSlideNumber

			const canvas = document.getElementById('fullscreen-canvas');
			this._slideShow = canvas;

			// TODO: Replace Image here with Scaled Slide Preview
			const image1 = new Image();
			const image2 = new Image();

			/*
			TODO:
			logic for webgl presentation window. here are initial thoughts

			keep the context and "current slide" texture outside of the class, then on transition load the slide into next texture and add to the transition class as a parameter,
			the transition class will only do transition from one texture (slide) to another texture and then get destroyed
			*/

			image1.onload = () => {
				image2.onload = () => {
					SlideShow.FadeTransition(canvas, image1, image2).start(3);
				};
				image2.src = 'images/help/pt-BR/manage-changes-filter.png';
			};
			image1.src = 'images/help/pt-BR/paragraph-dialog.png';

			L.DomEvent.on(
				document,
				'fullscreenchange',
				this._onFullScreenChange,
				this,
			);
		};

		const fallback = function (e: any) {
			// fallback to "open in new tab"
			if (this._slideShow) {
				L.DomUtil.remove(this._slideShow);
				this._slideShow = null;
			}

			doPresentation(e);
		};

		if (
			!(
				this._cypressSVGPresentationTest ||
				this._map['wopi'].DownloadAsPostMessage
			)
		) {
			const canvas = L.DomUtil.create(
				'canvas',
				'leaflet-slideshow2',
				this._map._container,
			);
			this._slideShow = canvas;
			canvas.id = 'fullscreen-canvas';
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;

			if (canvas.requestFullscreen) {
				canvas
					.requestFullscreen()
					.then(() => {
						doPresentation(e);
					})
					.catch(() => {
						fallback(e);
					});
				return;
			}
		}

		fallback(e);
	}

	_checkAlreadyPresenting() {
		if (this._slideShow) return true;
		return false;
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

	_onStart() {
		app.socket.sendMessage('getpresentationinfo');
	}

	_onGotPreview(e: any) {
		this._slideCurrent = e.tile;
	}

	initializeSlideShowInfo(data: PresentationInfo) {
		const slides = data.slides;
		const numberOfSlides = slides.length;
		if (numberOfSlides === 0) return;

		this._presentationInfo = data;

		this._docWidth = data.docWidth;
		this._docHeight = data.docHeight;

		this._map.getPreview(1000, 0, this._docWidth, this._docHeight, {
			autoUpdate: false,
		});
		this._map.getPreview(1001, 1, this._docWidth, this._docHeight, {
			autoUpdate: false,
		});
	}
}

SlideShow.SlideShowPresenter = SlideShowPresenter;
