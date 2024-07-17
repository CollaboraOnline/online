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
	public current: WebGLTexture = null;
	public next: WebGLTexture = null;
	public slideInfo: SlideInfo = null;
	public callback: VoidFunction = null;
}

class Transition2d {
	public canvas: HTMLCanvasElement;
	public gl: WebGL2RenderingContext;
	public program: WebGLProgram;
	public animationTime: number = 1500;
	private vao!: WebGLVertexArrayObject | null;
	private time: number;
	private startTime: number | null;
	private transitionParameters: TransitionParameters;
	protected slideInfo: SlideInfo = null;
	private context: any;

	constructor(transitionParameters: TransitionParameters) {
		this.transitionParameters = transitionParameters;
		this.context = transitionParameters.context;
		this.gl = transitionParameters.context.gl;
		this.slideInfo = transitionParameters.slideInfo;
		this.animationTime =
			this.slideInfo?.transitionDuration > 0
				? this.slideInfo.transitionDuration
				: 2000;

		const vertexShaderSource = this.getVertexShader();
		const fragmentShaderSource = this.getFragmentShader();

		const vertexShader = this.context.createVertexShader(vertexShaderSource);
		const fragmentShader =
			this.context.createFragmentShader(fragmentShaderSource);

		this.program = this.context.createProgram(vertexShader, fragmentShader);

		this.time = 0;
		this.startTime = null;

		this.prepareTransition();
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

				void main() {
					vec4 color0 = texture(leavingSlideTexture, v_texCoord);
					vec4 color1 = texture(enteringSlideTexture, v_texCoord);
					outColor = mix(color0, color1, time);
				}
				`;
	}

	public prepareTransition(): void {
		this.initBuffers();
		this.gl.useProgram(this.program);
	}

	public startTransition(): void {
		this.startTime = performance.now();
		requestAnimationFrame(this.render.bind(this));
	}

	public start(): void {
		this.startTransition();
	}

	public initBuffers(): void {
		const positions = new Float32Array([
			-1.0, -1.0, 0, 0, 1, 1.0, -1.0, 0, 1, 1, -1.0, 1.0, 0, 0, 0, 1.0, 1.0, 0,
			1, 0,
		]);

		const buffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

		this.vao = this.gl.createVertexArray();
		this.gl.bindVertexArray(this.vao);

		const positionLocation = this.gl.getAttribLocation(
			this.program,
			'a_position',
		);
		const texCoordLocation = this.gl.getAttribLocation(
			this.program,
			'a_texCoord',
		);

		this.gl.enableVertexAttribArray(positionLocation);
		this.gl.vertexAttribPointer(
			positionLocation,
			3,
			this.gl.FLOAT,
			false,
			5 * 4,
			0,
		);

		this.gl.enableVertexAttribArray(texCoordLocation);
		this.gl.vertexAttribPointer(
			texCoordLocation,
			2,
			this.gl.FLOAT,
			false,
			5 * 4,
			3 * 4,
		);
	}

	public render() {
		if (!this.startTime) this.startTime = performance.now();
		this.time =
			(performance.now() - this.startTime) /
			(this.animationTime > 0 ? this.animationTime : 1500);

		if (this.time > 1) this.time = 1;
		const gl = this.gl;

		gl.viewport(0, 0, this.context.canvas.width, this.context.canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(this.program);
		gl.uniform1f(gl.getUniformLocation(this.program, 'time'), this.time);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.transitionParameters.current);
		gl.uniform1i(gl.getUniformLocation(this.program, 'leavingSlideTexture'), 0);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.transitionParameters.next);
		gl.uniform1i(
			gl.getUniformLocation(this.program, 'enteringSlideTexture'),
			1,
		);

		this.renderUniformValue();

		gl.bindVertexArray(this.vao);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		if (this.time < 1) {
			requestAnimationFrame(this.render.bind(this));
		} else {
			this.transitionParameters.callback();
			console.log('Transition completed');
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public renderUniformValue(): void {}
}

SlideShow.Transition2d = Transition2d;
