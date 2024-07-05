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

class CoverTransition extends Transition2d {
	private direction: number = 0;
	constructor(
		canvas: HTMLCanvasElement,
		image1: HTMLImageElement,
		image2: HTMLImageElement,
	) {
		super(canvas, image1, image2);
		this.prepareTransition();
		this.animationTime = 2000;
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

                void main() {
                    vec2 uv = v_texCoord;
                    float progress = time;

                    vec2 leavingUV = uv;
                    vec2 enteringUV = uv;

                    if (direction == 1) {
                        // bottom to top
                        enteringUV = uv + vec2(0.0, -1.0 + progress);
                    } else if (direction == 2) {
                        // left to right
                        enteringUV = uv + vec2(1.0 - progress, 0.0);
                    } else if (direction == 3) {
                        // right to left
                        enteringUV = uv + vec2(-1.0 + progress, 0.0);
                    } else if (direction == 4) {
                        // top to bottom
                        enteringUV = uv + vec2(0.0, 1.0 - progress);
                    } else if (direction == 5) {
                        // bottom left to top right
                        enteringUV = uv + vec2(1.0 - progress, -1.0 + progress);
                    } else if (direction == 6) {
                        // top right to bottom left
                        enteringUV = uv + vec2(-1.0 + progress, 1.0 - progress);
                    } else if (direction == 7) {
                        // top left to bottom right
                        enteringUV = uv + vec2(1.0 - progress, 1.0 - progress);
                    } else if (direction == 8) {
                        // bottom right to top left
                        enteringUV = uv + vec2(-1.0 + progress, -1.0 + progress);
                    }

                    bool showEntering = false;
                    if (direction == 1) {
                        showEntering = uv.y > 1.0 - progress;
                    } else if (direction == 2) {
                        showEntering = uv.x < progress;
                    } else if (direction == 3) {
                        showEntering = uv.x > 1.0 - progress;
                    } else if (direction == 4) {
                        showEntering = uv.y < progress;
                    } else if (direction == 5) {
                        showEntering = uv.x < progress && uv.y > 1.0 - progress;
                    } else if (direction == 6) {
                        showEntering = uv.x > 1.0 - progress && uv.y < progress;
                    } else if (direction == 7) {
                        showEntering = uv.x < progress && uv.y < progress;
                    } else if (direction == 8) {
                        showEntering = uv.x > 1.0 - progress && uv.y > 1.0 - progress;
                    }

                    if (showEntering) {
                        outColor = texture(enteringSlideTexture, enteringUV);
                    } else {
                        outColor = texture(leavingSlideTexture, leavingUV);
                    }
                }
                `;
	}
}
