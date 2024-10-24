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

class VideoRenderInfo {
	private texture: WebGLTexture | ImageBitmap = null;
	public videoElement: HTMLVideoElement;
	private vao: WebGLVertexArrayObject = null;
	public pos2d: number[];
	public playing: boolean;

	public getTexture(): WebGLTexture {
		return this.texture;
	}

	public replaceTexture(context: RenderContext, newtexture: WebGLTexture) {
		context.deleteTexture(this.texture);
		this.texture = newtexture;
	}

	public getVao(): WebGLVertexArrayObject {
		return this.vao;
	}

	public replaceVao(context: RenderContext, newVao: WebGLVertexArrayObject) {
		context.deleteVertexArray(this.vao);
		this.vao = newVao;
	}

	public deleteResources(context: RenderContext) {
		this.replaceTexture(context, null);
		this.replaceVao(context, null);
	}
}

abstract class SlideRenderer {
	public _context: RenderContext = null;
	protected _slideTexture: WebGLTexture | ImageBitmap;
	protected _videos: VideoRenderInfo[] = [];
	protected _canvas: HTMLCanvasElement;
	protected _renderedSlideIndex: number = undefined;
	protected _requestAnimationFrameId: number = null;
	protected _isAnyVideoPlaying: boolean = false;
	private _activeLayers: Set<string> = new Set();

	constructor(canvas: HTMLCanvasElement) {
		this._canvas = canvas;
	}

	public get lastRenderedSlideIndex() {
		return this._renderedSlideIndex;
	}

	public getSlideTexture(): WebGLTexture {
		return this._slideTexture;
	}

	public getSlideImage(): ImageBitmap {
		return this._slideTexture as ImageBitmap;
	}

	public getAnimatedSlideImage(): ImageBitmap {
		const presenter: SlideShowPresenter = app.map.slideShowPresenter;
		return presenter._slideCompositor.getAnimatedSlide(
			this._renderedSlideIndex,
		);
	}

	public abstract deleteResources(): void;

	public get isAnyVideoPlaying(): boolean {
		return this._isAnyVideoPlaying;
	}
	protected setupVideo(
		videoRenderInfo: VideoRenderInfo,
		url: string,
	): HTMLVideoElement {
		const video = document.createElement('video');

		video.playsInline = true;
		video.loop = true;

		video.addEventListener(
			'playing',
			() => {
				videoRenderInfo.playing = true;
				if (!this._isAnyVideoPlaying) {
					this._isAnyVideoPlaying = true;
					this._requestAnimationFrameId = requestAnimationFrame(
						this.render.bind(this),
					);
				}
			},
			true,
		);

		video.addEventListener(
			'pause',
			() => {
				videoRenderInfo.playing = false;
				for (const videoInfo of this._videos) {
					if (videoInfo.playing) return;
				}
				cancelAnimationFrame(this._requestAnimationFrameId);
				this._isAnyVideoPlaying = false;
			},
			true,
		);

		video.src = url;
		video.play();
		return video;
	}

	public renderSlide(
		currentSlideTexture: WebGLTexture | ImageBitmap,
		slideInfo: SlideInfo,
		docWidth: number,
		docHeight: number,
	) {
		this.deleteCurrentSlideTexture();
		this._activeLayers.clear();
		this._renderedSlideIndex = slideInfo.indexInSlideShow;
		this._slideTexture = currentSlideTexture;
		this.prepareVideos(slideInfo, docWidth, docHeight);
		requestAnimationFrame(this.render.bind(this));
	}

	public pauseVideos() {
		for (var videoRenderInfo of this._videos) {
			videoRenderInfo.videoElement.pause();
		}
	}

	protected getDocumentPositions(
		x: number,
		y: number,
		width: number,
		height: number,
		docWidth: number,
		docHeight: number,
	): number[] {
		var xMin = x / docWidth;
		var xMax = (x + width) / docWidth;

		var yMin = y / docHeight;
		var yMax = (y + height) / docHeight;

		return [xMin, xMax, yMin, yMax];
	}

