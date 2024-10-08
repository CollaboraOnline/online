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

class ClippingTransition extends Transition2d {
	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	protected getMaskFunction(): string {
		return '';
	}

	public getFragmentShader(): string {
		const isSlideTransition = !!this.leavingSlide;
		// prettier-ignore
		return `#version 300 es
                precision mediump float;

                ${isSlideTransition
                      ? 'uniform sampler2D leavingSlideTexture;'
                      : ''}
                uniform sampler2D enteringSlideTexture;
                uniform float time;

                in vec2 v_texCoord;
                out vec4 outColor;

                ${this.getMaskFunction()}

                void main() {
                    vec2 uv = v_texCoord;

                    float mask = getMaskValue(uv, time);

                    vec4 color1 = ${
                        isSlideTransition
                          ? 'texture(leavingSlideTexture, uv)'
                          : 'vec4(0, 0, 0, 0)'};
                    vec4 color2 = texture(enteringSlideTexture, uv);

                    outColor = mix(color1, color2, mask);
                }
                `;
	}
}

SlideShow.ClippingTransition = ClippingTransition;
