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

enum WheelSubType {
	ONEWHEEL = 1,
	TWOWHEEL = 2,
	THREEWHEEL = 3,
	FOURWHEEL = 4,
	EIGHTWHEEL = 8,
}

class WheelTransition extends Transition2d {
	private stocks: number = 0;
	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	public start(): void {
		const transitionSubType =
			stringToTransitionSubTypeMap[this.slideInfo.transitionSubtype];

		if (transitionSubType == TransitionSubType.TWOBLADEVERTICAL) {
			this.stocks = WheelSubType.TWOWHEEL;
		} else if (transitionSubType == TransitionSubType.THREEBLADE) {
			this.stocks = WheelSubType.THREEWHEEL;
		} else if (transitionSubType == TransitionSubType.FOURBLADE) {
			this.stocks = WheelSubType.FOURWHEEL;
		} else if (transitionSubType == TransitionSubType.EIGHTBLADE) {
			this.stocks = WheelSubType.EIGHTWHEEL;
		} else {
			this.stocks = WheelSubType.ONEWHEEL;
		}

		this.startTransition();
	}

	public renderUniformValue(): void {
		this.gl.uniform1i(
			this.gl.getUniformLocation(this.program, 'stocks'),
			this.stocks,
		);
	}

	public getFragmentShader(): string {
		return `#version 300 es
                precision mediump float;

                uniform sampler2D leavingSlideTexture;
                uniform sampler2D enteringSlideTexture;
                uniform float time;
                uniform int stocks; // Number of stocks

                in vec2 v_texCoord;
                out vec4 outColor;

                void main() {
                    vec2 uv = v_texCoord;
                    float angle = atan(uv.y - 0.5, uv.x - 0.5) + 3.14159265359;
                    float slice = 6.28318530718 / float(stocks); // 2 * PI divided by number of stocks
                    float progress = time;

                    if (mod(angle , slice) < slice * progress) {
                        outColor = texture(enteringSlideTexture, uv);
                    } else {
                        outColor = texture(leavingSlideTexture, uv);
                    }
                }
                `;
	}
}

SlideShow.WheelTransition = WheelTransition;
