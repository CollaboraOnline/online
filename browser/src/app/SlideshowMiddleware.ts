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

	public static renderCachedCompressSlide(layers: CompressedSlideLayer[]) {
		const pendingLayers: Promise<void>[] = [];

		for (const layer of layers) {
			const { json, imgRawData } = layer;
			if (json?.width && json?.height) {
				const imgData = this.decompressAndCreateImageData(
					imgRawData,
					json.width,
					json.height,
				);

				console.debug(
					'CompressedCache: fetching layers from compressed cache',
					layer,
				);
				pendingLayers.push(
					createImageBitmap(imgData).then((img) => {
						app.map.fire('slidelayer', {
							message: json,
							image: img,
						});
					}),
				);
			}
		}

		Promise.all(pendingLayers)
			.then(() => {
				console.debug('CompressedCache: Complete Slide rendering');

				app.map.fire('sliderenderingcomplete', {
					success: 'success',
					compressedLayers: false,
				});
			})
			.catch((err) => {
				app.map.fire('sliderenderingcomplete', {
					success: 'fail',
					compressedLayers: false,
				});
				console.error('Something Went wrong while preparing layers', err);
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

		var json = JSON.parse(
			e.textMsg.substring('sliderenderingcomplete: '.length),
		);

		if (
			json.compressedLayers &&
			this.compressedSlideCache.get(json.slidehash) != null
		) {
			const layers = this.compressedSlideCache.get(json.slidehash);
			if (json.status === 'success') {
				app.map.fire('compressedslide', {
					slideHash: json.slidehash,
					layers: layers,
				});
			}
			this.compressedSlideCache.delete(json.slidehash);
			app.map.fire('sliderenderingcomplete', {
				success: json.status === 'success',
				compressedLayers: json.compressedLayers,
			});
			return;
		}

		Promise.all(this.pendingLayers).then(() => {
			this.pendingLayers = [];
			app.map.fire('sliderenderingcomplete', {
				success: json.status === 'success',
				compressedLayers: json.compressedLayers,
			});
		});
	}

	private static cacheCompressedLayer(json: any, imgRawData: Uint8Array) {
		if (!this.compressedSlideCache.has(json.slideHash)) {
			this.compressedSlideCache.set(json.slideHash, []);
		}
		this.compressedSlideCache.get(json.slideHash).push({ json, imgRawData });
	}
}
