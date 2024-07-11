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

class RenderContext {
	public canvas: HTMLCanvasElement;
	public gl: WebGL2RenderingContext;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext;
		if (!this.gl) {
			console.error('WebGL2 not supported');
			throw new Error('WebGL2 not supported');
		}
	}

	public loadTexture(image: HTMLImageElement): WebGLTexture {
		const gl = this.gl;

		const texture = gl.createTexture();
		if (!texture) {
			throw new Error('Failed to create texture');
		}
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		console.log(`Texture loaded:`, image.src);
		return texture;
	}

	public createVertexShader(source: string): WebGLShader {
		return this.createShader(this.gl.VERTEX_SHADER, source);
	}

	public createFragmentShader(source: string): WebGLShader {
		return this.createShader(this.gl.FRAGMENT_SHADER, source);
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
