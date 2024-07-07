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
 * SlideCompositor is responsible for slide image generation, which later will be shown on the screen
 */

declare var SlideShow: any;

class SlideCompositor {
	_presentationInfo: PresentationInfo = null;
	_slides: Array<HTMLImageElement> = null;
	_FETCH_ID_: number = 1000; // TODO

	constructor(presentationInfo: PresentationInfo) {
		this._presentationInfo = presentationInfo;

		const numberOfSlides = this._getSlidesCount();
		this._slides = new Array<HTMLImageElement>(numberOfSlides);

		this._addHooks();
	}

	private _addHooks() {
		app.map.on('tilepreview', this.onGotPreview, this);
	}

	public removeHooks() {
		app.map.off('tilepreview', this.onGotPreview, this);
	}

	public updatePresentationInfo(presentationInfo: PresentationInfo) {
		this._presentationInfo = presentationInfo;
	}

	private _getSlidesCount() {
		return this._presentationInfo ? this._presentationInfo.slides.length : 0;
	}

	private _getSlideWidth() {
		return this._presentationInfo.docHeight;
	}

	private _getSlideHeight() {
		return this._presentationInfo.docHeight;
	}

	/// called when we receive slide content
	public onGotPreview(e: any) {
		if (!this._slides || !this._slides.length) return;

		console.debug('SlideCompositor: received slide: ' + e.part);
		this._slides[parseInt(e.part)] = e.tile.src;
	}

	private _requestPreview(slideNumber: number) {
		console.debug('SlideCompositor: request slide: ' + slideNumber);
		app.map.getPreview(
			this._FETCH_ID_,
			slideNumber,
			this._getSlideWidth(),
			this._getSlideHeight(),
			{
				autoUpdate: false,
			},
		);
	}

	public getSlide(slideNumber: number): HTMLImageElement {
		// use cache if possible
		const slide =
			this._slides && this._slides[slideNumber]
				? this._slides[slideNumber]
				: app.map._docLayer._preview._previewTiles[slideNumber].src;

		// pre-fetch next slide
		this._requestPreview(slideNumber + 1);

		return slide;
	}
}

SlideShow.SlideCompositor = SlideCompositor;
