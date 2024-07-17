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

enum OvalSubType {
	HORIZONTAL,
	VERTICAL,
}

class OvalTransition extends Transition2d {
	private direction: number = 0;

	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	public start(): void {
		const transitionSubType =
			stringToTransitionSubTypeMap[this.slideInfo.transitionSubtype];
		if (transitionSubType == TransitionSubType.HORIZONTAL) {
			this.direction = OvalSubType.HORIZONTAL;
		} else if (transitionSubType == TransitionSubType.VERTICAL) {
			this.direction = OvalSubType.VERTICAL;
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

                    if (direction == 1) {
                        dist.x *= 2.0;
                    } else {
                        dist.y *= 2.0;
                    }

                    float size = progress * 1.2;

                    float mask = step(length(dist), size);

                    mask = min(mask, 1.0);

                    vec4 color1 = texture(leavingSlideTexture, uv);
                    vec4 color2 = texture(enteringSlideTexture, uv);

                    outColor = mix(color1, color2, mask);
                }
                `;
	}
	// jscpd:ignore-end
}

SlideShow.OvalTransition = OvalTransition;
