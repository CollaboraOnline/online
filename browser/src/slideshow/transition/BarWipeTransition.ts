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

function BarWipeTransition(
	canvas: HTMLCanvasElement,
	image1: HTMLImageElement,
	image2: HTMLImageElement,
	slideInfo: SlideInfo,
) {
	const transitionSubType =
		stringToTransitionSubTypeMap[slideInfo.transitionSubtype];
	if (transitionSubType == TransitionSubType.FADEOVERCOLOR) {
		return new SlideShow.CutTransition(canvas, image1, image2, slideInfo);
	} else {
		return new SlideShow.WipeTransition(canvas, image1, image2, slideInfo);
	}
}

SlideShow.BarWipeTransition = BarWipeTransition;
