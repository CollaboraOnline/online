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

/*
 *
 */

declare var SlideShow: any;

interface LayerRenderer {
	initialize(): void;
	clearCanvas(): void;
	drawBitmap(
		imageInfo: ImageInfo | ImageBitmap,
		properties?: AnimatedElementRenderProperties,
	): void;
	dispose(): void;
	fillColor(slideInfo: SlideInfo): boolean;
	isGlRenderer(): boolean;
}

class LayerRendererGl implements LayerRenderer {
	private static readonly DefaultVertices = [
		-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
	];

	private offscreenCanvas: OffscreenCanvas;
	private gl: WebGLRenderingContext;
	private program: WebGLProgram;
	private positionBuffer: WebGLBuffer;
	private texCoordBuffer: WebGLBuffer;
	private positionLocation: number;
	private texCoordLocation: number;
	private samplerLocation: WebGLUniformLocation;
	private imageBitmapIdCounter = 0;
	private textureCache: Map<string, WebGLTexture> = new Map();
	private imageBitmapIdMap = new WeakMap<ImageBitmap, number>();

	constructor(offscreenCanvas: OffscreenCanvas) {
		this.offscreenCanvas = offscreenCanvas;
		this.gl = this.offscreenCanvas.getContext('webgl');
		if (!this.gl) {
			throw new Error('WebGL not supported');
		}
		this.initializeWebGL();
	}

	initialize(): void {
		// do nothing!
	}

	isGlRenderer(): boolean {
		return true;
	}

	private vertexShaderSource = `
			attribute vec2 a_position;
			attribute vec2 a_texCoord;
			varying vec2 v_texCoord;
			void main() {
				gl_Position = vec4(a_position, 0, 1);
				v_texCoord = a_texCoord;
			}
		`;

	private fragmentShaderSource = `
		precision mediump float;
		uniform float alpha;
		varying vec2 v_texCoord;
		uniform sampler2D u_sampler;
		void main() {
			vec4 color = texture2D(u_sampler, v_texCoord);
			color = color * alpha;
			gl_FragColor = color;
		}
		`;

	private initializeWebGL() {
		const gl = this.gl;

		// Compile shaders
		const vertexShader = this.createShader(
			gl,
			gl.VERTEX_SHADER,
			this.vertexShaderSource,
		);
		const fragmentShader = this.createShader(
			gl,
			gl.FRAGMENT_SHADER,
			this.fragmentShaderSource,
		);

		// Link program
		this.program = this.createProgram(gl, vertexShader, fragmentShader);

		// Get attribute and uniform locations
		this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
		this.texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord');
		this.samplerLocation = gl.getUniformLocation(this.program, 'u_sampler');

		// Create buffers
		this.positionBuffer = gl.createBuffer();

		this.texCoordBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);
		gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.enableVertexAttribArray(this.positionLocation);
		gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
		gl.enableVertexAttribArray(this.texCoordLocation);
		gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
		this.gl.disable(this.gl.DEPTH_TEST);
	}

	private initPositionBuffer(bounds: BoundsType) {
		const gl = this.gl;

		let vertices = LayerRendererGl.DefaultVertices;
		if (bounds) {
			// convert [0,1] => [-1,1]
			for (let i = 0; i < bounds.length; ++i) bounds[i] = 2 * bounds[i] - 1;

			// flip y coordinates
			const l = bounds[0]; // left bound
			const t = -bounds[1]; // top bound
			const r = bounds[2]; // right bound
			const b = -bounds[3]; // bottom bound

			vertices = [l, b, r, b, l, t, l, t, r, b, r, t];
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		const positions = new Float32Array(vertices);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	}

	private loadTexture(
		gl: WebGLRenderingContext,
		imageInfo: HTMLImageElement | ImageBitmap,
	): WebGLTexture {
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			imageInfo,
		);

		return texture;
	}

	private createShader(
		gl: WebGLRenderingContext,
		type: number,
		source: string,
	): WebGLShader {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const info = gl.getShaderInfoLog(shader);
			console.error('Could not compile WebGL shader.' + info);
			gl.deleteShader(shader);
			throw new Error('Shader compilation failed');
		}
		return shader;
	}

	private createProgram(
		gl: WebGLRenderingContext,
		vertexShader: WebGLShader,
		fragmentShader: WebGLShader,
	): WebGLProgram {
		const program = gl.createProgram();
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const info = gl.getProgramInfoLog(program);
			console.error('Could not link WebGL program.' + info);
			gl.deleteProgram(program);
			throw new Error('Program linking failed');
		}
		return program;
	}

	clearCanvas(): void {
		const gl = this.gl;
		gl.clearColor(1.0, 1.0, 1.0, 1.0); // Clear to white
		gl.clear(gl.COLOR_BUFFER_BIT);
	}

	drawBitmap(
		imageInfo: ImageInfo | ImageBitmap,
		properties?: AnimatedElementRenderProperties,
	): void {
		if (!imageInfo) {
			console.log('LayerDrawing.drawBitmap: no image');
			return;
		}

		let bounds: BoundsType = null;
		let alpha = 1.0;
		if (properties) {
			bounds = properties.bounds;
			alpha = properties.alpha;
		}

		let texture: WebGLTexture;
		let textureKey: string;

		if (imageInfo instanceof ImageBitmap) {
			if (!this.imageBitmapIdMap.has(imageInfo)) {
				this.imageBitmapIdMap.set(imageInfo, this.imageBitmapIdCounter++);
			}
			textureKey = `imageBitmap_${this.imageBitmapIdMap.get(imageInfo)}`;
		} else {
			textureKey = imageInfo.checksum;
		}

		if (this.textureCache.has(textureKey)) {
			texture = this.textureCache.get(textureKey);
			// console.debug(`LayerDrawing.drawBitmap: cache hit: key: ${textureKey}`);
		} else {
			if (imageInfo instanceof ImageBitmap) {
				texture = this.loadTexture(this.gl, imageInfo);
			} else {
				texture = this.loadTexture(this.gl, imageInfo.data as HTMLImageElement);
			}
			this.textureCache.set(textureKey, texture);
		}

		this.gl.useProgram(this.program);

		this.initPositionBuffer(bounds);
		this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'alpha'), alpha);

		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
		this.gl.uniform1i(this.samplerLocation, 0);

		this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
	}

	dispose(): void {
		this.gl = null;
		this.offscreenCanvas = null;
	}

	hexToRgb(hex: string): { r: number; g: number; b: number } | null {
		hex = hex.replace(/^#/, '');
		let bigint: number;
		if (hex.length === 3) {
			const r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
			const g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
			const b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
			return { r, g, b };
		} else if (hex.length === 6) {
			bigint = parseInt(hex, 16);
			const r = (bigint >> 16) & 255;
			const g = (bigint >> 8) & 255;
			const b = bigint & 255;
			return { r, g, b };
		} else {
			return null;
		}
	}

	fillColor(slideInfo: SlideInfo): boolean {
		if (slideInfo.background && slideInfo.background.fillColor) {
			const fillColor = slideInfo.background.fillColor;
			const rgb = this.hexToRgb(fillColor);
			if (rgb) {
				this.gl.clearColor(rgb.r / 255, rgb.g / 255, rgb.b / 255, 1.0);
			} else {
				this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
			}
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		} else {
			this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);
		}

		if (!slideInfo.background) return true;
		return false;
	}
}

