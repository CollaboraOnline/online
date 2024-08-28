/* -*- tab-width: 4 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare var app: any;

class MetaPresentation {
	private docWidth: number;
	private docHeight: number;
	private _numberOfSlides: number;
	private firstSlideHash: string;
	private lastSlideHash: string;
	private _startSlideIndex: number;
	private metaSlides: Map<string, MetaSlide>;
	private partHashes: Map<number, string>;
	private aSlideShowHandler: SlideShowHandler;

	constructor(info: PresentationInfo, aSlideShowHandler: SlideShowHandler) {
		this.aSlideShowHandler = aSlideShowHandler;
		this.update(info);
	}

	public get slideShowHandler(): SlideShowHandler {
		return this.aSlideShowHandler;
	}

	public get startSlideIndex(): number {
		return this._startSlideIndex;
	}

	public update(info: PresentationInfo) {
		this.docWidth = info.docWidth;
		this.docHeight = info.docHeight;

		this._numberOfSlides = info.slides.length;
		if (this._numberOfSlides === 0) return;

		this.firstSlideHash = info.slides[0].hash;
		this.lastSlideHash = info.slides[this._numberOfSlides - 1].hash;

		this.metaSlides = new Map();
		let prevSlideHash = null;
		for (let i = 0; i < this._numberOfSlides; ++i) {
			const slide = info.slides[i];
			slide.prev = prevSlideHash;
			slide.next =
				i + 1 < this._numberOfSlides ? info.slides[i + 1].hash : null;
			const metaSlide = new MetaSlide(slide, this);
			this.metaSlides.set(slide.hash, metaSlide);
			this.partHashes.set(slide.index, slide.hash);
			prevSlideHash = slide.hash;
		}
	}

	public isEmpty(): boolean {
		return this._numberOfSlides === 0;
	}

	public get numberOfSlides(): number {
		return this._numberOfSlides;
	}

	public get slideWidth(): number {
		return this.docWidth;
	}

	public get slideHeight(): number {
		return this.docHeight;
	}

	public getCurrentSlideIndex(): number {
		return 0;
	}

	public setCurrentSlideIndex(nSlideIndex: number) {
		// TODO implement it ?
	}

	public getCurrentSlideHash(): string {
		return this.getSlideHash(this.getCurrentSlideIndex());
	}

	public getSlideHash(slideIndex: number) {
		return this.partHashes.get(slideIndex);
	}

	public isFirstSlide(hash: string) {
		return hash === this.firstSlideHash;
	}

	public isLastSlide(hash: string) {
		return hash === this.lastSlideHash;
	}

	public getMetaSlide(slideHash: string): MetaSlide {
		return this.metaSlides.get(slideHash);
	}

	public getMetaSlideByIndex(slideIndex: number): MetaSlide {
		return this.metaSlides.get(this.getSlideHash(slideIndex));
	}

	public getSlideInfo(slideHash: string): SlideInfo {
		return this.metaSlides.get(slideHash).info;
	}

	public setCurrentSlide(nSlideIndex: number) {
		if (nSlideIndex >= 0 && nSlideIndex < this.numberOfSlides) {
			const nCurSlide = this.getCurrentSlideIndex();
			if (nCurSlide !== undefined) this.getMetaSlideByIndex(nCurSlide).hide();
			this.getMetaSlideByIndex(nCurSlide).show();
			this.setCurrentSlideIndex(nSlideIndex);
		} else {
			window.app.console.log(
				'MetaPresentation.setCurrentSlide: slide index out of range: ' +
					nSlideIndex,
			);
		}
	}
}
