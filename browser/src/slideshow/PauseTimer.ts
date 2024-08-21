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
 * PauseTimer helps display the countdown in pause mode, and we typically use it to repeat after x pauses
 */

declare var SlideShow: any;

abstract class PauseTimer {
	public abstract startTimer(): void;
}

class PauseTimer2d implements PauseTimer {
	private onComplete: () => void;
	constructor(
		transitionParameters: TransitionParameters,
		pauseDuration: number,
		onComplete: () => void,
	) {
		this.onComplete = onComplete;
	}

	public startTimer(): void {
		this.onComplete();
	}
}

class PauseTimerGl extends Transition2d implements PauseTimer {
	private pauseTimeRemaining: number;
	private pauseDuration: number;
	private textTexture: WebGLTexture;
	private onComplete: () => void;
	private textCanvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;

	constructor(
		transitionParameters: TransitionParameters,
		pauseDuration: number,
		onComplete: () => void,
	) {
		super(transitionParameters);
		this.pauseDuration = pauseDuration;
		this.pauseTimeRemaining = pauseDuration;
		this.onComplete = onComplete;

		this.textCanvas = document.createElement('canvas');
		this.textCanvas.width = this.context.canvas.width;
		this.textCanvas.height = this.context.canvas.height;
		this.ctx = this.textCanvas.getContext('2d');

		this.textTexture = this.createTextTexture(
			Math.ceil(this.pauseTimeRemaining),
		);
		this.prepareTransition();
	}

	public startTimer(): void {
		this.startTime = performance.now();
		requestAnimationFrame(this.animate.bind(this));
	}

	private animate(): void {
		const currentTime = performance.now();
		const elapsedTime = (currentTime - this.startTime) / 1000;
		this.pauseTimeRemaining = Math.max(0, this.pauseDuration - elapsedTime);

		this.textTexture = this.createTextTexture(
			Math.ceil(this.pauseTimeRemaining),
		);

		this.render();
		requestAnimationFrame(this.animate.bind(this));

		if (this.pauseTimeRemaining <= 0) {
			this.onComplete();
			this.delete2dTextCanvas();
			return;
		}
	}

	private createTextTexture(remainingCount: number): WebGLTexture {
		const displayText = `Pause...( ${remainingCount} )`;
		this.clearCanvas();
		this.drawText(displayText);
		return this.load2dCanvasToGlCanvas(this.textCanvas);
	}

	private clearCanvas(): void {
		this.ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
		this.ctx.fillStyle = 'black';
		this.ctx.fillRect(0, 0, this.textCanvas.width, this.textCanvas.height);
	}

	// add text on off screen canvas...
	private drawText(displayText: string): void {
		this.ctx.fillStyle = 'white';
		this.ctx.font = '20px sans-serif';
		this.ctx.textAlign = 'center';
		this.ctx.textBaseline = 'middle';
		this.ctx.fillText(
			displayText,
			this.textCanvas.width / 2,
			this.textCanvas.height / 2,
		);
	}

	public delete2dTextCanvas(): void {
		if (this.textCanvas) {
			this.textCanvas.remove();
			this.textCanvas = null;
			this.ctx = null;
		}
	}

	// TODO: We can replace with loadTexture from RenderContext
	private load2dCanvasToGlCanvas(canvas: HTMLCanvasElement): WebGLTexture {
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
			canvas,
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
		this.gl.texParameteri(
			this.gl.TEXTURE_2D,
			this.gl.TEXTURE_MIN_FILTER,
			this.gl.LINEAR,
		);
		this.gl.texParameteri(
			this.gl.TEXTURE_2D,
			this.gl.TEXTURE_MAG_FILTER,
			this.gl.LINEAR,
		);

		return texture;
	}

	public render(): void {
		this.gl.viewport(
			0,
			0,
			this.context.canvas.width,
			this.context.canvas.height,
		);
		this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);

		this.gl.useProgram(this.program);

		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.textTexture);

		const textureLocation = this.gl.getUniformLocation(
			this.program,
			'u_texture',
		);
		this.gl.uniform1i(textureLocation, 0);

		this.gl.bindVertexArray(this.vao);
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
	}

	public getFragmentShader(): string {
		return `#version 300 es
			precision highp float;
			in vec2 v_texCoord;
			uniform sampler2D u_texture;
			out vec4 outColor;

			void main() {
				outColor = texture(u_texture, v_texCoord);
			}`;
	}
}

SlideShow.PauseTimer = PauseTimer;
SlideShow.PauseTimer2d = PauseTimer2d;
SlideShow.PauseTimerGl = PauseTimerGl;
