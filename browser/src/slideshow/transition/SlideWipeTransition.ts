/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
declare var SlideShow: any;

function SlideWipeTransition(
	canvas: HTMLCanvasElement,
	image1: HTMLImageElement,
	image2: HTMLImageElement,
	slideInfo: SlideInfo,
) {
	if (slideInfo.transitionDirection) {
		return new SlideShow.CoverTransition(canvas, image1, image2, slideInfo);
	} else {
		return new SlideShow.UncoverTransition(canvas, image1, image2, slideInfo);
	}
}

SlideShow.SlideWipeTransition = SlideWipeTransition;
