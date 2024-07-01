/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class Transition2d {
	public canvas: HTMLCanvasElement;
	public gl: WebGL2RenderingContext;
	public program: WebGLProgram;
	public animationTime: number = 1500;
	private vao!: WebGLVertexArrayObject | null;
	private textures: WebGLTexture[];
	private time: number;
	private startTime: number | null;

	constructor(
		canvas: HTMLCanvasElement,
		vertexShaderSource: string,
		fragmentShaderSource: string,
		image1: HTMLImageElement,
		image2: HTMLImageElement,
	) {
		this.canvas = canvas;
		this.gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext;
		if (!this.gl) {
			console.error('WebGL2 not supported');
			throw new Error('WebGL2 not supported');
		}

		const vertexShader = this.createShader(
			this.gl.VERTEX_SHADER,
			vertexShaderSource,
		);
		const fragmentShader = this.createShader(
			this.gl.FRAGMENT_SHADER,
			fragmentShaderSource,
		);
		this.program = this.createProgram(vertexShader, fragmentShader);

		this.textures = this.loadTextures([image1, image2]);
		this.time = 0;
		this.startTime = null;
	}

	public prepareTransition(): void {
		this.initBuffers();
		this.initUniforms();
	}

	public startTransition(): void {
		this.startTime = performance.now();
		requestAnimationFrame(this.render.bind(this));
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

	public initUniforms(): void {
		this.gl.useProgram(this.program);
	}

	public render(): void {
		if (!this.startTime) this.startTime = performance.now();
		this.time =
			(performance.now() - this.startTime) /
			(this.animationTime > 0 ? this.animationTime : 1500);

		this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);

		this.gl.useProgram(this.program);
		this.gl.uniform1f(
			this.gl.getUniformLocation(this.program, 'time'),
			this.time,
		);

		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[0]);
		this.gl.uniform1i(
			this.gl.getUniformLocation(this.program, 'leavingSlideTexture'),
			0,
		);

		this.gl.activeTexture(this.gl.TEXTURE1);
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[1]);
		this.gl.uniform1i(
			this.gl.getUniformLocation(this.program, 'enteringSlideTexture'),
			1,
		);

		this.renderUniformValue();

		this.gl.bindVertexArray(this.vao);
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

		if (this.time < 1) {
			requestAnimationFrame(this.render.bind(this));
		} else {
			console.log('Transition completed');
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public renderUniformValue(): void {}

	private loadTextures(images: HTMLImageElement[]): WebGLTexture[] {
		return images.map((image, index) => {
			const texture = this.gl.createTexture();
			if (!texture) {
				throw new Error('Failed to create texture');
			}
			this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
			this.gl.texImage2D(
				this.gl.TEXTURE_2D,
				0,
				this.gl.RGBA,
				this.gl.RGBA,
				this.gl.UNSIGNED_BYTE,
				image,
			);
			this.gl.texParameteri(
				this.gl.TEXTURE_2D,
				this.gl.TEXTURE_MIN_FILTER,
				this.gl.LINEAR,
			);
			this.gl.texParameteri(
				this.gl.TEXTURE_2D,
				this.gl.TEXTURE_WRAP_S,
				this.gl.CLAMP_TO_EDGE,
			);
			this.gl.texParameteri(
				this.gl.TEXTURE_2D,
				this.gl.TEXTURE_WRAP_T,
				this.gl.CLAMP_TO_EDGE,
			);
			console.log(`Texture ${index + 1} loaded:`, image.src);
			return texture;
		});
	}

	public createShader(type: number, source: string): WebGLShader {
		const shader = this.gl.createShader(type);
		if (!shader) {
			throw new Error('Failed to create shader');
		}
		this.gl.shaderSource(shader, source);
		this.gl.compileShader(shader);
		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
			const info = this.gl.getShaderInfoLog(shader);
			this.gl.deleteShader(shader);
			throw new Error(`Could not compile shader: ${info}`);
		}
		console.log(
			'Shader compiled successfully:',
			type === this.gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT',
		);
		return shader;
	}

	public createProgram(
		vertexShader: WebGLShader,
		fragmentShader: WebGLShader,
	): WebGLProgram {
		const program = this.gl.createProgram();
		if (!program) {
			throw new Error('Failed to create program');
		}
		this.gl.attachShader(program, vertexShader);
		this.gl.attachShader(program, fragmentShader);
		this.gl.linkProgram(program);
		if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
			const info = this.gl.getProgramInfoLog(program);
			this.gl.deleteProgram(program);
			throw new Error(`Could not link program: ${info}`);
		}
		console.log('Program linked successfully');
		return program;
	}
}
