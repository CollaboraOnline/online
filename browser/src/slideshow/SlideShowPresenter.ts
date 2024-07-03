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

	constructor(map: any) {
		this._map = map;
		this.addHooks();
	}

	addHooks() {
		this._map.on('start-slide-show', this._onStart, this);
		this._map.on('tilepreview', this._onGotPreview);
	}

	removeHooks() {
		this._map.off('start-slide-show', this._onStart, this);
		this._map.off('tilepreview', this._onGotPreview);
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
