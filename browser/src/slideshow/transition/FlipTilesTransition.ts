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

declare var SlideShow: any;

function vec(x: number, y: number, nx: number, ny: number): vec2 {
	x = x < 0.0 ? 0.0 : x;
	x = Math.min(x, nx);
	y = y < 0.0 ? 0.0 : y;
	y = Math.min(y, ny);
	return [x / nx, y / ny];
}

function FlipTilesTransition(
	transitionParameters: TransitionParameters,
	n: number = 8,
	m: number = 6,
) {
	const aLeavingPrimitives: Primitive[] = [];
	const aEnteringPrimitives: Primitive[] = [];

	for (let x = 0; x < n; x++) {
		for (let y = 0; y < n; y++) {
			const aTile = new Primitive();
			const x11 = vec(x, y, n, m);
			const x12 = vec(x, y + 1, n, m);
			const x21 = vec(x + 1, y, n, m);
			const x22 = vec(x + 1, y + 1, n, m);

			aTile.pushTriangle(x21, x11, x12);
			aTile.pushTriangle(x22, x21, x12);

			aTile.operations.push(
				makeSRotate(
					vec3.fromValues(0, 1, 0),
					vec3.fromValues(0, 0.8, 0),
					180,
					true,
					(x11[0] * x11[1]) / 2.0,
					(x22[0] * x22[1] + 1.0) / 2.0,
				),
			);
			aLeavingPrimitives.push(Primitive.cloneDeep(aTile));

			aTile.operations.push(
				makeSRotate(
					vec3.fromValues(0, 1, 0),
					vec3.fromValues(0, 0.8, 0),
					-180,
					false,
					(x11[0] * x11[1]) / 2.0,
					(x22[0] * x22[1] + 1.0) / 2.0,
				),
			);
			aEnteringPrimitives.push(aTile);
		}
	}

	const newTransitionParameters: TransitionParameters3D = {
		...transitionParameters,
		leavingPrimitives: aLeavingPrimitives,
		enteringPrimitives: aEnteringPrimitives,
		allOperations: [],
	};

	return new SimpleTransition(newTransitionParameters);
}

SlideShow.FlipTilesTransition = FlipTilesTransition;
