/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-disable no-inner-declarations */
/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* global importScripts Uint8Array */

if ('undefined' === typeof window) {
	self.L = {};

	importScripts('CanvasTileUtils.js');
	addEventListener('message', onMessage);

	console.info('CanvasTileWorker initialised');

	function onMessage(e) {
		switch (e.data.message) {
			case 'endTransaction':
				var tileByteSize = e.data.tileSize * e.data.tileSize * 4;
				var decompressed = [];
				var buffers = [];
				for (var tile of e.data.deltas) {
					var buffer = self.fzstd.decompress(tile.rawDelta);

					// Copy the subsection of the array with the data to give back to the main thread
					var deltas;
					if (tile.isKeyframe) {
						deltas = new Uint8Array(tileByteSize);
						L.CanvasTileUtils.unrle(
							buffer,
							e.data.tileSize,
							e.data.tileSize,
							deltas,
						);
					} else {
						deltas = buffer;

						// Unpremultiply delta updates
						var stop = false;
						for (var i = 0; i < deltas.length && !stop; ) {
							switch (deltas[i]) {
								case 99: // 'c': // copy row
									i += 4;
									break;
								case 100: // 'd': // new run
									var span = deltas[i + 3] * 4;
									i += 4;
									L.CanvasTileUtils.unpremultiply(deltas, span, i);
									i += span;
									break;
								case 116: // 't': // terminate delta
									stop = true;
									i++;
									break;
								default:
									console.error(
										'[' + i + ']: ERROR: Unknown delta code ' + deltas[i],
									);
									i = deltas.length;
									break;
							}
						}
					}

					// Now wrap as Uint8ClampedArray as that's what ImageData requires. Don't do
					// it earlier to avoid unnecessarily incurring bounds-checking penalties.
					tile.deltas = new Uint8ClampedArray(
						deltas.buffer,
						deltas.byteOffset,
						deltas.length,
					);
					decompressed.push(tile);
					buffers.push(tile.rawDelta.buffer);
					buffers.push(tile.deltas.buffer);
				}

				postMessage(
					{
						message: e.data.message,
						deltas: decompressed,
					},
					buffers,
				);
				break;

			default:
				console.error('Unrecognised worker message');
		}
	}
}
