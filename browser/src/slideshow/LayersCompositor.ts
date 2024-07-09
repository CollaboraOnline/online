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

declare var SlideShow: any;

class LayersCompositor extends SlideShow.SlideCompositor {
	constructor(
		slideShowPresenter: SlideShowPresenter,
		presentationInfo: PresentationInfo,
		width: number,
		height: number,
	) {
		super(slideShowPresenter, presentationInfo, width, height);
	}

	protected _addHooks() {
		app.map.on('slidebackground', this.onSlideBackground, this);
	}

	public removeHooks() {
		app.map.off('slidebackground', this.onSlideBackground, this);
	}

	private onSlideBackground(e: any) {
		if (!e.data) {
			window.app.console.log('LayersCompositor.onSlideLayer: no json data available.');
			return;
		}
	}

	public getSlide(slideNumber: number): HTMLImageElement {
		return null;
	}
}

SlideShow.LayersCompositor = LayersCompositor;
