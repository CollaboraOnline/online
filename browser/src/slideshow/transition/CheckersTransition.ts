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
		this.prepareTransition();
	}

	public renderUniformValue(): void {
		this.gl.uniform1i(
			this.gl.getUniformLocation(this.program, 'direction'),
			this.direction,
		);
	}

	public start(): void {
		const transitionSubType =
			stringToTransitionSubTypeMap[this.slideInfo.transitionSubtype];

		if (transitionSubType == TransitionSubType.DOWN) {
			this.direction = CheckersSubType.DOWN;
		} else if (transitionSubType == TransitionSubType.ACROSS) {
			this.direction = CheckersSubType.ACROSS;
		}

		this.startTransition();
	}

	public getVertexShader(): string {
		return `#version 300 es
				in vec4 a_position;
				in vec2 a_texCoord;
				out vec2 v_texCoord;

				void main() {
					gl_Position = a_position;
					v_texCoord = a_texCoord;
				}
				`;
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
}

SlideShow.CheckersTransition = CheckersTransition;
