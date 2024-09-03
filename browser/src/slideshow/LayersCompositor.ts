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
 * LayersCompositor generates slide from layers
 */

declare var app: any;
declare var SlideShow: any;

class LayersCompositor extends SlideCompositor {
	private layerDrawing: LayerDrawing; // setup in constructor
	private metaPresentation: MetaPresentation;

	constructor(
		slideShowPresenter: SlideShowPresenter,
		metaPres: MetaPresentation,
	) {
		super(slideShowPresenter);
		this.metaPresentation = metaPres;
	}

	protected _addHooks() {
		this.layerDrawing = new SlideShow.LayerDrawing(app.map, this);
		this.layerDrawing.addHooks();
	}

	public removeHooks() {
		this.layerDrawing.removeHooks();
	}

	public fetchAndRun(slideNumber: number, callback: VoidFunction) {
		super.fetchAndRun(slideNumber, callback);
		this.layerDrawing.requestSlide(this._initialSlideNumber, () => {
			const oldCallback = this._onGotSlideCallback;
			this._onGotSlideCallback = null;
			oldCallback!();
		});
	}

	public getSlideInfo(slideHash: string | undefined): SlideInfo {
		return this.metaPresentation.getSlideInfo(slideHash);
	}

	public onUpdatePresentationInfo() {
		this.layerDrawing.onUpdatePresentationInfo();
		// TODO: optimize
		this.layerDrawing.invalidateAll();
	}

	public getSlideHash(slideIndex: number) {
		return this.metaPresentation.getSlideHash(slideIndex);
	}

	public getSlideSizePixel() {
		return [
			app.twipsToPixels * this.metaPresentation.slideWidth,
			app.twipsToPixels * this.metaPresentation.slideHeight,
		];
	}

	public computeLayerResolution(width: number, height: number) {
		width *= 1.2;
		height *= 1.2;
		let resolutionWidth = 960;
		let resolutionHeight = 540;

		if (width > 3840 || height > 2160) {
			resolutionWidth = 3840;
			resolutionHeight = 2160;
		} else if (width > 2560 || height > 1440) {
			resolutionWidth = 2560;
			resolutionHeight = 1440;
		} else if (width > 1920 || height > 1080) {
			resolutionWidth = 1920;
			resolutionHeight = 1080;
		} else if (width > 1280 || height > 720) {
			resolutionWidth = 1280;
			resolutionHeight = 720;
		}
		return [resolutionWidth, resolutionHeight];
	}

	public computeLayerSize(width: number, height: number) {
		// compute the slide size in pixel with respect to the current resolution
		const slideWidth = this.metaPresentation.slideWidth;
		const slideHeight = this.metaPresentation.slideHeight;
		const slideRatio = slideWidth / slideHeight;
		const resolutionRatio = width / height;
		if (slideRatio > resolutionRatio) {
			height = Math.trunc((width * slideHeight) / slideWidth);
		} else if (slideRatio < resolutionRatio) {
			width = Math.trunc((height * slideWidth) / slideHeight);
		}
		return [width, height];
	}

	// return [width, height]
	public getCanvasSize(): [number, number] {
		return this.layerDrawing.getCanvasSize();
	}

	public getSlide(slideNumber: number): ImageBitmap | undefined {
		return this.layerDrawing.getSlide(slideNumber);
	}

	public getLayerImage(
		slideHash: string,
		targetElement: string,
	): ImageBitmap | null {
		return this.layerDrawing.getLayerImage(slideHash, targetElement);
	}

	public getLayerBounds(
		slideHash: string,
		targetElement: string,
	): BoundingBoxType | null {
		return this.layerDrawing.getLayerBounds(slideHash, targetElement);
	}
}

SlideShow.LayersCompositor = LayersCompositor;
