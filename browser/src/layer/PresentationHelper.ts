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

interface SlideInfo {
	hash: string;
	index: number; // slide number
	empty: boolean;
	masterPage: string; // master page hash
	masterPageObjectsVisibility: boolean;
	background?: {
		isCustom: boolean;
		fillColor?: string;
	};
	prev: string;
	next: string;
}

class PresentationHelper {
	docWidth: number;
	docHeight: number;

	firstSlideHash: string = null;
	lastSlideHash: string = null;

	private map: any;
	private docLayer: any;

	private slidesInfo: Map<string, SlideInfo> = new Map();
	private backgroundChecksums: Map<string, string> = new Map();
	private cachedBackgrounds: Map<string, HTMLImageElement> = new Map();

	constructor(mapObj: any, docLayerObj: any) {
		this.map = mapObj;
		this.docLayer = docLayerObj;

		this.map.on('slidebackground', this.onSlideBackgroundMsg.bind(this));
	}

	cleanup() {
		this.map.off('slidebackground', this.onSlideBackgroundMsg);
	}

	getSlideInfo(slideHash: string) {
		return this.slidesInfo.get(slideHash);
	}

	onSlidesInfoMsg(data: any) {
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

			prevSlideHash = slide.hash;
		}

		this.docWidth = data.docWidth;
		this.docHeight = data.docHeight;

		this.map.fire('presentationinfoupdated');
	}

	onSlideBackgroundMsg(e: any) {
		if (!e.data) {
			window.app.console.log('PresentationHelper.onSlideLayerMsg: no json data available.');
			return;
		}
		this.handleBackgroundLayerMsg(e.data, e.image);
	}

	private handleBackgroundLayerMsg(data: any, img: any) {
		if (data.type === 'bitmap') {
			if (!img || !img.src) {
				window.app.console.log('PresentationHelper.handleBackgroundLayerMsg: no bitmap available.');
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

	getBackgroundForPage(slideHash: string, masterPageMode: boolean) {
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

	requestBackgroundForPage(slideIndex: number, masterPageMode: boolean) {
		const mode = masterPageMode ? 1 : 0;
		const layerSize = this.getLayerSize();
		app.socket.sendMessage(`getslidebackground part=${slideIndex} mode=${mode} width=${layerSize[0]} height=${layerSize[1]}`);
	}

	getCurrentSlideIndex(): number {
		return this.docLayer._selectedPart;
	}

	getCurrentSlideHash() {
		return this.getSlideHash(this.getCurrentSlideIndex());
	}

	getSlideHash(slideIndex: number) {
		return this.docLayer._partHashes[slideIndex] as string;
	}

	isMasterPageMode() {
		return this.docLayer._selectedMode === 1;
	}

	getSlideSizePixel() {
		return [app.twipsToPixels * this.docWidth, app.twipsToPixels * this.docHeight];
	}

	computeLayerResolution(width: number, height: number) {
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

	computeLayerSize(width: number, height: number) {
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

	getLayerSize() {
		const slideSize = this.getSlideSizePixel();
		const resolution = this.computeLayerResolution(slideSize[0], slideSize[1]);
		return this.computeLayerSize(resolution[0], resolution[1]);
	}
}

