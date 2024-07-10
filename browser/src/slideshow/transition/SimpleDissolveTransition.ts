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

class SimpleDissolveTransition extends SlideShow.Transition2d {
	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
		this.prepareTransition();
	}

	public start(): void {
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

				in vec2 v_texCoord;
				out vec4 outColor;

				// generate a pseudo-random value based on coordinates
				float random(vec2 co) {
					return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
				}

				void main() {
					vec2 uv = v_texCoord;

					float progress = time;

					float numSquares = 10.0;

					vec2 squareSize = vec2(1.0 / numSquares, 1.0 / numSquares);

					vec2 checkerCoord = floor(uv / squareSize);

					float randValue = random(checkerCoord);

					bool showEntering = progress > randValue;

					vec4 color1 = texture(leavingSlideTexture, uv);
					vec4 color2 = texture(enteringSlideTexture, uv);

					outColor = mix(color1, color2, float(showEntering));
				}
				`;
	}
}
SlideShow.SimpleDissolveTransition = SimpleDissolveTransition;
