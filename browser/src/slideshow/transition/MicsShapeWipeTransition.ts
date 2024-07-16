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

function MicsShapeWipeTransition(transitionParameters: TransitionParameters) {
	const transitionSubType =
		stringToTransitionSubTypeMap[
			transitionParameters.slideInfo.transitionSubtype
		];
	if (transitionSubType == TransitionSubType.CORNERSOUT) {
		return SlideShow.CubeTransition(transitionParameters);
	} else if (transitionSubType == TransitionSubType.LEFTTORIGHT) {
		return SlideShow.FallTransition(transitionParameters);
	}
}

SlideShow.MicsShapeWipeTransition = MicsShapeWipeTransition;
