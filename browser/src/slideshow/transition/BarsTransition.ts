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

enum BarsSubType {
	VERTICAL,
	HORIZONTAL,
}

class BarsTransition extends Transition2d {
	private direction: number = 0;

	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	public start(): void {
		const transitionSubType = this.transitionFilterInfo.transitionSubtype;

		if (transitionSubType == TransitionSubType.VERTICAL) {
			this.direction = BarsSubType.VERTICAL;
		} else if (transitionSubType == TransitionSubType.HORIZONTAL) {
			this.direction = BarsSubType.HORIZONTAL;
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

                float random(vec2 co) {
                    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
                }

                void main() {
                    vec2 uv = v_texCoord;
                    float progress = time;

                    float numBars = 70.0;
                    float randValue;

                    if (direction == 0) {
                        // Vertical bars
                        randValue = random(vec2(floor(uv.x * numBars), 0.0));
                    } else {
                        // Horizontal bars
                        randValue = random(vec2(floor(uv.y * numBars), 0.0));
                    }

                    bool showEntering = (randValue < progress);

                    vec4 color1 = texture(leavingSlideTexture, uv);
                    vec4 color2 = texture(enteringSlideTexture, uv);

                    outColor = mix(color1, color2, float(showEntering));
                }
                `;
	}
	// jscpd:ignore-end
}

SlideShow.BarsTransition = BarsTransition;
