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
class SlideBitmapManager {
	public static pendingLayers: Promise<ImageBitmap>[] = [];

	public static decompressAndCreateImageData(
		imgRawData: Uint8Array,
		width: number,
		height: number,
	): ImageData {
		const img = (window as any).fzstd.decompress(imgRawData);
		const clampedArray = new Uint8ClampedArray(img);
		return new ImageData(clampedArray, width, height);
	}

	public static handleRenderSlideEvent(e: any) {
		if (!e.textMsg.startsWith('slidelayer:')) return;
		var json = JSON.parse(e.textMsg.substring('slidelayer: '.length));
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

		// make sure all bitmaps are created before firing the complete event
		Promise.all(this.pendingLayers).then(() => {
			this.pendingLayers = [];
			const status = e.textMsg.substring('sliderenderingcomplete: '.length);
			app.map.fire('sliderenderingcomplete', {
				success: status === 'success',
			});
		});
	}
}
