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

abstract class TransitionBase {
	public canvas: HTMLCanvasElement;
	public gl: WebGL2RenderingContext;
	public program: WebGLProgram;
	public animationTime: number = 1500;
	public vao!: WebGLVertexArrayObject | null;
	public time: number;
	public startTime: number | null;
	public context: any;
	public transitionParameters: TransitionParameters;
	public slideInfo: SlideInfo = null;
	public skip: boolean = false;

	constructor(transitionParameters: TransitionParameters) {
		this.transitionParameters = transitionParameters;
		this.context = transitionParameters.context;
		this.gl = transitionParameters.context.getGl();
		this.slideInfo = transitionParameters.slideInfo;
		this.animationTime =
			this.slideInfo?.transitionDuration > 0
				? this.slideInfo.transitionDuration
				: 2000;

		this.time = 0;
		this.startTime = null;

		this.prepareProgram();
		this.prepareTransition();
	}

	abstract getVertexShader(): string;
	abstract getFragmentShader(): string;
	abstract render(): void;

	public prepareProgram() {
		const vertexShaderSource = this.getVertexShader();
		const fragmentShaderSource = this.getFragmentShader();

		const vertexShader = this.context.createVertexShader(vertexShaderSource);
		const fragmentShader =
			this.context.createFragmentShader(fragmentShaderSource);

		this.program = this.context.createProgram(vertexShader, fragmentShader);
	}

	public prepareTransition(): void {
		this.initBuffers();
		this.initUniforms();
	}

	public initUniforms(): void {
		this.gl.useProgram(this.program);
		// Add more uniform here if needed.
	}

	public initBuffers(): void {
		const positions = new Float32Array([
			...[-1.0, -1.0, 0, 0, 1],
			...[1.0, -1.0, 0, 1, 1],
			...[-1.0, 1.0, 0, 0, 0],
			...[1.0, 1.0, 0, 1, 0],
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

	public startTransition(): void {
		this.startTime = performance.now();
		this.skip = false;
		app.map.on('skipanimation', this.onSkipRequest, this);
		app.map.fire('animationstatechanged', { isPlaying: true });
		requestAnimationFrame(this.render.bind(this));
	}

	public start(): void {
		this.startTransition();
	}

	public finishTransition(): void {
		app.map.off('skipanimation', this.onSkipRequest, this);
		app.map.fire('animationstatechanged', { isPlaying: false });
		this.transitionParameters.callback();
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

	public onSkipRequest() {
		this.skip = true;
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public renderUniformValue(): void {}
}

class Transition2d extends TransitionBase {
	constructor(transitionParameters: TransitionParameters) {
		super(transitionParameters);
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

		if (!this.skip && this.time < 1) {
			requestAnimationFrame(this.render.bind(this));
		} else {
			this.finishTransition();
		}
	}
}

SlideShow.TransitionBase = TransitionBase;
SlideShow.Transition2d = Transition2d;
