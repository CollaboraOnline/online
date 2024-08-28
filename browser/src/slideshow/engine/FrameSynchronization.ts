/* -*- tab-width: 4 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class FrameSynchronization {
	nFrameDuration: number;
	aTimer = new ElapsedTime();
	nNextFrameTargetTime = 0.0;
	bIsActive = false;

	constructor(nFrameDuration: number) {
		this.nFrameDuration = nFrameDuration;
		this.markCurrentFrame();
	}

	markCurrentFrame() {
		this.nNextFrameTargetTime =
			this.aTimer.getElapsedTime() + this.nFrameDuration;
	}

	synchronize() {
		if (this.bIsActive) {
			// Do busy waiting for now.
			while (this.aTimer.getElapsedTime() < this.nNextFrameTargetTime);
		}
		this.markCurrentFrame();
	}

	activate() {
		this.bIsActive = true;
	}

	deactivate() {
		this.bIsActive = false;
	}
}