	public abstract createTexture(
		image: ImageBitmap,
		isMipMapEnable?: boolean,
	): WebGLTexture | ImageBitmap;

	public abstract deleteCurrentSlideTexture(): void;

	protected abstract prepareVideos(
		slideInfo: SlideInfo,
		docWidth: number,
		docHeight: number,
	): void;

	protected abstract render(): void;

	public createEmptyTexture(): WebGLTexture | ImageBitmap {
		return null;
	}

	public createTransparentTexture(): WebGLTexture | ImageBitmap {
		return null;
	}

	public notifyAnimationStarted(sId: string) {
		const isAnyLayerActive = this.isAnyLayerActive();
		this._activeLayers.add(sId);
		if (!isAnyLayerActive) {
			this._requestAnimationFrameId = requestAnimationFrame(
				this.render.bind(this),
			);
		}
	}

	public notifyAnimationEnded(sId: string) {
		this._activeLayers.delete(sId);
	}

	public isAnyLayerActive(): boolean {
		return this._activeLayers.size > 0;
	}
}

class SlideRenderer2d extends SlideRenderer {
	constructor(canvas: HTMLCanvasElement) {
		super(canvas);
		this._context = new RenderContext2d(canvas);
	}

	public createTexture(image: ImageBitmap, isMipMapsEnable: boolean = false) {
		return image;
	}

	public deleteCurrentSlideTexture(): void {
		return;
	}

	public deleteResources(): void {
		return;
	}

	protected prepareVideos(
		slideInfo: SlideInfo,
		docWidth: number,
		docHeight: number,
	) {
		this.pauseVideos();
		this._videos = [];
		if (slideInfo?.videos !== undefined) {
			for (var videoInfo of slideInfo.videos) {
				const video = new VideoRenderInfo();
				video.videoElement = this.setupVideo(video, videoInfo.url);
				video.pos2d = this.getDocumentPositions(
					videoInfo.x,
					videoInfo.y,
					videoInfo.width,
					videoInfo.height,
					docWidth,
					docHeight,
				);
				this._videos.push(video);
			}
		}
	}

	protected render() {
		const gl = this._context.get2dGl();
		gl.clearRect(0, 0, gl.canvas.width, gl.canvas.height);

		const slideImage = this.getAnimatedSlideImage();
		app.map.fire('newslideshowframe', {
			frame: slideImage,
		});
		const width = slideImage.width;
		const height = slideImage.height;

		gl.drawImage(slideImage, 0, 0);

		for (var video of this._videos) {
			gl.drawImage(
				video.videoElement,
				video.pos2d[0] * width,
				video.pos2d[2] * height,
				video.pos2d[1] * width - video.pos2d[0] * width,
				video.pos2d[3] * height - video.pos2d[2] * height,
			);
		}

		gl.setTransform(1, 0, 0, 1, 0, 0);

		if (this.isAnyLayerActive() || this._isAnyVideoPlaying) {
			this._requestAnimationFrameId = requestAnimationFrame(
				this.render.bind(this),
			);
		}
	}
}

class SlideRendererGl extends SlideRenderer {
	private _program: WebGLProgram = null;
	private _vao: WebGLVertexArrayObject = null;

