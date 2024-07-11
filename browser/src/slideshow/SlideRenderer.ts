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

class SlideRenderer {
	public _context: RenderContext = null;
	private _program: WebGLProgram = null;
	private _vao: WebGLVertexArrayObject = null;
	public _slideTexture: WebGLTexture;
	private _canvas: HTMLCanvasElement;

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

				uniform sampler2D slideTexture;

				in vec2 v_texCoord;
				out vec4 outColor;

				void main() {
					outColor = texture(slideTexture, v_texCoord);
				}
				`;
	}

	public setupPositions() {
		const gl = this._context.gl;

		const positions = new Float32Array([
			-1.0, -1.0, 0, 0, 1, 1.0, -1.0, 0, 1, 1, -1.0, 1.0, 0, 0, 0, 1.0, 1.0, 0,
			1, 0,
		]);

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

		this._vao = gl.createVertexArray();
		gl.bindVertexArray(this._vao);

		const positionLocation = gl.getAttribLocation(this._program, 'a_position');

		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 5 * 4, 0);

		const texCoordLocation = gl.getAttribLocation(this._program, 'a_texCoord');

		gl.enableVertexAttribArray(texCoordLocation);
		gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 5 * 4, 3 * 4);
	}

	public setup(canvas: HTMLCanvasElement) {
		this._context = new RenderContext(canvas);
		this._canvas = canvas;

		const vertexShader = this._context.createVertexShader(
			this.getVertexShader(),
		);
		const fragmentShader = this._context.createFragmentShader(
			this.getFragmentShader(),
		);

		this._program = this._context.createProgram(vertexShader, fragmentShader);

		this.setupPositions();
		this._context.gl.useProgram(this._program);
	}

	public createTexture(image: ImageBitmap) {
		return this._context.loadTexture(<any>image);
	}

	public renderFrame(currentSlideTexture: WebGLTexture) {
		this._slideTexture = currentSlideTexture;
		requestAnimationFrame(this.render.bind(this));
	}

	private render() {
		const gl = this._context.gl;
		gl.viewport(0, 0, this._canvas.width, this._canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(this._program);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._slideTexture);
		gl.uniform1i(gl.getUniformLocation(this._program, 'slideTexture'), 0);

		gl.bindVertexArray(this._vao);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}
