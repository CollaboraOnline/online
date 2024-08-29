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

// TODO TransitionParameters should be moved to new Transition2d
class TransitionParameters {
	public context: RenderContext = null;
	public current: WebGLTexture | ImageBitmap = null;
	public next: WebGLTexture | ImageBitmap = null;
	public slideInfo: SlideInfo = null;
	public callback: VoidFunction = null;
}

// TODO old Transition2d refactored to a more minimal class: it's still used by
//  CanvasLoader, StaticTextRenderer, PauseTimer, anyhow it should make a bit cleaner
abstract class RendererBase {
	public canvas: HTMLCanvasElement;
	public gl: WebGL2RenderingContext;
	public program: WebGLProgram;
	public vao!: WebGLVertexArrayObject | null;
	public context: any;
	private transitionParameters: TransitionParameters;
	protected slideInfo: SlideInfo = null;
	protected time: number = 0;
	protected startTime: number | null = null;

	constructor(transitionParameters: TransitionParameters) {
		this.transitionParameters = transitionParameters;
		this.context = transitionParameters.context;
		this.gl = transitionParameters.context.getGl();
		this.slideInfo = transitionParameters.slideInfo;

		const vertexShaderSource = this.getVertexShader();
		const fragmentShaderSource = this.getFragmentShader();

		const vertexShader = this.context.createVertexShader(vertexShaderSource);
		const fragmentShader =
			this.context.createFragmentShader(fragmentShaderSource);

		this.program = this.context.createProgram(vertexShader, fragmentShader);
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

	public abstract getFragmentShader(): string;

	public prepareTransition(): void {
		this.initBuffers();
		this.gl.useProgram(this.program);
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

	public abstract render(): void;
}

SlideShow.RendererBase = RendererBase;
