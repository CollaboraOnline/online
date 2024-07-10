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

enum FadeSubType {
	FADEOVERBLACK,
	FADEOVERWHITE,
	SMOOTHLY,
}

class FadeTransition extends SlideShow.Transition2d {
	private effectTransition: number = 0;
	private slideInfo: SlideInfo;

	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
		this.prepareTransition();
	}

	public renderUniformValue(): void {
		this.gl.uniform1i(
			this.gl.getUniformLocation(this.program, 'effectType'),
			this.effectTransition,
		);
	}

	public start(): void {
		const transitionSubType =
			stringToTransitionSubTypeMap[this.slideInfo.transitionSubtype];

		this.effectTransition = FadeSubType.FADEOVERBLACK; // default

		if (transitionSubType == TransitionSubType.CROSSFADE) {
			this.effectTransition = FadeSubType.SMOOTHLY;
		} else if (
			transitionSubType == TransitionSubType.FADEOVERCOLOR &&
			this.slideInfo.transitionDirection
		) {
			this.effectTransition = FadeSubType.FADEOVERWHITE;
		} else {
			this.effectTransition = FadeSubType.FADEOVERBLACK;
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
				uniform int effectType; // 0: Fade through black, 1: Fade through white, 2: Smooth fade

				in vec2 v_texCoord;
				out vec4 outColor;

				void main() {
					vec4 color0 = texture(leavingSlideTexture, v_texCoord);
					vec4 color1 = texture(enteringSlideTexture, v_texCoord);
					vec4 transitionColor;

					if (effectType == 1) {
						// Fade through black
						transitionColor = vec4(0.0, 0.0, 0.0, 1.0);
					} else if (effectType == 2) {
						// Fade through white
						transitionColor = vec4(1.0, 1.0, 1.0, 1.0);
					}
					if (effectType == 3) {
						// Smooth fade
						float smoothTime = smoothstep(0.0, 1.0, time);
						outColor = mix(color0, color1, smoothTime);
					} else {
						if (time < 0.5) {
							outColor = mix(color0, transitionColor, time * 2.0);
						} else {
							outColor = mix(transitionColor, color1, (time - 0.5) * 2.0);
						}
					}
				}
				`;
	}
}

SlideShow.FadeTransition = FadeTransition;
