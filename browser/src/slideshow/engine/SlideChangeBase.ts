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

abstract class SlideChangeBase {
	private isFinished: boolean;
	private transitionParameters: TransitionParameters;
	protected leavingSlide: WebGLTexture | ImageBitmap;
	protected enteringSlide: WebGLTexture | ImageBitmap;

	constructor(transitionParameters: TransitionParameters) {
		this.transitionParameters = transitionParameters;
		this.leavingSlide = transitionParameters.current;
		this.enteringSlide = transitionParameters.next;
		this.isFinished = false;
	}

	public abstract start(): void;

	public end(): void {
		if (this.isFinished) return;
		this.isFinished = true;
	}

	public perform(nT: number): boolean {
		if (this.isFinished) return false;
		requestAnimationFrame(this.render.bind(this, nT));
	}

	protected abstract render(nT: number): void;

	public getUnderlyingValue(): number {
		return 0.0;
	}
}
