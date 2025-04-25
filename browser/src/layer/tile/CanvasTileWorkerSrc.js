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

// Amount of time to spend decompressing deltas before returning to the main loop
const PROCESS_TIME = 10;

let transactionHandlerId = null;
const transactions = [];
let currentKeys = new Set();

function transactionCallback(start_time = null) {
	if (start_time === null) start_time = performance.now();
	else if (performance.now() - start_time >= PROCESS_TIME) {
		transactionHandlerId = setTimeout(() => transactionCallback(), 0);
		return;
	}

	const transaction = transactions.shift();
	const tileByteSize =
		transaction.data.tileSize * transaction.data.tileSize * 4;

	while (transaction.data.deltas.length) {
		const tile = transaction.data.deltas.pop();

		transaction.decompressed.push(tile);
		transaction.buffers.push(tile.rawDelta.buffer);

		// Skip keyframe tiles that are no longer current
		if (tile.isKeyframe && !currentKeys.has(tile.key)) continue;

		const deltas = self.fzstd.decompress(tile.rawDelta);
		tile.keyframeDeltaSize = 0;

		// Decompress the keyframe buffer
		if (tile.isKeyframe) {
			const keyframeBuffer = new Uint8Array(tileByteSize);
			tile.keyframeDeltaSize = L.CanvasTileUtils.unrle(
				deltas,
				transaction.data.tileSize,
				transaction.data.tileSize,
				keyframeBuffer,
			);
			tile.keyframeBuffer = new Uint8ClampedArray(
				keyframeBuffer.buffer,
				keyframeBuffer.byteOffset,
				keyframeBuffer.byteLength,
			);
			transaction.buffers.push(tile.keyframeBuffer.buffer);
		}

		// Now wrap as Uint8ClampedArray as that's what ImageData requires. Don't do
		// it earlier to avoid unnecessarily incurring bounds-checking penalties.
		tile.deltas = new Uint8ClampedArray(
			deltas.buffer,
			deltas.byteOffset,
			deltas.length,
		);

		transaction.buffers.push(tile.deltas.buffer);
		if (performance.now() - start_time >= PROCESS_TIME) break;
	}

	if (transaction.data.deltas.length) {
		transactions.unshift(transaction);
		transactionHandlerId = setTimeout(() => transactionCallback(), 0);
		return;
	}

	// Transaction is complete, send it back.
	postMessage(
		{
			message: transaction.data.message,
			deltas: transaction.decompressed,
			tileSize: transaction.data.tileSize,
		},
		transaction.buffers,
	);

	if (transactions.length === 0) {
		transactionHandlerId = null;
		return;
	}

	// See if we have time to process further transactions
	transactionCallback(start_time);
}

if ('undefined' === typeof window) {
	self.L = {};

	importScripts('CanvasTileUtils.js');
	addEventListener('message', onMessage);

	console.info('CanvasTileWorker initialised');

	function onMessage(e) {
		switch (e.data.message) {
			case 'endTransaction':
				currentKeys = new Set(e.data.current);
				transactions.push({
					data: e.data,
					decompressed: [],
					buffers: [],
				});
				if (transactionHandlerId !== null) clearTimeout(transactionHandlerId);
				transactionCallback();
				break;

			default:
				console.error('Unrecognised worker message');
		}
	}
}
