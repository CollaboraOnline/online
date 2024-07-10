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

abstract class SlideCompositor {
	_slideShowPresenter: SlideShowPresenter = null;
	_presentationInfo: PresentationInfo = null;
	_width: number = 0;
	_height: number = 0;
	_initialSlideNumber: number = 0;
	_onGotSlideCallback: VoidFunction = null;

	constructor(
		slideShowPresenter: SlideShowPresenter,
		presentationInfo: PresentationInfo,
		width: number,
		height: number,
	) {
		this._slideShowPresenter = slideShowPresenter;
		this._presentationInfo = presentationInfo;
		this._width = width;
		this._height = height;

		this._addHooks();
	}

	protected abstract _addHooks(): void;

	public abstract removeHooks(): void;

	public updatePresentationInfo(presentationInfo: PresentationInfo) {
		this._presentationInfo = presentationInfo;
	}

	public fetchAndRun(slideNumber: number, callback: VoidFunction) {
		this._initialSlideNumber = slideNumber;
		this._onGotSlideCallback = callback;
	}

	protected _getSlidesCount() {
		return this._presentationInfo ? this._presentationInfo.slides.length : 0;
	}

	protected _getSlideWidth() {
		return this._width;
	}

	protected _getSlideHeight() {
		return this._height;
	}

	public abstract getSlide(slideNumber: number): ImageBitmap;
}

SlideShow.SlideCompositor = SlideCompositor;
