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

class FallTransitionImp extends SimpleTransition {
	constructor(transitionParameters: TransitionParameters3D) {
		super(transitionParameters);
		this.prepareTransition();
	}

	public start(): void {
		this.startTransition();
	}
}

function FallTransition(transitionParameters: TransitionParameters) {
	const slide = new Primitive();
	slide.pushTriangle([0, 0], [1, 0], [0, 1]);
	slide.pushTriangle([1, 0], [0, 1], [1, 1]);

	const aLeavingPrimitives: Primitive[] = [];
	aLeavingPrimitives.push(Primitive.cloneDeep(slide));

	slide.operations.push(
		makeRotateAndScaleDepthByWidth(
			vec3.fromValues(1, 0, 0),
			vec3.fromValues(0, -1, 0),
			90,
			true,
			true,
			0.0,
			1.0,
		),
	);

	const aEnteringPrimitives: Primitive[] = [];
	aEnteringPrimitives.push(slide);

	const aOperations: Operation[] = [];

	const newTransitionParameters: TransitionParameters3D = {
		...transitionParameters,
		leavingPrimitives: aLeavingPrimitives,
		enteringPrimitives: aEnteringPrimitives,
		allOperations: aOperations,
	};

	return new FallTransitionImp(newTransitionParameters);
}

SlideShow.FallTransition = FallTransition;
