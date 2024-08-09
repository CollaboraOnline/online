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
/* global importScripts Uint8Array cool */

if ('undefined' === typeof window) {
	importScripts('../../node_modules/fzstd/umd/index.js');
	importScripts('../layer/tile/CanvasTileUtils.js');
	addEventListener('message', onMessage);

	console.info('SocketWorker initialised', self.fzstd);

	var keyframeBufferSize = 0;
	var keyframeBuffer;

	function onMessage(e) {
		switch (e.data.message) {
			case 'tile':
				var buffer = e.data.buffer;
				var offset = 0;
				var processed = [];
				var buffers = [buffer.buffer];
				for (const tile of e.data.tiles) {
					// Allocate key-frame decompression buffer
					if (tile.size > keyframeBufferSize) {
						keyframeBufferSize = tile.size;
						keyframeBuffer = new Uint8Array(tile.size);
					}

					var startOffset = tile.isKeyframe ? 0 : offset;
					var fzstdBuffer = tile.isKeyframe ? keyframeBuffer : buffer;
					var fzstdOffset = startOffset;

					var stream = new self.fzstd.Decompress((chunk, _isLast) => {
						fzstdBuffer.set(chunk, fzstdOffset);
						fzstdOffset += chunk.length;
					});
					stream.push(tile.rawData);

					if (tile.isKeyframe) {
						cool.CanvasTileUtils.unrle(
							keyframeBuffer,
							tile.tileSize,
							tile.tileSize,
							buffer,
							offset,
						);
						startOffset = offset;
						offset += tile.tileSize * tile.tileSize * 4;
					} else offset = fzstdOffset;

					var data = new Uint8Array(
						buffer.buffer,
						startOffset,
						offset - startOffset,
					);

					// Unpremultiply delta updates
					if (!tile.isKeyframe) {
						var stop = false;
						for (var i = 0; i < data.length && !stop; ) {
							switch (data[i]) {
								case 99: // 'c': // copy row
									i += 4;
									break;
								case 100: // 'd': // new run
									var span = data[i + 3] * 4;
									i += 4;
									cool.CanvasTileUtils.unpremultiply(data, span, i);
									i += span;
									break;
								case 116: // 't': // terminate delta
									stop = true;
									i++;
									break;
								default:
									console.error(
										'[' + i + ']: ERROR: Unknown delta code ' + data[i],
									);
									i = data.length;
									break;
							}
						}
					}
					processed.push({
						id: tile.id,
						rawData: tile.rawData,
						processedData: data,
					});
					buffers.push(tile.rawData.buffer);
				}
				postMessage(
					{ message: e.data.message, tiles: processed, buffer: buffer },
					buffers,
				);
				break;

			default:
				console.error('Unrecognised preprocessor message', e);
		}
	}
}
