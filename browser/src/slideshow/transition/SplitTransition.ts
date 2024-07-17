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

class SplitTransition extends Transition2d {
	private direction: number = 0;

	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	public start(): void {
		const transitionSubType =
			stringToTransitionSubTypeMap[this.slideInfo.transitionSubtype];

		if (
			transitionSubType == TransitionSubType.HORIZONTAL &&
			this.slideInfo.transitionDirection == false
		) {
			this.direction = SplitSubType.HORIZONTALIN;
		} else if (
			transitionSubType == TransitionSubType.HORIZONTAL &&
			this.slideInfo.transitionDirection == true
		) {
			this.direction = SplitSubType.HORIZONTALOUT;
		} else if (
			transitionSubType == TransitionSubType.VERTICAL &&
			this.slideInfo.transitionDirection == false
		) {
			this.direction = SplitSubType.VERTICALIN;
		} else if (
			transitionSubType == TransitionSubType.VERTICAL &&
			this.slideInfo.transitionDirection == true
		) {
			this.direction = SplitSubType.VERTICALOUT;
		}
		this.startTransition();
	}

	// jscpd:ignore-start
	public renderUniformValue(): void {
		this.gl.uniform1i(
			this.gl.getUniformLocation(this.program, 'direction'),
			this.direction,
		);
	}

	public getFragmentShader(): string {
		return `#version 300 es
                precision mediump float;

                uniform sampler2D leavingSlideTexture;
                uniform sampler2D enteringSlideTexture;
                uniform float time;
                uniform int direction;

                in vec2 v_texCoord;
                out vec4 outColor;

                void main() {
                    vec2 uv = v_texCoord;
                    float progress = time;

                    vec2 center = vec2(0.5, 0.5);

                    vec2 dist = abs(uv - center);

                    float size = (direction == 1 || direction == 3) ? progress * 1.5 : (1.0 - progress * 1.5);

                    float mask = (direction == 0 || direction == 1 ) ? step(dist.y, size / 2.0) : step(dist.x, size / 2.0);

                    mask = min(mask, 1.0);

                    vec4 color1 = texture(leavingSlideTexture, uv);
                    vec4 color2 = texture(enteringSlideTexture, uv);

                    outColor = (direction == 1 || direction == 3) ? mix(color1, color2, mask) : mix(color2, color1, mask);
                }
                `;
	}
	// jscpd:ignore-end
}

SlideShow.SplitTransition = SplitTransition;
