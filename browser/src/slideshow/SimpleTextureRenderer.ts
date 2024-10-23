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

abstract class SimpleTextureRenderer {
	protected gl: WebGL2RenderingContext;
	protected program: WebGLProgram;
	protected vao!: WebGLVertexArrayObject | null;
	protected context: RenderContextGl;
	protected positionBuffer: WebGLBuffer;

	constructor(canvasContext: RenderContextGl, createProgram: boolean = true) {
		this.context = canvasContext;
		this.gl = this.context.getGl();

		if (createProgram) this.createProgram();
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	protected initProgramTemplateParams(): void {}

	protected createProgram() {
		this.initProgramTemplateParams();

		const vertexShaderSource = this.getVertexShader();
		const fragmentShaderSource = this.getFragmentShader();

		const vertexShader = this.context.createVertexShader(vertexShaderSource);
		const fragmentShader =
			this.context.createFragmentShader(fragmentShaderSource);

		this.program = this.context.createProgram(vertexShader, fragmentShader);
	}

	protected getVertexShader(): string {
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

	protected abstract getFragmentShader(): string;

	protected prepareTransition(): void {
		this.initBuffers();
		this.initUniforms();
	}

	protected initUniforms(): void {
		this.gl.useProgram(this.program);
		// Add more uniform here if needed.
	}

	private initBuffers(): void {
		const positions = new Float32Array([
			...[-1.0, -1.0, 0, 0, 1],
			...[1.0, -1.0, 0, 1, 1],
			...[-1.0, 1.0, 0, 0, 0],
			...[1.0, 1.0, 0, 1, 0],
		]);

		this.positionBuffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
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

		if (positionLocation !== -1) {
			this.gl.enableVertexAttribArray(positionLocation);
			this.gl.vertexAttribPointer(
				positionLocation,
				3,
				this.gl.FLOAT,
				false,
				5 * 4,
				0,
			);
		}
		if (texCoordLocation !== -1) {
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
	}

	public abstract render(nT: number): void;
}

// handle animation timing too
abstract class TextureAnimationBase extends SimpleTextureRenderer {
	protected time: number = 0;
	protected startTime: number | null = null;

	constructor(canvasContext: RenderContextGl) {
		super(canvasContext);
	}

	public abstract render(): void;
}
