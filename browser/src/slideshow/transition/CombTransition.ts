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

enum CombSubType {
	COMBHORIZONTAL,
	COMBVERTICAL,
}

class CombTransition extends Transition2d {
	private direction: number = 0;

	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	public start(): void {
		const transitionSubType =
			stringToTransitionSubTypeMap[this.slideInfo.transitionSubtype];

		if (transitionSubType == TransitionSubType.COMBVERTICAL) {
			this.direction = CombSubType.COMBVERTICAL;
		} else {
			this.direction = CombSubType.COMBHORIZONTAL;
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
                    const float numTeeth = 20.0;

                    float progress = smoothstep(0.0, 1.0, time);

                    float coord = direction == 1 ? v_texCoord.x : v_texCoord.y;

                    float toothIndex = floor(coord * numTeeth);

                    float moveDirection = mod(toothIndex, 2.0) == 0.0 ? 1.0 : -1.0;

                    float offset = moveDirection * (1.0 - progress);

                    float threshold = moveDirection > 0.0 ?
                        (direction == 1 ? v_texCoord.y : v_texCoord.x) :
                        (direction == 1 ? 1.0 - v_texCoord.y : 1.0 - v_texCoord.x);

                    if (threshold < progress) {
                        outColor = texture(enteringSlideTexture, v_texCoord);
                    } else {
                        vec2 leavingCoord = direction == 1 ?
                            vec2(v_texCoord.x, fract(v_texCoord.y + offset)) :
                            vec2(fract(v_texCoord.x + offset), v_texCoord.y);
                        outColor = texture(leavingSlideTexture, leavingCoord);
                    }
                }`;
	}
	// jscpd:ignore-end
}

SlideShow.CombTransition = CombTransition;
