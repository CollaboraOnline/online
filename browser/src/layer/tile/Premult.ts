/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
declare var L: any;

namespace cool {
	/**
	 * Used to re-use an aligned buffer that we can un-pre-multiply
	 * un-aligned bytes from a stream into, and ensure we can also
	 * access these as 32bit pixels.
	 */
	export class UnPremult {
		public _pixels: Uint32Array;
		public _bytes: Uint8ClampedArray;

		constructor(len: number) {
			this.sizeArrays(len);
		}

		private sizeArrays(len: number): void {
			this._pixels = new Uint32Array(len);
			this._bytes = new Uint8ClampedArray(
				this._pixels.buffer,
				this._pixels.byteOffset,
				this._pixels.byteLength,
			);
		}

		public unpremultiply(
			data: Uint8Array,
			byteLength: number,
			byteOffset: number = 0,
		): void {
			if (byteLength > this._bytes.length) {
				window.console.warn(
					'Unusual - extend array to unpremultiply ' +
						byteLength +
						' vs. ' +
						this._bytes.length,
				);
				this.sizeArrays((byteLength + 3) / 4);
			}
			for (var o8 = 0; o8 < byteLength; o8 += 4) {
				// premultiplied rgba -> unpremultiplied rgba
				var i8 = byteOffset + o8;
				var alpha = data[i8 + 3];
				if (alpha === 0) {
					this._bytes[o8] = 0;
					this._bytes[o8 + 1] = 0;
					this._bytes[o8 + 2] = 0;
					this._bytes[o8 + 3] = 0;
				} else if (alpha === 255) {
					this._bytes[o8] = data[i8];
					this._bytes[o8 + 1] = data[i8 + 1];
					this._bytes[o8 + 2] = data[i8 + 2];
					this._bytes[o8 + 3] = data[i8 + 3];
				} else {
					this._bytes[o8] = Math.ceil((data[i8] * 255) / alpha);
					this._bytes[o8 + 1] = Math.ceil((data[i8 + 1] * 255) / alpha);
					this._bytes[o8 + 2] = Math.ceil((data[i8 + 2] * 255) / alpha);
					this._bytes[o8 + 3] = alpha;
				}
			}
		}
	}
} // namespace cool

L.UnPremult = cool.UnPremult;
