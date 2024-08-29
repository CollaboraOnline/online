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

declare var app: any;

abstract class ContinuousActivityBase extends SimpleContinuousActivityBase {
	protected constructor(aCommonParamSet: ActivityParamSet) {
		super(aCommonParamSet);
	}

	protected abstract performContinuousHook(
		nModifiedTime: number,
		nRepeatCount: number,
	): void;
	// protected performContinuousHook(nModifiedTime: number, nRepeatCount: number): void {
	// 	// TODO throw abstract
	// }

	protected simplePerform(nSimpleTime: number, nRepeatCount: number) {
		this.performContinuousHook(
			this.calcAcceleratedTime(nSimpleTime),
			nRepeatCount,
		);
	}
}
