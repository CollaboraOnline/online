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

enum CheckersSubType {
	ACROSS,
	DOWN,
}

class CheckersTransition extends Transition2d {
	private direction: number = 0;

	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	public start(): void {
		const transitionSubType = this.transitionFilterInfo.transitionSubtype;

		if (transitionSubType == TransitionSubType.DOWN) {
			this.direction = CheckersSubType.DOWN;
		} else if (transitionSubType == TransitionSubType.ACROSS) {
			this.direction = CheckersSubType.ACROSS;
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
                uniform int direction; // 1 for vertical, 2 for horizontal

                in vec2 v_texCoord;
                out vec4 outColor;

                void main() {
                    vec2 uv = v_texCoord;

                    float progress = time * 2.0;
                    float numSquares = 8.0;

                    vec2 squareSize = vec2(1.0 / numSquares, 1.0 / numSquares);
                    vec2 checkerCoord = floor(uv / squareSize);

                    bool isWhiteSquare = mod(checkerCoord.x + checkerCoord.y, 2.0) == 0.0;
                    vec2 localUV = fract(uv / squareSize);

                    bool showEntering = false;
                    float adjustedProgress = isWhiteSquare ? progress : progress - 1.0;
                    adjustedProgress = clamp(adjustedProgress, 0.0, 1.0);

                    if (direction == 1) {
                        showEntering = localUV.y < adjustedProgress; // Across
                    } else {
                        showEntering = localUV.x < adjustedProgress; // Down
                    }

                    vec4 color1 = texture(leavingSlideTexture, uv);
                    vec4 color2 = texture(enteringSlideTexture, uv);
                    outColor = mix(color1, color2, float(showEntering));
                }
                `;
	}
	// jscpd:ignore-end
}

SlideShow.CheckersTransition = CheckersTransition;