	constructor(canvas: HTMLCanvasElement) {
		super(canvas);
		this._context = new RenderContextGl(canvas);

		const vertexShader = this._context.createVertexShader(
			this.getVertexShader(),
		);
		const fragmentShader = this._context.createFragmentShader(
			this.getFragmentShader(),
		);

		this._program = this._context.createProgram(vertexShader, fragmentShader);

		this._vao = this.setupPositions(-1.0, 1.0, 1.0, -1.0);
		this._context.getGl().useProgram(this._program);
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

				uniform sampler2D slideTexture;

				in vec2 v_texCoord;
				out vec4 outColor;

				void main() {
					outColor = texture(slideTexture, v_texCoord);
				}
				`;
	}

	private updateTexture(
		texture: WebGLTexture,
		video: HTMLVideoElement | ImageBitmap,
	) {
		const gl = this._context.getGl();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
	}

	public setupPositions(
		xMin: number,
		xMax: number,
		yMin: number,
		yMax: number,
	): WebGLVertexArrayObject {
		if (this._context.is2dGl()) return;

		const gl = this._context.getGl();

		// 5 numbers -> 3 x vertex X,Y,Z and 2x texture X,Y
		const positions = new Float32Array([
			//    vX    vY   vZ   tX   tY
			...[xMin, -yMin, 0.0, 0.0, 1.0],
			...[xMax, -yMin, 0.0, 1.0, 1.0],
			...[xMin, -yMax, 0.0, 0.0, 0.0],
			...[xMax, -yMax, 0.0, 1.0, 0.0],
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

	private getNextTexture(): WebGLTexture {
		const slideImage = this.getAnimatedSlideImage();
		app.map.fire('newslideshowframe', {
			frame: slideImage,
		});
		this.updateTexture(this._slideTexture, slideImage);
		return this._slideTexture;
	}

	public createTexture(image: ImageBitmap, isMipMapsEnable: boolean = false) {
		return this._context.loadTexture(<any>image, isMipMapsEnable);
	}

	public createEmptyTexture(): WebGLTexture | ImageBitmap {
		return this._context.createEmptySlide();
	}

	public createTransparentTexture(): WebGLTexture | ImageBitmap {
		return this._context.createTransparentTexture();
	}

	public deleteCurrentSlideTexture(): void {
		this._context.deleteTexture(this._slideTexture);
		this._slideTexture = null;
	}

	public deleteResources(): void {
		this.pauseVideos();
		for (var videoRenderInfo of this._videos) {
			videoRenderInfo.deleteResources(this._context);
		}
		this.deleteCurrentSlideTexture();
	}

	private initTexture() {
		const gl = this._context.getGl();
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);

		const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			pixel,
		);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

		return texture;
	}

	public prepareVideos(
		slideInfo: SlideInfo,
		docWidth: number,
		docHeight: number,
	) {
		this.pauseVideos();
		this._videos = [];
		if (slideInfo.videos !== undefined) {
			for (var videoInfo of slideInfo.videos) {
				const video = new VideoRenderInfo();
				video.videoElement = this.setupVideo(video, videoInfo.url);

				video.replaceTexture(this._context, this.initTexture());
				video.replaceVao(
					this._context,
					this.setupRectangleInDocumentPositions(
						videoInfo.x,
						videoInfo.y,
						videoInfo.width,
						videoInfo.height,
						docWidth,
						docHeight,
					),
				);
				this._videos.push(video);
			}
		}
	}

	setupRectangleInDocumentPositions(
		x: number,
		y: number,
		width: number,
		height: number,
		docWidth: number,
		docHeight: number,
	): WebGLVertexArrayObject {
		const positions = this.getDocumentPositions(
			x,
			y,
			width,
			height,
			docWidth,
			docHeight,
		);
		return this.setupPositions(
			positions[0] * 2.0 - 1.0,
			positions[1] * 2.0 - 1.0,
			positions[2] * 2.0 - 1.0,
			positions[3] * 2.0 - 1.0,
		);
	}

	protected render() {
		console.debug('SlideRendererGl.render');
		const gl = this._context.getGl();
		gl.viewport(0, 0, this._canvas.width, this._canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(this._program);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.getNextTexture());
		gl.uniform1i(gl.getUniformLocation(this._program, 'slideTexture'), 0);

		gl.bindVertexArray(this._vao);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		for (var video of this._videos) {
			if (video.playing && video.videoElement.currentTime > 0) {
				gl.bindVertexArray(video.getVao());
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				this.updateTexture(video.getTexture(), video.videoElement);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			}
		}

		if (this.isAnyLayerActive() || this._isAnyVideoPlaying)
			this._requestAnimationFrameId = requestAnimationFrame(
				this.render.bind(this),
			);
	}
}
