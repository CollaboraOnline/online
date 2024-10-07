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

enum BoxSubType {
	IN,
	OUT,
}

class BoxTransition extends ClippingTransition {
	private direction: number;

	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	protected initProgramTemplateParams() {
		const transitionSubType = this.transitionFilterInfo.transitionSubtype;
		if (
			transitionSubType == TransitionSubType.RECTANGLE &&
			this.transitionFilterInfo.isDirectionForward
		) {
			this.direction = BoxSubType.OUT;
		} else {
			this.direction = BoxSubType.IN;
		}
	}

	// jscpd:ignore-start
	protected getMaskFunction(): string {
		const isInDir = this.direction == BoxSubType.IN;
		return `
                float getMaskValue(vec2 uv, float time) {
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = abs(uv - center);

                    float size = progress * 1.5;
                    ${isInDir ? 'size = 1.0 - size;' : ''}

                    float mask = step(dist.x, size / 2.0) * step(dist.y, size / 2.0);
                    ${isInDir ? 'mask = 1.0 - mask;' : ''}

                    return mask;
                }
		`;
	}
	// jscpd:ignore-end
}

SlideShow.BoxTransition = BoxTransition;
