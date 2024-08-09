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

enum DiagonalSubType {
	BOTTOMLEFT,
	TOPLEFT,
	TOPRIGHT,
	BOTTOMRIGHT,
}

class DiagonalTransition extends Transition2d {
	private direction: number = 0;

	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	public start(): void {
		const transitionSubType =
			stringToTransitionSubTypeMap[this.slideInfo.transitionSubtype];

		if (
			transitionSubType == TransitionSubType.HORIZONTALRIGHT &&
			!this.slideInfo.transitionDirection
		) {
			this.direction = DiagonalSubType.BOTTOMLEFT;
		} else if (
			transitionSubType == TransitionSubType.HORIZONTALLEFT &&
			!this.slideInfo.transitionDirection
		) {
			this.direction = DiagonalSubType.BOTTOMRIGHT;
		} else if (transitionSubType == TransitionSubType.HORIZONTALRIGHT) {
			this.direction = DiagonalSubType.TOPRIGHT;
		} else {
			this.direction = DiagonalSubType.TOPLEFT;
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
					float u_steps = 10.0f;
					vec4 color1 = texture(leavingSlideTexture, v_texCoord);
					vec4 color2 = texture(enteringSlideTexture, v_texCoord);

					float yStep;
					float xCoord;
					float adjustedTime;

					if(direction == 0 || direction == 1) {
						xCoord = v_texCoord.x;
						yStep = direction == 0 ? floor(v_texCoord.y * u_steps) / u_steps : 1.0f - floor(v_texCoord.y * u_steps) / u_steps;
					} else {
						xCoord = 1.0f - v_texCoord.x;
						yStep = direction == 2 ? 1.0f - floor(v_texCoord.y * u_steps) / u_steps : floor(v_texCoord.y * u_steps) / u_steps;
					}

					float stepDelay = 1.0f;
					adjustedTime = (time * 2.0f) - (1.0f - yStep) * stepDelay;

					float stepWidth = 1.0f;
					float threshold = step(xCoord * stepWidth, adjustedTime);

					outColor = mix(color1, color2, threshold);
				}`;
	}
	// jscpd:ignore-end
}

SlideShow.DiagonalTransition = DiagonalTransition;
