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
		return SlideShow.CubeTransition(transitionParameters, true);
	} else if (transitionSubType == TransitionSubType.LEFTTORIGHT) {
		return SlideShow.FallTransition(transitionParameters);
	} else if (transitionSubType == TransitionSubType.TOPTOBOTTOM) {
		return SlideShow.TurnAroundTransition(transitionParameters);
	} else if (transitionSubType == TransitionSubType.TOPLEFT) {
		// todo : iris transition
	} else if (transitionSubType == TransitionSubType.TOPRIGHT) {
		return SlideShow.TurnDownTransition(transitionParameters);
	} else if (transitionSubType == TransitionSubType.BOTTOMRIGHT) {
		return SlideShow.RochadeTransition(transitionParameters);
	} else if (transitionSubType == TransitionSubType.BOTTOMLEFT) {
		return SlideShow.Venetian3dTransition(transitionParameters, true, 8);
	} else if (transitionSubType == TransitionSubType.TOPCENTER) {
		// todo : fix horizontal 3d
		return SlideShow.Venetian3dTransition(transitionParameters, false, 6);
	} else if (transitionSubType == TransitionSubType.RIGHTCENTER) {
		return SlideShow.StaticNoiseTransition(transitionParameters);
	} else if (transitionSubType == TransitionSubType.BOTTOMCENTER) {
		return SlideShow.DissolveTransition3d(transitionParameters);
	} else if (transitionSubType == TransitionSubType.CORNERSIN) {
		return SlideShow.CubeTransition(transitionParameters, false);
	} else if (transitionSubType == TransitionSubType.VERTICAL) {
		//  todo : Vortex transition
	} else if (transitionSubType == TransitionSubType.HORIZONTAL) {
		return SlideShow.RippleTransition(transitionParameters, false);
	} else if (transitionSubType == TransitionSubType.CIRCLE) {
		//  todo: 3d circle transition (8,128)
	} else if (transitionSubType == TransitionSubType.FANOUTHORIZONTAL) {
		return SlideShow.HelixTransition(transitionParameters, 20);
	} else if (transitionSubType == TransitionSubType.ACROSS) {
		return SlideShow.FlipTilesTransition(transitionParameters, 8,6);
	} else if (transitionSubType == TransitionSubType.DIAMOND) {
		//  todo: glitter transition
	} else if (transitionSubType == TransitionSubType.HEART) {
		//  todo: honeycomb transition
	}
}

SlideShow.MicsShapeWipeTransition = MicsShapeWipeTransition;
