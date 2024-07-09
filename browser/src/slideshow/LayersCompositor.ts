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
 * LayersCompositor generates slide from layers
 */

declare var SlideShow: any;

class LayersCompositor extends SlideShow.SlideCompositor {
	private firstSlideHash: string = null;
	private lastSlideHash: string = null;
	private slidesInfo: Map<string, SlideInfo> = new Map();
	private partHashes: Map<number, string> = new Map();
	private backgroundChecksums: Map<string, string> = new Map();
	private cachedBackgrounds: Map<string, HTMLImageElement> = new Map();

	constructor(
		slideShowPresenter: SlideShowPresenter,
		presentationInfo: PresentationInfo,
		width: number,
		height: number,
	) {
		super(slideShowPresenter, presentationInfo, width, height);
	}

	protected _addHooks() {
		app.map.on('slidebackground', this.onSlideBackground, this);
	}

	public removeHooks() {
		app.map.off('slidebackground', this.onSlideBackground, this);
	}

	private onSlideBackground(e: any) {
		if (!e.data) {
			window.app.console.log(
				'LayersCompositor.onSlideLayer: no json data available.',
			);
			return;
		}
		this.handleBackgroundLayer(e.data, e.image);
	}

	private getSlideInfo(slideHash: string) {
		return this.slidesInfo.get(slideHash);
	}

	public updatePresentationInfo(presentationInfo: PresentationInfo) {
		this.super(presentationInfo);
		this.onSlidesInfo(presentationInfo);
	}

	private onSlidesInfo(data: any) {
		const slides = data.slides as Array<SlideInfo>;
		const numberOfSlides = slides.length;
		if (numberOfSlides === 0)
			return;
		this.firstSlideHash = slides[0].hash;
		this.lastSlideHash = slides[numberOfSlides - 1].hash;

		let prevSlideHash = this.lastSlideHash;
		for (let i = 0; i < numberOfSlides; ++i) {
			const slide = slides[i];
			slide.prev = prevSlideHash;
			slide.next = i + 1 < numberOfSlides ? slides[i + 1].hash : this.firstSlideHash;
			this.slidesInfo.set(slide.hash, slide);
			this.partHashes.set(slide.index, slide.hash);
			prevSlideHash = slide.hash;
		}

		this.docWidth = data.docWidth;
		this.docHeight = data.docHeight;

		this.map.fire('presentationinfoupdated');
	}

	private handleBackgroundLayer(data: any, img: any) {
		console.error(data);
		if (data.type === 'bitmap') {
			if (!img || !img.src) {
				window.app.console.log('LayersCompositor.handleBackgroundLayer: no bitmap available.');
				return;
			}
			data.image = img as HTMLImageElement;

			const slideInfo = this.slidesInfo.get(data.pageHash);
			if (slideInfo && slideInfo.background && !slideInfo.background.isCustom)
				data.pageHash = slideInfo.masterPage;

			this.backgroundChecksums.set(data.pageHash, data.checksum);
			if (!this.cachedBackgrounds.has(data.checksum)) {
				this.cachedBackgrounds.set(data.checksum, data.image);
			}

			// if the background belongs to current slide signal it to SlideBackgroundSection
			const currentSlideHash = this.getCurrentSlideHash()
			const currentSlideInfo = this.slidesInfo.get(currentSlideHash);
			if (currentSlideInfo && currentSlideInfo.background) {
				const pageHash =
					(!this.isMasterPageMode() && currentSlideInfo.background.isCustom)
						? currentSlideHash
						: currentSlideInfo.masterPage;
				if (pageHash === data.pageHash) {
					const image = this.cachedBackgrounds.get(data.checksum);
					this.map.fire('slidebackgroundready', {image: image});
				}
			}
		}
	}

	private getBackgroundForPage(slideHash: string, masterPageMode: boolean) {
		const slideInfo = this.slidesInfo.get(slideHash);
		if (slideInfo && slideInfo.background) {
			const pageHash = (!masterPageMode && slideInfo.background.isCustom) ? slideHash : slideInfo.masterPage;
			const checksum = this.backgroundChecksums.get(pageHash);
			if (checksum) {
				window.app.console.log('PresentationHelper.getBackgroundForPage: already cached');
				const image = this.cachedBackgrounds.get(checksum);
				this.map.fire('slidebackgroundready', {image: image});
			} else {
				this.requestBackgroundForPage(slideInfo.index, masterPageMode);
			}
		}
	}

	private requestBackgroundForPage(slideIndex: number, masterPageMode: boolean) {
		const mode = masterPageMode ? 1 : 0;
		const layerSize = this.getLayerSize();
		app.socket.sendMessage(`getslidebackground part=${slideIndex} mode=${mode} width=${layerSize[0]} height=${layerSize[1]}`);
	}

	private getCurrentSlideIndex(): number {
		return this.docLayer._selectedPart;
	}

	private getCurrentSlideHash() {
		return this.getSlideHash(this.getCurrentSlideIndex());
	}

	private getSlideHash(slideIndex: number) {
		return this.partHashes.get(slideIndex);
	}

	private isMasterPageMode() {
		return this.docLayer._selectedMode === 1;
	}

	private getSlideSizePixel() {
		return [app.twipsToPixels * this.docWidth, app.twipsToPixels * this.docHeight];
	}

	private computeLayerResolution(width: number, height: number) {
		width *= 1.20;
		height *= 1.20;

		let resolutionWidth = 960;
		let resolutionHeight = 540;

		if (width > 1920 || height > 1080) {
			resolutionWidth = 1920;
			resolutionHeight = 1080
		} else if (width > 1280 || height > 720) {
			resolutionWidth = 1280;
			resolutionHeight = 720
		}
		return [resolutionWidth, resolutionHeight];
	}

	private computeLayerSize(width: number, height: number) {
		// compute the slide size in pixel with respect to the current resolution
		const slideWidth = this.docWidth;
		const slideHeight = this.docHeight;
		const slideRatio = slideWidth / slideHeight;
		const resolutionRatio = width / height;
		if (slideRatio > resolutionRatio) {
			height = Math.trunc((width * slideHeight) / slideWidth);
		} else if (slideRatio < resolutionRatio) {
			width = Math.trunc((height * slideWidth) / slideHeight);
		}
		return [width, height];
	}

	private getLayerSize() {
		const slideSize = this.getSlideSizePixel();
		const resolution = this.computeLayerResolution(slideSize[0], slideSize[1]);
		return this.computeLayerSize(resolution[0], resolution[1]);
	}

	public getSlide(slideNumber: number): HTMLImageElement {
		return null;
	}
}

SlideShow.LayersCompositor = LayersCompositor;
