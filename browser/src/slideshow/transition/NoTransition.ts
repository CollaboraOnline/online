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

class NoTransition extends Transition2d {
	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
		this.prepareTransition();
		this.animationTime = 10;
	}

	public start(): void {
		this.startTransition();
	}
}

SlideShow.NoTransition = NoTransition;
