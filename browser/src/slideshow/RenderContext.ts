/** */

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

abstract class RenderContext {
	public canvas: HTMLCanvasElement;
	protected gl: WebGL2RenderingContext | CanvasRenderingContext2D;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
	}

	public getGl(): WebGL2RenderingContext {
		return this.gl as WebGL2RenderingContext;
	}
	public get2dGl(): CanvasRenderingContext2D {
		return this.gl as CanvasRenderingContext2D;
	}

	public abstract is2dGl(): boolean;

	public abstract loadTexture(
		image: HTMLImageElement,
	): WebGLTexture | ImageBitmap;

	public abstract createVertexShader(source: string): WebGLShader;

	public abstract createFragmentShader(source: string): WebGLShader;

	public abstract createShader(type: number, source: string): WebGLShader;

	public abstract createProgram(
		vertexShader: WebGLShader,
		fragmentShader: WebGLShader,
	): WebGLProgram;
}

class RenderContextGl extends RenderContext {
	constructor(canvas: HTMLCanvasElement) {
		super(canvas);
		this.gl = this.canvas.getContext('webgl2') as WebGL2RenderingContext;
		if (!this.gl) {
			console.error('WebGL2 not supported');
			throw new Error('WebGL2 not supported');
		}
	}

	public is2dGl(): boolean {
		return false;
	}

	public loadTexture(image: HTMLImageElement): WebGLTexture | ImageBitmap {
		const gl = this.getGl();

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
		return this.createShader(this.getGl().VERTEX_SHADER, source);
	}

	public createFragmentShader(source: string): WebGLShader {
		return this.createShader(this.getGl().FRAGMENT_SHADER, source);
	}

	public createShader(type: number, source: string): WebGLShader {
		const gl = this.getGl();
		const shader = gl.createShader(type);
		if (!shader) {
			throw new Error('Failed to create shader');
		}
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const info = gl.getShaderInfoLog(shader);
			gl.deleteShader(shader);
			throw new Error(`Could not compile shader: ${info}`);
		}
		console.log(
			'Shader compiled successfully:',
			type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT',
		);
		return shader;
	}

	public createProgram(
		vertexShader: WebGLShader,
		fragmentShader: WebGLShader,
	): WebGLProgram {
		const gl = this.getGl();
		const program = gl.createProgram();
		if (!program) {
			throw new Error('Failed to create program');
		}
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const info = gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			throw new Error(`Could not link program: ${info}`);
		}
		console.log('Program linked successfully');
		return program;
	}
}

class RenderContext2d extends RenderContext {
	constructor(canvas: HTMLCanvasElement) {
		super(canvas);

		this.gl = this.canvas.getContext('2d') as CanvasRenderingContext2D;
		if (!this.gl) {
			console.error('Canvas rendering not supported');
			throw new Error('Canvas rendering not supported');
		}
	}

	public is2dGl(): boolean {
		return true;
	}

	public loadTexture(image: HTMLImageElement): WebGLTexture | ImageBitmap {
		return image;
	}

	public createVertexShader(source: string): WebGLShader {
		return null;
	}

	public createFragmentShader(source: string): WebGLShader {
		return null;
	}

	public createShader(type: number, source: string): WebGLShader {
		return null;
	}

	public createProgram(
		vertexShader: WebGLShader,
		fragmentShader: WebGLShader,
	): WebGLProgram {
		return null;
	}
}
