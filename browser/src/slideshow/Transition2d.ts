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

class TransitionParameters {
	public context: RenderContext = null;
	public current: WebGLTexture | ImageBitmap = null;
	public next: WebGLTexture | ImageBitmap = null;
	public slideInfo: SlideInfo = null;
	public callback: VoidFunction = null;
}

abstract class TransitionBase extends SlideChangeGl {
	protected slideInfo: SlideInfo = null;

	protected constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
		this.slideInfo = transitionParameters.slideInfo;
		this.prepareTransition();
	}

	public startTransition(): void {
		this.time = null;
		this.isLastFrame = false;
		this.requestAnimationFrameId = requestAnimationFrame(
			this.animate.bind(this),
		);
	}

	public start(): void {
		this.startTransition();
	}

	public endTransition(): void {
		this.releaseResources();
		console.debug('Transition completed');
	}

	private releaseResources(): void {
		// Clean up vertex array
		this.gl.bindVertexArray(null);
		if (this.vao) {
			this.gl.deleteVertexArray(this.vao);
			this.vao = null;
		}

		// Unbind
		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, null);

		// Detach and delete shaders from the program
		const attachedShaders = this.gl.getAttachedShaders(this.program);
		if (attachedShaders) {
			attachedShaders.forEach((shader) => {
				this.gl.detachShader(this.program, shader);
				this.gl.deleteShader(shader);
			});
		}

		// Delete the program
		this.gl.deleteProgram(this.program);
		this.program = null;
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public renderUniformValue(): void {}
}

class Transition2d extends TransitionBase {
	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
	}

	protected getFragmentShader(): string {
		return `#version 300 es
				precision mediump float;

				uniform sampler2D leavingSlideTexture;
				uniform sampler2D enteringSlideTexture;
				uniform float time;

				in vec2 v_texCoord;
				out vec4 outColor;

				void main() {
					vec4 color0 = texture(leavingSlideTexture, v_texCoord);
					vec4 color1 = texture(enteringSlideTexture, v_texCoord);
					outColor = mix(color0, color1, time);
				}
				`;
	}

	public render(nT: number) {
		const gl = this.gl;

		gl.viewport(0, 0, this.context.canvas.width, this.context.canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(this.program);
		gl.uniform1f(gl.getUniformLocation(this.program, 'time'), nT);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.leavingSlide);
		gl.uniform1i(gl.getUniformLocation(this.program, 'leavingSlideTexture'), 0);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.enteringSlide);
		gl.uniform1i(
			gl.getUniformLocation(this.program, 'enteringSlideTexture'),
			1,
		);

		this.renderUniformValue();

		gl.bindVertexArray(this.vao);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}

SlideShow.Transition2d = Transition2d;
