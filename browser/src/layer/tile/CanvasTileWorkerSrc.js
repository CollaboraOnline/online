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
			case 'endTransaction': {
				const tileByteSize = e.data.tileSize * e.data.tileSize * 4;
				const decompressed = [];
				const buffers = [];
				for (const tile of e.data.deltas) {
					tile.deltas = self.fzstd.decompress(tile.rawDelta);
					tile.keyframeDeltaSize = 0;

					// Decompress the keyframe buffer
					if (tile.isKeyframe) {
						tile.keyframeBuffer = new Uint8Array(tileByteSize);
						tile.keyframeDeltaSize = L.CanvasTileUtils.unrle(
							tile.deltas,
							e.data.tileSize,
							e.data.tileSize,
							tile.keyframeBuffer,
						);
						buffers.push(tile.keyframeBuffer.buffer);
					}

					// The main thread has no use for the concatenated rawDelta, delete it here
					// instead of passing it back.
					delete tile.rawDelta;

					decompressed.push(tile);
					buffers.push(tile.deltas.buffer);
				}

				postMessage(
					{
						message: e.data.message,
						deltas: decompressed,
						tileSize: e.data.tileSize,
					},
					buffers,
				);
				break;
			}

			default:
				console.error('Unrecognised worker message');
		}
	}
}
