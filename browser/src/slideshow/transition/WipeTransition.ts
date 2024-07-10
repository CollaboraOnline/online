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

enum WipeSubType {
	LEFTTORIGHT,
	RIGHTTOLEFT,
	TOPTOBOTTOM,
	BOTTOMTOTOP,
}

class WipeTransition extends Transition2d {
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
		if (
			transitionSubType == TransitionSubType.TOPTOBOTTOM &&
			this.slideInfo.transitionDirection
		) {
			this.direction = WipeSubType.TOPTOBOTTOM;
		} else if (
			transitionSubType == TransitionSubType.TOPTOBOTTOM &&
			!this.slideInfo.transitionDirection
		) {
			this.direction = WipeSubType.BOTTOMTOTOP;
		} else if (
			transitionSubType == TransitionSubType.LEFTTORIGHT &&
			this.slideInfo.transitionDirection
		) {
			this.direction = WipeSubType.LEFTTORIGHT;
		} else {
			this.direction = WipeSubType.RIGHTTOLEFT;
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
				uniform int direction; // 0: Left to Right, 1: Right to Left, 2: Top to Bottom, 4: Bottom to Top

				in vec2 v_texCoord;
				out vec4 outColor;

				void main() {
					vec2 uv = v_texCoord;
					float progress = time;

					if (direction == 0) {
						if (uv.x < progress) {
							outColor = texture(enteringSlideTexture, uv);
						} else {
							outColor = texture(leavingSlideTexture, uv);
						}
					} else if (direction == 1) {
						if (uv.x > 1.0 - progress) {
							outColor = texture(enteringSlideTexture, uv);
						} else {
							outColor = texture(leavingSlideTexture, uv);
						}
					} else if (direction == 2) {
						if (uv.y < progress) {
							outColor = texture(enteringSlideTexture, uv);
						} else {
							outColor = texture(leavingSlideTexture, uv);
						}
					} else if (direction == 3) {
						if (uv.y > 1.0 - progress) {
							outColor = texture(enteringSlideTexture, uv);
						} else {
							outColor = texture(leavingSlideTexture, uv);
						}
					}
				}`;
	}
}

SlideShow.WipeTransition = WipeTransition;
