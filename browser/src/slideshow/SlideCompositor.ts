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
	_slideShowPresenter: SlideShowPresenter = null;
	_presentationInfo: PresentationInfo = null;
	_slides: Array<HTMLImageElement> = null;
	_width: number = 0;
	_height: number = 0;
	_initialSlideNumber: number = 0;
	_onGotSlideCallback: VoidFunction = null;
	_FETCH_ID_: number = 1000; // TODO

	constructor(slideShowPresenter: SlideShowPresenter, presentationInfo: PresentationInfo,
		width: number, height: number
	) {
		this._slideShowPresenter = slideShowPresenter;
		this._presentationInfo = presentationInfo;
		this._width = width;
		this._height = height;

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
		this._requestPreview(this._initialSlideNumber);
	}

	public fetchAndRun(slideNumber: number, callback: VoidFunction) {
		this._initialSlideNumber = slideNumber;
		this._onGotSlideCallback = callback;
		this._requestPreview(this._initialSlideNumber);
	}

	private _getSlidesCount() {
		return this._presentationInfo ? this._presentationInfo.slides.length : 0;
	}

	private _getSlideWidth() {
		return this._width;
	}

	private _getSlideHeight() {
		return this._height;
	}

	/// called when we receive slide content
	public onGotPreview(e: any) {
		if (!this._slides || !this._slides.length) return;

		console.debug('SlideCompositor: received slide: ' + e.part);
		const received = new Image();
		received.src = e.tile.src;
		this._slides[e.part] = received;

		if (e.part === this._initialSlideNumber && this._onGotSlideCallback) {
			const callback = this._onGotSlideCallback; // allow nesting
			this._onGotSlideCallback = null;
			callback.call(this._slideShowPresenter);
		}

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
				slideshow: true,
			},
		);
	}

	public getSlide(slideNumber: number): HTMLImageElement {
		// use cache if possible
		const slide = this._slides[slideNumber];

		// pre-fetch next slide
		this._requestPreview(slideNumber + 1);

		return slide;
	}
}

SlideShow.SlideCompositor = SlideCompositor;
