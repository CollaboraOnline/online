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

function HelixTransition(transitionParameters: TransitionParameters) {
	const nRows = 5;
    const invN = 1.0/nRows;
    let iDn = 0.0;
    let iPDn = invN;
    const aLeavingPrimitives : Primitive[] = [];
    const aEnteringPrimitives : Primitive[] = [];
    const aOperations: Operation[] = [];
    for (let i = 0; i < nRows; i++) {
        const Tile = new Primitive();

        Tile.pushTriangle([1.0, iDn], [0.0, iDn], [0.0, iPDn]);
        Tile.pushTriangle([1.0, iPDn], [1.0, iDn], [0.0, iPDn]);
        // TODO: Fix Leaving slide operation is not visible :)
        Tile.operations.push(makeSRotate(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 1, 0), 180, true, Math.min(Math.max((i - nRows/2.0)*invN/2.0, 0.0), 1.0), Math.min(Math.max((i + nRows/2.0)*invN/2.0, 0.0), 1.0)));
        aLeavingPrimitives.push(Primitive.cloneDeep(Tile));

        Tile.operations.push(makeSRotate(vec3.fromValues(0, 1, 0), vec3.fromValues(0, 1, 0), -180, false, 0.0, 1.0));
        aEnteringPrimitives.push(Tile);
        iDn += invN;
        iPDn += invN;        
    }

	const newTransitionParameters: TransitionParameters3D = {
		...transitionParameters,
		leavingPrimitives: aLeavingPrimitives,
		enteringPrimitives: aEnteringPrimitives,
		allOperations: aOperations,
	};

	return new SimpleTransition(newTransitionParameters);
}

SlideShow.HelixTransition = HelixTransition;
