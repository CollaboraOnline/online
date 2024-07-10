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

enum VenetianSubType {
	HORIZONTAL,
	VERTICAL,
}

class VenetianTransition extends Transition2d {
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
		this.gl.uniform2fv(this.gl.getUniformLocation(this.program, 'resolution'), [
			this.canvas.width,
			this.canvas.height,
		]);
	}

	public start(): void {
		const transitionSubType =
			stringToTransitionSubTypeMap[this.slideInfo.transitionSubtype];

		if (transitionSubType == TransitionSubType.HORIZONTAL) {
			this.direction = VenetianSubType.HORIZONTAL;
		} else {
			this.direction = VenetianSubType.VERTICAL;
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
                uniform vec2 resolution;
                uniform int direction;

                in vec2 v_texCoord;
                out vec4 outColor;

                void main() {
                    vec2 uv = v_texCoord;
                    float progress = time;

                    float numBlinds = 6.0;

                    float blindSize = (direction == 1) ? resolution.x / numBlinds : resolution.y / numBlinds;

                    float position = (direction == 1) ? mod(uv.x * resolution.x, blindSize) : mod(uv.y * resolution.y, blindSize);

                    float mask = step(progress, position / blindSize);

                    vec4 color1 = texture(leavingSlideTexture, uv);
                    vec4 color2 = texture(enteringSlideTexture, uv);

                    outColor = mix(color2, color1, mask);
                }
                `;
	}
}

SlideShow.VenetianTransition = VenetianTransition;
