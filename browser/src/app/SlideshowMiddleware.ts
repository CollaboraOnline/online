// @ts-strict-ignore
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

/* global app JSDialog _ $ errorMessages Uint8Array brandProductName GraphicSelection TileManager */

// SlideBitmapManager handles the layers for the slideshow
// It provides utility to decompress the row data from zstd and then make bitmaps from it
interface CompressedSlideLayer {
	json: any;
	imgRawData: Uint8Array;
}

class SlideBitmapManager {
	public static pendingLayers: Promise<ImageBitmap>[] = [];
	private static compressedSlideCache: Map<string, CompressedSlideLayer[]> =
		new Map();

	public static decompressAndCreateImageData(
		imgRawData: Uint8Array,
		width: number,
		height: number,
	): ImageData {
		const img = (window as any).fzstd.decompress(imgRawData);
		const clampedArray = new Uint8ClampedArray(img);
		return new ImageData(clampedArray, width, height);
	}

	public static async renderCachedCompressSlide(
		slideHash: string,
		layers: CompressedSlideLayer[],
	) {
		// todo: not needed slidehash here

		const promises = layers.map(async (layer) => {
			console.log('processing layer', slideHash, layer);
			var { json, imgRawData } = layer;
			if (json.width && json.height) {
				var imgData = this.decompressAndCreateImageData(
					imgRawData,
					json.width,
					json.height,
				);
				const img = await createImageBitmap(imgData);
				app.map.fire('slidelayer', {
					message: json,
					image: img,
				});
			}
		});

		await Promise.all(promises);

		app.map.fire('sliderenderingcomplete', {
			success: 'success',
			compressedLayers: false,
		});
	}

	public static handleRenderSlideEvent(e: any) {
		if (!e.textMsg.startsWith('slidelayer:')) return;
		var json = JSON.parse(e.textMsg.substring('slidelayer: '.length));
		if (json.isCompressed) {
			this.cacheCompressedLayer(json, e.imgBytes.subarray(e.imgIndex));
			return;
		}
		if (json.width && json.height) {
			var imgData = this.decompressAndCreateImageData(
				e.imgBytes.subarray(e.imgIndex),
				json.width,
				json.height,
			);
			e.imgPromise = createImageBitmap(imgData);
			this.pendingLayers.push(e.imgPromise);

			e.imgPromise.then((img: ImageBitmap) => {
				e.image = img;
				e.imageIsComplete = true;
				app.map.fire('slidelayer', {
					message: json,
					image: img,
				});
			});
		}
	}

	public static handleSlideRenderingComplete(e: any) {
		if (!e.textMsg.startsWith('sliderenderingcomplete:')) return;

		// challenge: How would we can differenciate from main flow? - think later
		var json = JSON.parse(
			e.textMsg.substring('sliderenderingcomplete: '.length),
		);

		if (
			json.compressedLayers &&
			this.compressedSlideCache.size > 0 &&
			this.compressedSlideCache.get(json.slidehash) != null
		) {
			// todo:  check success things json.status === 'success' - think later
			const layers = this.compressedSlideCache.get(json.slidehash);
			app.map.fire('compressedslide', {
				slideHash: json.slidehash,
				layers: layers,
			});
			this.compressedSlideCache.delete(json.slidehash);
			app.map.fire('sliderenderingcomplete', {
				success: json.status === 'success',
				compressedLayers: json.compressedLayers,
			});

			return;
		}

		// make sure all bitmaps are created before firing the complete event
		Promise.all(this.pendingLayers).then(() => {
			this.pendingLayers = [];
			app.map.fire('sliderenderingcomplete', {
				success: json.status === 'success',
				compressedLayers: json.compressedLayers,
			});
		});
	}

	public static getSlideShowCurrentIndex(): number {
		const map = window.app.map;
		const presenter = map.slideShowPresenter;
		if (!presenter || !presenter._metaPresentation) {
			// return { index: null, hash: null };
			console.error('vivek: no index found');
		} else {
			const metaPresentation = presenter._metaPresentation;
			return metaPresentation.getCurrentSlideIndex();
		}
		return null;
	}

	private static cacheCompressedLayer(json: any, imgRawData: Uint8Array) {
		if (!this.compressedSlideCache.has(json.slideHash)) {
			this.compressedSlideCache.set(json.slideHash, []);
		}
		this.compressedSlideCache.get(json.slideHash).push({ json, imgRawData });
	}
}
