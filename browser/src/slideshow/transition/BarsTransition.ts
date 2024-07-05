/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class BarsTransition extends Transition2d {
	private direction: number = 0;
	constructor(
		canvas: HTMLCanvasElement,
		image1: HTMLImageElement,
		image2: HTMLImageElement,
	) {
		super(canvas, image1, image2);
		this.prepareTransition();
		this.animationTime = 1500;
	}

	public renderUniformValue(): void {
		this.gl.uniform1i(
			this.gl.getUniformLocation(this.program, 'direction'),
			this.direction,
		);
	}

	public start(direction: number): void {
		this.direction = direction;
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

                    if (direction == 1) {
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
}
