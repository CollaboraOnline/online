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
 * PreviewsCompositor generates slides from previews
 */

declare var SlideShow: any;

class PreviewsCompositor extends SlideShow.SlideCompositor {
	_slides: Array<ImageBitmap> = null;
	_FETCH_ID_: number = 1000; // TODO

	constructor(
		slideShowPresenter: SlideShowPresenter,
		presentationInfo: PresentationInfo,
		width: number,
		height: number,
	) {
		super(slideShowPresenter, presentationInfo, width, height);
		const numberOfSlides = this._getSlidesCount();
		this._slides = new Array<ImageBitmap>(numberOfSlides);
	}

	protected _addHooks() {
		app.map.on('tilepreview', this.onGotPreview, this);
	}

	public removeHooks() {
		app.map.off('tilepreview', this.onGotPreview, this);
	}

	public updatePresentationInfo(presentationInfo: PresentationInfo) {
		super.updatePresentationInfo(presentationInfo);
		this._requestPreview(this._initialSlideNumber);
	}

	public fetchAndRun(slideNumber: number, callback: VoidFunction) {
		super.fetchAndRun(slideNumber, callback);
		this._requestPreview(this._initialSlideNumber);
	}

	/// called when we receive slide content
	public onGotPreview(e: any) {
		if (!this._slides || !this._slides.length) return;

		console.debug('PreviewsCompositor: received slide: ' + e.part);
		const received = new Image();
		received.src = e.tile.src;

		received.onload = () => {
			createImageBitmap(received).then((result: ImageBitmap) => {
				this._slides[e.part] = result;

				if (e.part === this._initialSlideNumber && this._onGotSlideCallback) {
					const callback = this._onGotSlideCallback; // allow nesting
					this._onGotSlideCallback = null;
					callback.call(this._slideShowPresenter);
				}
			});
		};
	}

	private _requestPreview(slideNumber: number) {
		console.debug('PreviewsCompositor: request slide: ' + slideNumber);
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

	public getSlide(slideNumber: number): ImageBitmap {
		// use cache if possible
		const slide = this._slides[slideNumber];

		// pre-fetch next slide
		this._requestPreview(slideNumber + 1);

		return slide;
	}
}

SlideShow.PreviewsCompositor = PreviewsCompositor;
