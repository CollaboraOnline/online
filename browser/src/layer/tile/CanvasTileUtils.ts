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
	export class RawDelta {
		private _delta: Uint8Array;
		private _id: number;
		private _isKeyframe: boolean;

		constructor(delta: Uint8Array, id: number, isKeyframe: boolean) {
			this._delta = delta;
			this._id = id;
			this._isKeyframe = isKeyframe;
		}

		public get length(): number {
			return this.delta.length;
		}

		public get delta(): Uint8Array {
			return this._delta;
		}

		public get id(): number {
			return this._id;
		}

		public get isKeyframe(): boolean {
			return this._isKeyframe;
		}
	}

	export abstract class CanvasTileUtils {
		private static lastPixel = new Uint8Array(4);

		public static unrle(
			data: Uint8Array,
			width: number,
			height: number,
			output: Uint8Array,
			outputOffset: number = 0,
		): number {
			// Byte bashing fun
			var offset = 0;
			for (var y = 0; y < height; ++y) {
				var rleSize = data[offset] + data[offset + 1] * 256;
				offset += 2;

				var rleMask = offset;
				const rleMaskSizeBytes = 256 / 8;

				offset += rleMaskSizeBytes;

				// It would be rather nice to have real 64bit types [!]
				this.lastPixel.fill(0);
				var lastMask = 0;
				var bitToCheck = 256;
				var rleMaskOffset = rleMask;

				var pixOffset = y * width * 4 + outputOffset;
				var pixSrc = offset;

				for (var x = 0; x < width; ++x) {
					if (bitToCheck > 128) {
						bitToCheck = 1;
						lastMask = data[rleMaskOffset++];
					}
					if (!(lastMask & bitToCheck)) {
						// subarray has a significant overhead on Firefox
						//this.lastPixel.set(data.subarray(pixSrc, pixSrc + 4));
						this.lastPixel[0] = data[pixSrc];
						this.lastPixel[1] = data[pixSrc + 1];
						this.lastPixel[2] = data[pixSrc + 2];
						this.lastPixel[3] = data[pixSrc + 3];
						pixSrc += 4;
					}
					bitToCheck = bitToCheck << 1;

					output.set(this.lastPixel, pixOffset);
					pixOffset += 4;
				}

				offset += rleSize * 4;
			}

			return offset;
		}

		public static updateImageFromDeltas(
			image: ImageData,
			deltas: Uint8Array,
			keyframeDeltaSize: number,
			tileSize: number,
			debug: boolean = false,
		): void {
			let nDelta = 0;
			let offset = keyframeDeltaSize;

			while (offset < deltas.length) {
				if (debug)
					console.debug(
						'Next delta at ' + offset + ' length ' + (deltas.length - offset),
					);

				const delta = !offset ? deltas : deltas.subarray(offset);

				// Debugging paranoia: if we get this wrong bad things happen.
				const susDeltaSize = tileSize * tileSize * 4;
				if (debug && delta.length >= susDeltaSize) {
					console.warn(
						'Unusual delta possibly mis-tagged, suspicious size vs. type ' +
							delta.length +
							' vs. ' +
							susDeltaSize,
					);
				}

				// copy old data to work from:
				const oldData = new Uint8ClampedArray(image.data);

				if (debug)
					console.debug(
						'Applying delta chunk ' +
							nDelta++ +
							' of total size ' +
							delta.length +
							' at stream offset ' +
							offset,
					);
				// + ' hex: ' + hex2string(delta, delta.length));

				const len = this.applyDeltaChunk(
					image,
					delta,
					oldData,
					tileSize,
					tileSize,
					debug,
				);

				if (debug) console.debug('Applied delta chunk of size ' + len);

				offset += len;
			}
		}

		private static applyDeltaChunk(
			imgData: ImageData,
			delta: Uint8Array,
			oldData: Uint8ClampedArray,
			width: number,
			height: number,
			debug: boolean = false,
		): number {
			const pixSize = width * height * 4;
			let offset = 0;

			// Green-tinge the old-Data ...
			if (0) {
				for (let i = 0; i < pixSize; ++i) oldData[i * 4 + 1] = 128;
			}

			// wipe to grey.
			if (0) {
				for (let i = 0; i < pixSize * 4; ++i) imgData.data[i] = 128;
			}

			// Apply delta.
			let i = 0;
			for (let stop = false; i < delta.length && !stop; ) {
				switch (delta[i]) {
					case 99: {
						// 'c': // copy row
						const count = delta[i + 1];
						const srcRow = delta[i + 2];
						const destRow = delta[i + 3];
						if (debug)
							console.debug(
								'[' +
									i +
									']: copy ' +
									count +
									' row(s) ' +
									srcRow +
									' to ' +
									destRow,
							);
						i += 4;
						for (let cnt = 0; cnt < count; ++cnt) {
							const src = (srcRow + cnt) * width * 4;
							const dest = (destRow + cnt) * width * 4;
							for (let j = 0; j < width * 4; ++j) {
								imgData.data[dest + j] = oldData[src + j];
							}
						}
						break;
					}
					case 100: {
						// 'd': // new run
						const destRow = delta[i + 1];
						const destCol = delta[i + 2];
						let span = delta[i + 3];
						offset = destRow * width * 4 + destCol * 4;
						if (debug)
							console.debug(
								'[' +
									i +
									']: apply new span of size ' +
									span +
									' at pos ' +
									destCol +
									', ' +
									destRow +
									' into delta at byte: ' +
									offset,
							);
						i += 4;
						span *= 4;
						for (let j = 0; j < span; ++j)
							imgData.data[offset++] = delta[i + j];
						i += span;
						// imgData.data[offset - 2] = 256; // debug - blue terminator
						break;
					}
					case 116: {
						// 't': // terminate delta new one next
						stop = true;
						i++;
						break;
					}
					default: {
						console.error('[' + i + ']: ERROR: Unknown delta code ' + delta[i]);
						i = delta.length;
						break;
					}
				}
			}

			return i;
		}
	}
} // namespace cool

L.CanvasTileUtils = cool.CanvasTileUtils;
L.RawDelta = cool.RawDelta;
