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

class PlusTransition extends ClippingTransition {
	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	protected getMaskFunction(): string {
		return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = abs(uv - center);

                    float size = (1.0 - progress) * 2.0;

                    float mask = step(dist.x, size / 5.0) + step(dist.y, size / 5.0);

                    mask = 1.0 - min(mask, 1.0);

                    return mask;
                }
		`;
	}
}

SlideShow.PlusTransition = PlusTransition;
