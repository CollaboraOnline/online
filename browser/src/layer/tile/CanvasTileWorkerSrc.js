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

	// Reusable buffer for fzstd decompression
	var bufferSize = 0;
	var buffer;

	function onMessage(e) {
		switch (e.data.message) {
			case 'decompress':
				var tile = e.data.tile;

				// Allocate decompression buffer
				// FIXME: This is an over-allocation, we should store the uncompressed size
				//        on the server-side and communicate that with the client.
				var tileByteSize = tile.tileSize * tile.tileSize * 4;
				if (tileByteSize > bufferSize) {
					bufferSize = tileByteSize;
					buffer = new Uint8Array(tileByteSize);
				}

				var decompressedSize = 0;
				var stream = new self.fzstd.Decompress((chunk, _isLast) => {
					buffer.set(chunk, decompressedSize);
					decompressedSize += chunk.length;
				});
				stream.push(tile.rawDelta);

				// Copy the subsection of the array with the data to give back to the main thread
				var deltas;
				if (tile.isKeyframe) {
					deltas = new Uint8Array(tileByteSize);
					L.CanvasTileUtils.unrle(
						buffer,
						tile.tileSize,
						tile.tileSize,
						deltas,
						0,
					);
				} else {
					deltas = buffer.slice(0, decompressedSize);

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
				deltas = new Uint8ClampedArray(
					deltas.buffer,
					deltas.byteOffset,
					deltas.length,
				);

				postMessage(
					{
						message: e.data.message,
						tile: { id: tile.id, rawDelta: tile.rawDelta, deltas: deltas },
					},
					[tile.rawDelta.buffer, deltas.buffer],
				);
				break;

			default:
				console.error('Unrecognised worker message');
		}
	}
}