class LayerRenderer2d implements LayerRenderer {
	private offscreenCanvas: OffscreenCanvas;
	private offscreenContext: OffscreenCanvasRenderingContext2D;

	constructor(offscreenCanvas: OffscreenCanvas) {
		this.offscreenCanvas = offscreenCanvas;
		this.offscreenContext = this.offscreenCanvas.getContext('2d');
		if (!this.offscreenContext) {
			throw new Error('2D Canvas context not available');
		}
	}

	initialize(): void {
		// Initialization is handled in the constructor
	}

	isGlRenderer(): boolean {
		return false;
	}

	clearCanvas(): void {
		this.offscreenContext.clearRect(
			0,
			0,
			this.offscreenCanvas.width,
			this.offscreenCanvas.height,
		);
		this.offscreenContext.fillStyle = '#FFFFFF';
		this.offscreenContext.fillRect(
			0,
			0,
			this.offscreenCanvas.width,
			this.offscreenCanvas.height,
		);
	}

	drawBitmap(
		imageInfo: ImageInfo | ImageBitmap,
		properties?: AnimatedElementRenderProperties,
	): void {
		if (!imageInfo) {
			console.log('Canvas2DRenderer.drawBitmap: no image');
			return;
		}
		if (imageInfo instanceof ImageBitmap) {
			this.offscreenContext.drawImage(imageInfo, 0, 0);
		} else if (imageInfo.type === 'png') {
			this.offscreenContext.drawImage(imageInfo.data as HTMLImageElement, 0, 0);
		}
	}

	dispose(): void {
		// Cleanup references
		this.offscreenContext = null;
		this.offscreenCanvas = null;
	}

	fillColor(slideInfo: SlideInfo): boolean {
		// always draw a solid white rectangle behind the background
		this.offscreenContext.fillStyle = '#FFFFFF';
		this.offscreenContext.fillRect(
			0,
			0,
			this.offscreenCanvas.width,
			this.offscreenCanvas.height,
		);

		if (!slideInfo.background) return true;
		if (slideInfo.background.fillColor) {
			this.offscreenContext.fillStyle = '#' + slideInfo.background.fillColor;
			window.app.console.log(
				'LayerDrawing.drawBackground: ' + this.offscreenContext.fillStyle,
			);
			this.offscreenContext.fillRect(
				0,
				0,
				this.offscreenCanvas.width,
				this.offscreenCanvas.height,
			);
			return true;
		}

		return false;
	}
}

SlideShow.LayerRendererGl = LayerRendererGl;
SlideShow.LayerRenderer2d = LayerRenderer2d;
