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

class SplitTransition extends ClippingTransition {
	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	// jscpd:ignore-start
	protected getMaskFunction(): string {
		const transitionSubType = this.transitionFilterInfo.transitionSubtype;
		const isHorizontalDir = transitionSubType == TransitionSubType.HORIZONTAL;

		// Horizontal Out, Vertical Out
		return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = abs(uv - center);

                    float size = progress * 1.5;

                    float distCoord = ${isHorizontalDir ? 'dist.y' : 'dist.x'};

                    float mask = step(size / 2.0, distCoord);

                    mask = 1.0 - mask;

                    return mask;
                }
		`;
	}
	// jscpd:ignore-end
}

SlideShow.SplitTransition = SplitTransition;
