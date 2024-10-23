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
 * SlideCompositor is responsible for slide image generation, which later will be shown on the screen
 */

declare var SlideShow: any;

abstract class SlideCompositor {
	_slideShowPresenter: SlideShowPresenter = null;
	_initialSlideNumber: number = 0;
	_onGotSlideCallback: VoidFunction = null;

	constructor(slideShowPresenter: SlideShowPresenter) {
		this._slideShowPresenter = slideShowPresenter;
		this._addHooks();
	}

	protected abstract _addHooks(): void;

	public abstract removeHooks(): void;

	public abstract onUpdatePresentationInfo(): void;

	public fetchAndRun(slideNumber: number, callback: VoidFunction) {
		this._initialSlideNumber = slideNumber;
		this._onGotSlideCallback = callback;
	}

	public abstract getCanvasSize(): [number, number]; // [width, height]

	public abstract getSlide(slideNumber: number): ImageBitmap;

	public abstract getLayerImage(
		slideHash: string,
		targetElement: string,
	): ImageBitmap;

	public abstract getLayerBounds(
		slideHash: string,
		targetElement: string,
	): BoundingBoxType;

	public abstract getAnimatedSlide(slideIndex: number): ImageBitmap;

	public abstract getAnimatedLayerInfo(
		slideHash: string,
		targetElement: string,
	): AnimatedShapeInfo;

	public abstract getLayerRendererContext(): RenderContext;
}

SlideShow.SlideCompositor = SlideCompositor;
