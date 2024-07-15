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

class VideoRenderInfo {
	public texture: WebGLTexture;
	public videoElement: HTMLVideoElement;
	public vao: WebGLVertexArrayObject;
}

class SlideRenderer {
	public _context: RenderContext = null;
	private _program: WebGLProgram = null;
	private _vao: WebGLVertexArrayObject = null;
	public _slideTexture: WebGLTexture;
	private _videos: VideoRenderInfo[];
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
			-1.0, -1.0, 0.0, 0.0, 1.0,
			 1.0, -1.0, 0.0, 1.0, 1.0,
			-1.0,  1.0, 0.0, 0.0, 0.0,
			 1.0,  1.0, 0.0, 1.0, 0.0,
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

	private setupVideo(url: string) : HTMLVideoElement {
		const video = document.createElement("video");

		video.playsInline = true;
		video.muted = true;
		video.loop = true;

		video.addEventListener("playing", () => {
			// todo
		}, true);

		video.addEventListener("timeupdate", () => {
			// todo
		}, true);

		video.src = url;
		video.play();
		return video;
	}

	private initTexture() {
		const gl = this._context.gl;
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);

		const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

		return texture;
	  }

	  private updateTexture(texture: WebGLTexture, video: HTMLVideoElement) {
		const gl = this._context.gl;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
	  }

	public renderSlide(currentSlideTexture: WebGLTexture, slideInfo: SlideInfo, docWidth: number, docHeight: number) {
		this._slideTexture = currentSlideTexture;
		this._videos = [];
		if (slideInfo.videos !== undefined)
		{
			for (var videoInfo of slideInfo.videos) {
				const video = new VideoRenderInfo;
				video.videoElement = this.setupVideo(videoInfo.url);
				video.texture = this.initTexture();
				video.vao = this.setupVideoPosition(videoInfo.x, videoInfo.y, videoInfo.width, videoInfo.height, docWidth, docHeight);

				this._videos.push(video);
			}
		}
		requestAnimationFrame(this.render.bind(this));
	}

	setupVideoPosition(x: number, y: number, width: number, height: number, docWidth: number, docHeight: number): WebGLVertexArrayObject {
		const gl = this._context.gl;

		var xMin = (x / docWidth) * 2.0 - 1.0;
		var xMax = ((x + width) / docWidth) * 2.0 - 1.0;

		var yMin = (y / docHeight) * 2.0 - 1.0;
		var yMax = ((y + height) / docHeight) * 2.0 - 1.0;

		const positions = new Float32Array([
			xMin, -yMin, 0.0, 0.0, 1.0,
			xMax, -yMin, 0.0, 1.0, 1.0,
			xMin, -yMax, 0.0, 0.0, 0.0,
			xMax, -yMax, 0.0, 1.0, 0.0,
		]);

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

		const vao = gl.createVertexArray();
		gl.bindVertexArray(vao);

		const positionLocation = gl.getAttribLocation(this._program, 'a_position');

		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 5 * 4, 0);

		const texCoordLocation = gl.getAttribLocation(this._program, 'a_texCoord');

		gl.enableVertexAttribArray(texCoordLocation);
		gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 5 * 4, 3 * 4);

		return vao;
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

		for (var video of this._videos) {
			gl.bindVertexArray(video.vao);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			this.updateTexture(video.texture, video.videoElement);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}

		requestAnimationFrame(this.render.bind(this));
	}
}
