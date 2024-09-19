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

	importScripts('../../../node_modules/fzstd/umd/index.js');
	importScripts('CanvasTileUtils.js');
	addEventListener('message', onMessage);

	console.info('CanvasTileWorker initialised');

	var keyframeBufferSize = 0;
	var keyframeBuffer;

	function onMessage(e) {
		switch (e.data.message) {
			case 'decompress':
				var buffer = e.data.buffer;
				var tile = e.data.tile;

				// Allocate key-frame decompression buffer
				// FIXME: This is an over-allocation, we should store the uncompressed size
				//        on the server-side and communicate that with the client.
				var tileByteSize = tile.tileSize * tile.tileSize * 4;
				if (tileByteSize > keyframeBufferSize) {
					keyframeBufferSize = tileByteSize;
					keyframeBuffer = new Uint8Array(tileByteSize);
				}

				var fzstdBuffer = tile.isKeyframe ? keyframeBuffer : buffer;
				var fzstdOffset = 0;

				var stream = new self.fzstd.Decompress((chunk, _isLast) => {
					fzstdBuffer.set(chunk, fzstdOffset);
					fzstdOffset += chunk.length;
				});
				stream.push(tile.rawDelta);

				var length = fzstdOffset;
				if (tile.isKeyframe) {
					L.CanvasTileUtils.unrle(
						keyframeBuffer,
						tile.tileSize,
						tile.tileSize,
						buffer,
						0,
					);
					length = tileByteSize;
				}

				var deltas = new Uint8Array(buffer.buffer, 0, length);

				// Unpremultiply delta updates
				if (!tile.isKeyframe) {
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
						buffer: buffer,
					},
					[tile.rawDelta.buffer, buffer.buffer],
				);
				break;

			default:
				console.error('Unrecognised worker message');
		}
	}
}
