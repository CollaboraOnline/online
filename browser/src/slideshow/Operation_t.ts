/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* This file for Set Primitive Operations */

declare var SlideShow: any;

class Operation_t {
	OperationCB: any;

	constructor(OperationCB: any) {
		this.OperationCB = OperationCB;
	}

	applyOperations(
		matrix: any,
		t: number,
		SlideWidthScale: number,
		SlideHeightScale: number,
	) {
		return this.OperationCB().interpolate(
			matrix,
			t,
			SlideWidthScale,
			SlideHeightScale,
		);
	}
}
SlideShow.Operation_t = Operation_t;
