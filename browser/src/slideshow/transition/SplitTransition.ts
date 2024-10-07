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

enum SplitSubType {
	HORIZONTALIN,
	HORIZONTALOUT,
	VERTICALIN,
	VERTICALOUT,
}

class SplitTransition extends ClippingTransition {
	private direction: number;

	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	protected initProgramTemplateParams() {
		const transitionSubType = this.transitionFilterInfo.transitionSubtype;

		if (
			transitionSubType == TransitionSubType.HORIZONTAL &&
			this.transitionFilterInfo.isDirectionForward == false
		) {
			this.direction = SplitSubType.HORIZONTALIN;
		} else if (
			transitionSubType == TransitionSubType.HORIZONTAL &&
			this.transitionFilterInfo.isDirectionForward == true
		) {
			this.direction = SplitSubType.HORIZONTALOUT;
		} else if (
			transitionSubType == TransitionSubType.VERTICAL &&
			this.transitionFilterInfo.isDirectionForward == false
		) {
			this.direction = SplitSubType.VERTICALIN;
		} else if (
			transitionSubType == TransitionSubType.VERTICAL &&
			this.transitionFilterInfo.isDirectionForward == true
		) {
			this.direction = SplitSubType.VERTICALOUT;
		}
	}

	// jscpd:ignore-start
	protected getMaskFunction(): string {
		const isHorizontalDir =
			this.direction == SplitSubType.HORIZONTALIN ||
			this.direction == SplitSubType.HORIZONTALOUT;
		const isOutDir =
			this.direction == SplitSubType.HORIZONTALOUT ||
			this.direction == SplitSubType.VERTICALOUT;

		return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = abs(uv - center);

                    float size = ${
											isOutDir ? 'progress * 1.5' : '1.0 - progress * 1.5'
										};

                    float distCoord = ${isHorizontalDir ? 'dist.y' : 'dist.x'};

                    float mask = step(size / 2.0, distCoord);

                    ${isOutDir ? 'mask = 1.0 - mask' : ''};

                    return mask;
                }
		`;
	}
	// jscpd:ignore-end
}

SlideShow.SplitTransition = SplitTransition;
