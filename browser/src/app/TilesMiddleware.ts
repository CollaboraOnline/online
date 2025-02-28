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

// debugging aid.
function hex2string(inData: any, length: number) {
	var hexified = [];
	var data = new Uint8Array(inData);
	for (var i = 0; i < length; i++) {
		var hex = data[i].toString(16);
		var paddedHex = ('00' + hex).slice(-2);
		hexified.push(paddedHex);
	}
	return hexified.join('');
}

class TileCoordData {
	x: number;
	y: number;
	z: number;
	part: number;
	mode: number;

	constructor(
		left: number,
		top: number,
		zoom: number = null,
		part: number = null,
		mode: number = null,
	) {
		this.x = left;
		this.y = top;
		this.z = zoom !== null ? zoom : app.map.getZoom();
		this.part = part !== null ? part : app.map._docLayer._selectedPart;
		this.mode = mode !== undefined ? mode : 0;
	}

	getPos() {
		return new L.Point(this.x, this.y);
	}

	key(): string {
		return (
			this.x +
			':' +
			this.y +
			':' +
			this.z +
			':' +
			this.part +
			':' +
			(this.mode !== undefined ? this.mode : 0)
		);
	}

	toString(): string {
		return (
			'{ left : ' +
			this.x +
			', top : ' +
			this.y +
			', z : ' +
			this.z +
			', part : ' +
			this.part +
			', mode : ' +
			this.mode +
			' }'
		);
	}

	public static parseKey(key: string): TileCoordData {
		window.app.console.assert(
			typeof key === 'string',
			'key should be a string',
		);
		const k = key.split(':');
		const mode = k.length === 4 ? +k[4] : 0;
		window.app.console.assert(k.length >= 5, 'invalid key format');
		return new TileCoordData(+k[0], +k[1], +k[2], +k[3], mode);
	}

	public static keyToTileCoords(key: string): TileCoordData {
		return TileCoordData.parseKey(key);
	}
}

class PaneBorder {
	_border: any;
	_xFixed: boolean;
	_yFixed: boolean;
	_index: number;

	constructor(paneBorder: any, paneXFixed: boolean, paneYFixed: boolean) {
		this._border = paneBorder;
		this._xFixed = paneXFixed;
		this._yFixed = paneYFixed;
		this._index = 0;
	}

	getBorderIndex() {
		return this._index;
	}

	incBorderIndex() {
		this._index += 1;
	}

	getBorderBounds() {
		return this._border;
	}

	isXFixed() {
		return this._xFixed;
	}

	isYFixed() {
		return this._yFixed;
	}
}

class Tile {
	coords: TileCoordData;
	current: boolean = true; // is this currently visible
	canvas: any = null; // canvas ready to render
	imgDataCache: any = null; // flat byte array of canvas data
	rawDeltas: any = null; // deltas ready to decompress
	deltaCount: number = 0; // how many deltas on top of the keyframe
	updateCount: number = 0; // how many updates did we have
	loadCount: number = 0; // how many times did we get a new keyframe
	gcErrors: number = 0; // count freed keyframe in JS, but kept in wsd.
	missingContent: number = 0; // how many times rendered without content
	invalidateCount: number = 0; // how many invalidations touched this tile
	viewId: number = 0; // canonical view id
	wireId: number = 0; // monotonic timestamp for optimizing fetch
	invalidFrom: number = 0; // a wireId - for avoiding races on invalidation
	lastRendered: Date = new Date();
	private lastRequestTime: Date = undefined; // when did we last do a tilecombine request.
	hasPendingDelta: 0;
	hasPendingKeyframe: 0;

	constructor(coords: TileCoordData) {
		this.coords = coords;
	}

	hasContent(): boolean {
		return this.imgDataCache || this.hasKeyframe();
	}

	needsFetch() {
		return this.invalidFrom >= this.wireId || !this.hasContent();
	}

	needsRehydration(): boolean {
		return !this.imgDataCache && this.hasKeyframe();
	}

	hasKeyframe(): boolean {
		return this.rawDeltas && this.rawDeltas.length > 0;
	}

	hasPendingUpdate(): boolean {
		return this.hasPendingDelta > 0 || this.hasPendingKeyframe > 0;
	}

	/// Demand a whole tile back to the keyframe from coolwsd.
	forceKeyframe() {
		this.wireId = 0;
		this.invalidFrom = 0;
		this.allowFastRequest();
	}

	/// Avoid continually re-requesting tiles for eg. preloading
	requestingTooFast(now: Date): boolean {
		const tooFast: boolean = this.lastRequestTime &&
		    (now.getTime() - this.lastRequestTime.getTime()) < 5000 /* ms */;
		return tooFast;
	}

	updateLastRequest(now: Date) {
		this.lastRequestTime = now;
	}

	/// Allow faster requests
	allowFastRequest() {
		this.updateLastRequest(undefined);
	}
}

class TileManager {
	private static _docLayer: any;
	private static _zoom: number;
	private static _preFetchPart: number;
	private static _preFetchMode: number;
	private static _hasEditPerm: boolean;
	private static _pixelBounds: any;
	private static _splitPos: any;
	private static _borders: any;
	private static _cumTileCount: number;
	private static _preFetchIdle: any;
	private static _tilesPreFetcher: any;
	private static _partTilePreFetcher: any;
	private static _adjacentTilePreFetcher: any;
	private static inTransaction: number = 0;
	private static pendingTransactions: number = 0;
	private static pendingDeltas: any = [];
	private static transactionCallbacks: any = [];
	private static worker: any;
	private static gcCounter = 0; // Tile garbage collection counter
	private static nullDeltaUpdate = 0;
	private static queuedProcessed: any = [];
	private static fetchKeyframeQueue: any = []; // Queue of tiles which were GC'd earlier than coolwsd expected
	private static emptyTilesCount: number = 0;
	private static debugDeltas: boolean = false;
	private static debugDeltasDetail: boolean = false;
	private static tiles: any = {}; // stores all tiles, keyed by coordinates, and cached, compressed deltas

	//private static _debugTime: any = {}; Reserved for future.

	public static tileSize: number = 256;

	public static initialize() {
		if (window.Worker && !(window as any).ThisIsAMobileApp) {
			window.app.console.info('Creating CanvasTileWorker');
			this.worker = new Worker('src/layer/tile/TileWorker.js');
			this.worker.addEventListener('message', (e: any) =>
				this.onWorkerMessage(e),
			);
			this.worker.addEventListener('error', (e: any) => this.disableWorker(e));
		}
	}

	private static maybeGarbageCollect() {
		if (!(++this.gcCounter % 53)) this.garbageCollect();
	}

	// FIXME: could trim quite hard here, and do this at idle ...
	// Set a high and low watermark of how many canvases we want
	// and expire old ones
	private static garbageCollect() {
		// 4k screen -> 8Mpixel, each tile is 64kpixel uncompressed
		var highNumCanvases = 250; // ~60Mb.
		var lowNumCanvases = 125; // ~30Mb
		// real RAM sizes for keyframes + delta cache in memory.
		var highDeltaMemory = 120 * 1024 * 1024; // 120Mb
		var lowDeltaMemory = 60 * 1024 * 1024; // 60Mb
		// number of tiles
		var highTileCount = 2 * 1024;
		var lowTileCount = 1024;

		if (this.debugDeltas)
			window.app.console.log('Garbage collect! iter: ' + this.gcCounter);

		/* uncomment to exercise me harder. */
		/* highNumCanvases = 3; lowNumCanvases = 2;
		   highDeltaMemory = 1024*1024; lowDeltaMemory = 1024*128;
		   highTileCount = 100; lowTileCount = 50; */

		var keys: Array<string> = [];
		for (const key in this.tiles) // no .keys() method.
			keys.push(key);

		// FIXME: should we sort by wireId - which is monotonic server ~time
		// sort by oldest
		keys.sort(function (a: any, b: any) {
			return b.lastRendered - a.lastRendered;
		});

		var canvasKeys = [];
		var totalSize = 0;
		for (var i = 0; i < keys.length; ++i) {
			var tile = this.tiles[keys[i]];
			// Don't GC tiles that are visible or that have pending deltas. In
			// the latter case, those tiles would just be immediately recreated
			// and the former case can cause visible flicker.
			if (tile.canvas && !tile.current && tile.hasPendingDelta === 0)
				canvasKeys.push(keys[i]);
			totalSize += tile.rawDeltas ? tile.rawDeltas.length : 0;
		}

		// Trim ourselves down to size.
		if (canvasKeys.length > highNumCanvases) {
			for (var i = 0; i < canvasKeys.length - lowNumCanvases; ++i) {
				var key = canvasKeys[i];
				var tile = this.tiles[key];
				if (this.debugDeltas)
					window.app.console.log(
						'Reclaim canvas ' + key + ' last rendered: ' + tile.lastRendered,
					);
				this.reclaimTileCanvasMemory(tile);
			}
		}

		// Trim memory down to size.
		if (totalSize > highDeltaMemory) {
			for (var i = 0; i < keys.length && totalSize > lowDeltaMemory; ++i) {
				const key = keys[i];
				const tile: Tile = this.tiles[key];
				if (tile.rawDeltas && !tile.current) {
					totalSize -= tile.rawDeltas.length;
					if (this.debugDeltas)
						window.app.console.log(
							'Reclaim delta ' +
								key +
								' memory: ' +
								tile.rawDeltas.length +
								' bytes',
						);
					this.reclaimTileCanvasMemory(tile);
					tile.rawDeltas = null;
					// force keyframe
					tile.wireId = 0;
					tile.invalidFrom = 0;
				}
			}
		}

		// Trim the number of tiles down too ...
		if (keys.length > highTileCount) {
			for (var i = 0; i < keys.length - lowTileCount; ++i) {
				const key = keys[i];
				const tile: Tile = this.tiles[key];
				if (!tile.current) this.removeTile(keys[i]);
			}
		}
	}

	// work hard to ensure we get a canvas context to render with
	private static ensureContext(tile: Tile) {
		var ctx;

		this.maybeGarbageCollect();

		// important this is after the garbagecollect
		if (!tile.canvas) this.ensureCanvas(tile, null, false);

		if ((ctx = tile.canvas.getContext('2d'))) return ctx;

		// Not a good result - we ran out of canvas memory
		this.garbageCollect();

		if (!tile.canvas) this.ensureCanvas(tile, null, false);
		if ((ctx = tile.canvas.getContext('2d'))) return ctx;

		// Free non-current canvas' and start again.
		if (this.debugDeltas)
			window.app.console.log('Free non-current tiles canvas memory');
		for (var key in this.tiles) {
			var t = this.tiles[key];
			if (t && !t.current) this.reclaimTileCanvasMemory(t);
		}
		if (!tile.canvas) this.ensureCanvas(tile, null, false);
		if ((ctx = tile.canvas.getContext('2d'))) return ctx;

		if (this.debugDeltas)
			window.app.console.log(
				'Throw everything overbarod to free all tiles canvas memory',
			);
		for (var key in this.tiles) {
			var t = this.tiles[key];
			this.reclaimTileCanvasMemory(t);
		}
		if (!tile.canvas) this.ensureCanvas(tile, null, false);
		ctx = tile.canvas.getContext('2d');
		if (!ctx) window.app.console.log('Error: out of canvas memory.');
		return ctx;
	}

	private static decompressPendingDeltas(message: string) {
		if (this.worker) {
			this.worker.postMessage(
				{
					message: message,
					deltas: this.pendingDeltas,
					tileSize: this.tileSize,
				},
				this.pendingDeltas.map((x: any) => x.rawDelta.buffer),
			);
			++this.pendingTransactions;
		} else {
			for (var e of this.pendingDeltas) {
				// Synchronous path
				var tile = this.tiles[e.key];
				var deltas = (window as any).fzstd.decompress(e.rawDelta);

				var keyframeDeltaSize = 0;
				var keyframeImage = null;
				if (e.isKeyframe) {
					if (this.debugDeltas)
						window.app.console.log(
							'Applying a raw RLE keyframe of length ' +
								deltas.length +
								' hex: ' +
								hex2string(deltas, deltas.length),
						);

					var width = this.tileSize;
					var height = this.tileSize;
					var resultu8 = new Uint8ClampedArray(width * height * 4);
					keyframeDeltaSize = L.CanvasTileUtils.unrle(
						deltas,
						width,
						height,
						resultu8,
					);
					keyframeImage = new ImageData(resultu8, width, height);

					if (this.debugDeltas)
						window.app.console.log(
							'Applied keyframe of total size ' +
								resultu8.length +
								' at stream offset 0',
						);
				}

				this.applyDelta(
					tile,
					e.rawDelta,
					deltas,
					keyframeDeltaSize,
					keyframeImage,
					e.wireMessage,
					true,
				);

				if (e.isKeyframe) --tile.hasPendingKeyframe;
				else --tile.hasPendingDelta;
				if (!tile.hasPendingUpdate()) this.tileReady(tile.coords);
			}
		}
		this.pendingDeltas.length = 0;
	}

	private static applyCompressedDelta(
		tile: Tile,
		rawDelta: any,
		isKeyframe: any,
		wireMessage: any,
		rehydrate = true,
	) {
		if (this.inTransaction === 0)
			window.app.console.warn(
				'applyCompressedDelta called outside of transaction',
			);

		if (rehydrate && !tile.canvas && !isKeyframe) this.rehydrateTile(tile);

		// We need to own rawDelta for it to hang around outside of a transaction (which happens
		// with workers enabled). If we're rehydrating, we already own it.
		if (this.worker && !rehydrate) rawDelta = new Uint8Array(rawDelta);

		var e = {
			key: tile.coords.key(),
			rawDelta: rawDelta,
			isKeyframe: isKeyframe,
			wireMessage: wireMessage,
		};
		if (isKeyframe) ++tile.hasPendingKeyframe;
		else ++tile.hasPendingDelta;
		this.pendingDeltas.push(e);
	}

	private static applyDeltaChunk(
		imgData: any,
		delta: any,
		oldData: any,
		width: any,
		height: any,
		needsUnpremultiply: any,
	) {
		var pixSize = width * height * 4;
		if (this.debugDeltas)
			window.app.console.log(
				'Applying a delta of length ' +
					delta.length +
					' canvas size: ' +
					pixSize,
			);
		// + ' hex: ' + hex2string(delta, delta.length));

		var offset = 0;

		// Green-tinge the old-Data ...
		if (0) {
			for (var i = 0; i < pixSize; ++i) oldData[i * 4 + 1] = 128;
		}

		// wipe to grey.
		if (0) {
			for (var i = 0; i < pixSize * 4; ++i) imgData.data[i] = 128;
		}

		// Apply delta.
		var stop = false;
		for (var i = 0; i < delta.length && !stop; ) {
			switch (delta[i]) {
				case 99: // 'c': // copy row
					var count = delta[i + 1];
					var srcRow = delta[i + 2];
					var destRow = delta[i + 3];
					if (this.debugDeltasDetail)
						window.app.console.log(
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
					for (var cnt = 0; cnt < count; ++cnt) {
						var src = (srcRow + cnt) * width * 4;
						var dest = (destRow + cnt) * width * 4;
						for (var j = 0; j < width * 4; ++j) {
							imgData.data[dest + j] = oldData[src + j];
						}
					}
					break;
				case 100: // 'd': // new run
					destRow = delta[i + 1];
					var destCol = delta[i + 2];
					var span = delta[i + 3];
					offset = destRow * width * 4 + destCol * 4;
					if (this.debugDeltasDetail)
						window.app.console.log(
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
					if (needsUnpremultiply)
						L.CanvasTileUtils.unpremultiply(delta, span, i);
					for (var j = 0; j < span; ++j) imgData.data[offset++] = delta[i + j];
					i += span;
					// imgData.data[offset - 2] = 256; // debug - blue terminator
					break;
				case 116: // 't': // terminate delta new one next
					stop = true;
					i++;
					break;
				default:
					console.log('[' + i + ']: ERROR: Unknown delta code ' + delta[i]);
					i = delta.length;
					break;
			}
		}

		return i;
	}

	private static checkTileMsgObject(msgObj: any) {
		if (
			typeof msgObj !== 'object' ||
			typeof msgObj.x !== 'number' ||
			typeof msgObj.y !== 'number' ||
			typeof msgObj.tileWidth !== 'number' ||
			typeof msgObj.tileHeight !== 'number' ||
			typeof msgObj.part !== 'number' ||
			(typeof msgObj.mode !== 'number' && typeof msgObj.mode !== 'undefined')
		) {
			window.app.console.error(
				'Unexpected content in the parsed tile message.',
			);
		}
	}

	private static checkDocLayer() {
		if (this._docLayer) return true;
		else if (!this._docLayer && app.map._docLayer) {
			this._docLayer = app.map._docLayer;
			return true;
		} else return false;
	}

	private static getMaxTileCountToPrefetch(tileSize: number): number {
		const viewTileWidth = Math.floor(
			(this._pixelBounds.getSize().x + tileSize - 1) / tileSize,
		);

		const viewTileHeight = Math.floor(
			(this._pixelBounds.getSize().y + tileSize - 1) / tileSize,
		);

		// Read-only views can much more agressively pre-load
		return (
			Math.ceil((viewTileWidth * viewTileHeight) / 4) *
			(!this._hasEditPerm ? 4 : 1)
		);
	}

	private static updateProperties() {
		let updated: boolean = false;

		const zoom = app.map.getZoom();
		if (this._zoom !== zoom) {
			this._zoom = zoom;
			updated = true;
		}

		const part = this._docLayer._selectedPart;
		if (this._preFetchPart !== part) {
			this._preFetchPart = part;
			updated = true;
		}

		const mode = this._docLayer._selectedMode;
		if (this._preFetchMode !== mode) {
			this._preFetchMode = mode;
			updated = true;
		}

		const hasEditPerm = app.map.isEditMode();
		if (this._hasEditPerm !== hasEditPerm) {
			this._hasEditPerm = hasEditPerm;
			updated = true;
		}

		const center = app.map.getCenter();
		const pixelBounds = app.map.getPixelBoundsCore(center, this._zoom);
		if (!this._pixelBounds || !pixelBounds.equals(this._pixelBounds)) {
			this._pixelBounds = pixelBounds;
			updated = true;
		}

		const splitPanesContext = this._docLayer.getSplitPanesContext();
		const splitPos = splitPanesContext
			? splitPanesContext.getSplitPos()
			: new L.Point(0, 0);
		if (!this._splitPos || !splitPos.equals(this._splitPos)) {
			this._splitPos = splitPos;
			updated = true;
		}

		return updated;
	}

	private static computeBorders() {
		// Need to compute borders afresh and fetch tiles for them.
		this._borders = []; // Stores borders for each split-pane.
		const tileRanges = this.pxBoundsToTileRanges(this._pixelBounds);

		const splitPanesContext = this._docLayer.getSplitPanesContext();
		const paneStatusList = splitPanesContext
			? splitPanesContext.getPanesProperties()
			: [{ xFixed: false, yFixed: false }];

		window.app.console.assert(
			tileRanges.length === paneStatusList.length,
			'tileRanges and paneStatusList should agree on the number of split-panes',
		);

		for (let paneIdx = 0; paneIdx < tileRanges.length; ++paneIdx) {
			if (paneStatusList[paneIdx].xFixed && paneStatusList[paneIdx].yFixed) {
				continue;
			}

			const tileRange = tileRanges[paneIdx];
			const paneBorder = new L.Bounds(
				tileRange.min.add(new L.Point(-1, -1)),
				tileRange.max.add(new L.Point(1, 1)),
			);

			this._borders.push(
				new PaneBorder(
					paneBorder,
					paneStatusList[paneIdx].xFixed,
					paneStatusList[paneIdx].yFixed,
				),
			);
		}
	}

	private static clearTilesPreFetcher() {
		if (this._tilesPreFetcher !== undefined) {
			clearInterval(this._tilesPreFetcher);
			this._tilesPreFetcher = undefined;
		}
	}

	private static preFetchPartTiles(part: number, mode: number): void {
		this.updateProperties();

		const tileRange = this.pxBoundsToTileRange(this._pixelBounds);
		const tileCombineQueue = [];

		for (let j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (let i = tileRange.min.x; i <= tileRange.max.x; i++) {
				const coords = new TileCoordData(
					i * this.tileSize,
					j * this.tileSize,
					this._zoom,
					part,
					mode,
				);

				if (!this.isValidTile(coords)) continue;

				const key = coords.key();
				if (!this.tileNeedsFetch(key)) continue;

				tileCombineQueue.push(coords);
			}
		}

		this.sendTileCombineRequest(tileCombineQueue);
	}

	private static queueAcknowledgement(tileMsgObj: any) {
		// Queue acknowledgment, that the tile message arrived
		this.queuedProcessed.push(+tileMsgObj.wireId);
	}

	private static twipsToCoords(twips: any) {
		return new TileCoordData(
			Math.round(twips.x / twips.tileWidth) * this.tileSize,
			Math.round(twips.y / twips.tileHeight) * this.tileSize,
		);
	}

	private static tileMsgToCoords(tileMsg: any) {
		var coords = this.twipsToCoords(tileMsg);
		coords.z = tileMsg.zoom;
		coords.part = tileMsg.part;
		coords.mode = tileMsg.mode !== undefined ? tileMsg.mode : 0;
		return coords;
	}

	private static checkPointers() {
		if (app.map && app.map._docLayer) return true;
		else return false;
	}

	private static hasPendingTransactions() {
		return this.inTransaction > 0 || this.pendingTransactions > 0;
	}

	private static beginTransaction() {
		++this.inTransaction;
	}

	private static tileReady(coords: TileCoordData) {
		var key = coords.key();

		var tile: Tile = this.tiles[key];
		if (!tile) return;

		var emptyTilesCountChanged = false;
		if (this.emptyTilesCount > 0) {
			this.emptyTilesCount -= 1;
			emptyTilesCountChanged = true;
		}

		if (app.map && emptyTilesCountChanged && this.emptyTilesCount === 0) {
			app.map.fire('statusindicator', { statusType: 'alltilesloaded' });
		}

		var now = new Date();

		// Newly (pre)-fetched tiles, rendered or not should be privileged.
		tile.lastRendered = now;

		// Don't paint the tile, only dirty the sectionsContainer if it is in the visible area.
		// _emitSlurpedTileEvents() will repaint canvas (if it is dirty).
		if (app.map._docLayer._painter.coordsIntersectVisible(coords)) {
			app.sectionContainer.setDirty(coords);
		}
	}

	private static createTile(coords: TileCoordData, key: string) {
		if (this.tiles[key]) {
			if (this.debugDeltas)
				window.app.console.debug('Already created tile ' + key);
			return this.tiles[key];
		}
		const tile = new Tile(coords);

		this.tiles[key] = tile;

		return tile;
	}

	// Make the given tile current and rehydrates if necessary. Returns true if the tile
	// has pending updates.
	private static makeTileCurrent(tile: Tile): boolean {
		tile.current = true;

		if (tile.needsRehydration()) this.rehydrateTile(tile);

		return tile.hasPendingUpdate();
	}

	private static rehydrateTile(tile: Tile) {
		if (tile.hasKeyframe() && tile.hasPendingKeyframe === 0) {
			// Re-hydrate tile from cached raw deltas.
			if (this.debugDeltas)
				window.app.console.log(
					'Restoring a tile from cached delta at ' + tile.coords.key(),
				);
			this.applyCompressedDelta(tile, tile.rawDeltas, true, false, false);
		}
	}

	private static endTransaction(callback: any = null) {
		if (this.inTransaction === 0) {
			window.app.console.error('Mismatched endTransaction');
			return;
		}

		--this.inTransaction;

		// Ignore transactions that did nothing
		if (this.pendingDeltas.length === 0 && !this.hasPendingTransactions()) {
			if (callback) callback();
			return;
		}

		this.transactionCallbacks.push(callback);
		if (this.inTransaction !== 0) return;

		try {
			this.decompressPendingDeltas('endTransaction');
		} catch (e) {
			window.app.console.error('Failed to decompress pending deltas');
			this.inTransaction = 0;
			this.disableWorker(e);
			if (callback) callback();
			return;
		}

		if (!this.worker) {
			while (this.transactionCallbacks.length) {
				callback = this.transactionCallbacks.pop();
				if (callback) callback();
			}
		}
	}

	private static disableWorker(e: any = null) {
		if (e) window.app.console.error('Worker-related error encountered', e);
		if (!this.worker) return;

		window.app.console.log('Disabling worker thread');
		try {
			this.worker.terminate();
		} catch (e) {
			window.app.console.error('Error terminating worker thread', e);
		}

		this.pendingDeltas.length = 0;
		this.pendingTransactions = 0;
		this.worker = null;
		while (this.transactionCallbacks.length) {
			var callback = this.transactionCallbacks.pop();
			if (callback) callback();
		}
		this.redraw();
	}

	private static applyDelta(
		tile: Tile,
		rawDelta: any,
		deltas: any,
		keyframeDeltaSize: any,
		keyframeImage: any,
		wireMessage: any,
		deltasNeedUnpremultiply: any,
	) {
		// 'Uint8Array' rawDelta

		if (this.debugDeltas)
			window.app.console.log(
				'Applying a raw ' +
					(keyframeDeltaSize ? 'keyframe' : 'delta') +
					' of length ' +
					rawDelta.length +
					(this.debugDeltasDetail
						? ' hex: ' + hex2string(rawDelta, rawDelta.length)
						: ''),
			);

		if (keyframeDeltaSize) {
			// Important to do this before ensuring the context, or we'll needlessly
			// reconstitute the old keyframe from compressed data.
			tile.rawDeltas = null;
			tile.imgDataCache = null;
		}

		var ctx = this.ensureContext(tile);
		if (!ctx)
			// out of canvas / texture memory.
			return;

		// if re-creating a canvas from rawDeltas, don't update counts
		if (wireMessage) {
			if (keyframeDeltaSize) {
				tile.loadCount++;
				tile.deltaCount = 0;
				tile.updateCount = 0;
				if (app.map._debug.tileDataOn) {
					app.map._debug.tileDataAddLoad();
				}
			} else if (rawDelta.length === 0) {
				tile.updateCount++;
				this.nullDeltaUpdate++;
				if (app.map._docLayer._emptyDeltaDiv) {
					app.map._docLayer._emptyDeltaDiv.innerText = this.nullDeltaUpdate;
				}
				if (app.map._debug.tileDataOn) {
					app.map._debug.tileDataAddUpdate();
				}
				return; // that was easy
			} else {
				tile.deltaCount++;
				if (app.map._debug.tileDataOn) {
					app.map._debug.tileDataAddDelta();
				}
			}
		}
		// else - re-constituting from tile.rawData

		var traceEvent = app.socket.createCompleteTraceEvent(
			'L.CanvasTileLayer.applyDelta',
			{ keyFrame: !!keyframeDeltaSize, length: rawDelta.length },
		);

		// store the compressed version for later in its current
		// form as byte arrays, so that we can manage our canvases
		// better.
		if (keyframeDeltaSize) {
			tile.rawDeltas = rawDelta; // overwrite
		} else if (!tile.hasKeyframe()) {
			window.app.console.warn(
				'Unusual: attempt to append a delta when we have no keyframe.',
			);
			return;
		} // assume we already have a delta.
		else {
			// FIXME: this is not beautiful; but no concatenate here.
			var tmp = new Uint8Array(tile.rawDeltas.byteLength + rawDelta.byteLength);
			tmp.set(tile.rawDeltas, 0);
			tmp.set(rawDelta, tile.rawDeltas.byteLength);
			tile.rawDeltas = tmp;
		}

		// apply potentially several deltas in turn.
		var i = 0;

		// May have been changed by _ensureContext garbage collection
		var canvas = tile.canvas;

		// If it's a new keyframe, use the given image and offset
		var imgData = keyframeImage;
		var offset = keyframeDeltaSize;

		while (offset < deltas.length) {
			if (this.debugDeltas)
				window.app.console.log(
					'Next delta at ' + offset + ' length ' + (deltas.length - offset),
				);

			var delta = !offset ? deltas : deltas.subarray(offset);

			// Debugging paranoia: if we get this wrong bad things happen.
			if (delta.length >= canvas.width * canvas.height * 4) {
				window.app.console.warn(
					'Unusual delta possibly mis-tagged, suspicious size vs. type ' +
						delta.length +
						' vs. ' +
						canvas.width * canvas.height * 4,
				);
			}

			if (!imgData)
				// no keyframe
				imgData = tile.imgDataCache;
			if (!imgData) {
				if (this.debugDeltas) window.app.console.log('Fetch canvas contents');
				imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			}

			// copy old data to work from:
			var oldData = new Uint8ClampedArray(imgData.data);

			var len = this.applyDeltaChunk(
				imgData,
				delta,
				oldData,
				canvas.width,
				canvas.height,
				deltasNeedUnpremultiply,
			);
			if (this.debugDeltas)
				window.app.console.log(
					'Applied chunk ' +
						i++ +
						' of total size ' +
						delta.length +
						' at stream offset ' +
						offset +
						' size ' +
						len,
				);

			offset += len;
		}

		if (imgData) {
			// hold onto the original imgData for reuse in the no keyframe case
			tile.imgDataCache = imgData;
			ctx.putImageData(imgData, 0, 0);
		}

		if (traceEvent) traceEvent.finish();
	}

	private static removeTile(key: string) {
		var tile = this.tiles[key];
		if (!tile) return;

		if (
			!tile.hasContent() &&
			tile.hasPendingKeyframe === 0 &&
			this.emptyTilesCount > 0
		)
			this.emptyTilesCount -= 1;

		this.reclaimTileCanvasMemory(tile);
		delete this.tiles[key];
	}

	private static removeAllTiles() {
		for (var key in this.tiles) {
			this.removeTile(key);
		}
	}

	private static sortFileBasedQueue(queue: any) {
		for (var i = 0; i < queue.length - 1; i++) {
			for (var j = i + 1; j < queue.length; j++) {
				var a = queue[i];
				var b = queue[j];
				var switchTiles = false;

				if (a.part === b.part) {
					if (a.y > b.y) {
						switchTiles = true;
					} else if (a.y === b.y) {
						switchTiles = a.x > b.x;
					} else {
						switchTiles = false;
					}
				} else {
					switchTiles = a.part > b.part;
				}

				if (switchTiles) {
					var temp = a;
					queue[i] = b;
					queue[j] = temp;
				}
			}
		}
	}

	// Fix for cool#5876 allow immediate reuse of canvas context memory
	// WKWebView has a hard limit on the number of bytes of canvas
	// context memory that can be allocated. Reducing the canvas
	// size to zero is a way to reduce the number of bytes counted
	// against this limit.
	private static reclaimTileCanvasMemory(tile: Tile) {
		if (tile && tile.canvas) {
			tile.canvas.width = 0;
			tile.canvas.height = 0;
			delete tile.canvas;
		}
		tile.imgDataCache = null;
	}

	private static initPreFetchPartTiles() {
		if (!this.checkDocLayer()) return;

		const targetPart = this._docLayer._selectedPart + app.map._partsDirection;

		if (targetPart < 0 || targetPart >= this._docLayer._parts) return;

		// check existing timeout and clear it before the new one
		if (this._partTilePreFetcher) clearTimeout(this._partTilePreFetcher);

		this._partTilePreFetcher = setTimeout(() => {
			this.preFetchPartTiles(targetPart, this._docLayer._selectedMode);
		}, 100);
	}

	private static initPreFetchAdjacentTiles() {
		if (!this.checkDocLayer()) return;

		this.updateProperties();

		if (this._adjacentTilePreFetcher)
			clearTimeout(this._adjacentTilePreFetcher);

		this._adjacentTilePreFetcher = setTimeout(
			function () {
				// Extend what we request to include enough to populate a full
				// scroll in the direction we were going after or before
				// the current viewport
				//
				// request separately from the current viewPort to get
				// those tiles first.

				const direction = app.sectionContainer.getLastPanDirection();

				// Conservatively enlarge the area to round to more tiles:
				const pixelTopLeft = this._pixelBounds.getTopLeft();
				pixelTopLeft.y =
					Math.floor(pixelTopLeft.y / this.tileSize) * this.tileSize;
				pixelTopLeft.y -= 1;

				const pixelBottomRight = this._pixelBounds.getBottomRight();
				pixelBottomRight.y =
					Math.ceil(pixelBottomRight.y / this.tileSize) * this.tileSize;
				pixelBottomRight.y += 1;

				this._pixelBounds = new L.Bounds(pixelTopLeft, pixelBottomRight);

				// Translate the area in the direction we're going.
				this._pixelBounds.translate(
					this._pixelBounds.getSize().x * direction[0],
					this._pixelBounds.getSize().y * direction[1],
				);

				var queue = this.getMissingTiles(this._pixelBounds, this._zoom);

				if (this._docLayer.isCalc() || queue.length === 0) {
					// pre-load more aggressively
					this._pixelBounds.translate(
						(this._pixelBounds.getSize().x * direction[0]) / 2,
						(this._pixelBounds.getSize().y * direction[1]) / 2,
					);
					queue = queue.concat(
						this.getMissingTiles(this._pixelBounds, this._zoom),
					);
				}

				if (queue.length !== 0) this.addTiles(queue, true);
			}.bind(this),
			50 /*ms*/,
		);
	}

	private static sendTileCombineRequest(
		tileCombineQueue: Array<TileCoordData>,
	) {
		if (tileCombineQueue.length <= 0) return;

		// Sort into buckets of consistent part & mode.
		const partMode: any = {};
		for (var i = 0; i < tileCombineQueue.length; ++i) {
			const coords = tileCombineQueue[i];
			// mode is a small number - give it 8 bits
			const pmKey = (coords.part << 8) + coords.mode;
			if (partMode[pmKey] === undefined) partMode[pmKey] = [];
			partMode[pmKey].push(coords);
		}

		var now = new Date();

		for (var pmKey in partMode) {
			// no keys method
			var partTileQueue = partMode[pmKey];
			var part = partTileQueue[0].part;
			var mode = partTileQueue[0].mode;

			var tilePositionsX = [];
			var tilePositionsY = [];
			var tileWids = [];

			var added: any = {}; // uniqify
			var hasTiles = false;
			for (var i = 0; i < partTileQueue.length; ++i) {
				var coords = partTileQueue[i];
				var key = coords.key();
				var tile = this.tiles[key];

				// don't send lots of duplicate, fast tilecombines
				if (tile && tile.requestingTooFast(now))
					continue;

				// request each tile just once in these tilecombines
				if (added[key]) continue;
				added[key] = true;
				hasTiles = true;

				// build parameters
				tileWids.push(tile && tile.wireId !== undefined ? tile.wireId : 0);

				const twips = new L.Point(
					Math.floor(coords.x / this.tileSize) *
						app.map._docLayer._tileWidthTwips,
					Math.floor(coords.y / this.tileSize) *
						app.map._docLayer._tileHeightTwips,
				);

				tilePositionsX.push(twips.x);
				tilePositionsY.push(twips.y);

				if (tile)
					tile.updateLastRequest(now);
			}

			var msg =
				'tilecombine ' +
				'nviewid=0 ' +
				'part=' +
				part +
				' ' +
				(mode !== 0 ? 'mode=' + mode + ' ' : '') +
				'width=' +
				app.map._docLayer._tileWidthPx +
				' ' +
				'height=' +
				app.map._docLayer._tileHeightPx +
				' ' +
				'tileposx=' +
				tilePositionsX.join(',') +
				' ' +
				'tileposy=' +
				tilePositionsY.join(',') +
				' ' +
				'oldwid=' +
				tileWids.join(',') +
				' ' +
				'tilewidth=' +
				app.map._docLayer._tileWidthTwips +
				' ' +
				'tileheight=' +
				app.map._docLayer._tileHeightTwips;
			if (hasTiles)
				app.socket.sendMessage(msg, '');
			else
				window.app.console.log('Skipped empty (too fast) tilecombine');
		}
	}

	private static tileNeedsFetch(key: string) {
		const tile: Tile = this.tiles[key];
		return !tile || tile.needsFetch();
	}

	private static pxBoundsToTileRanges(bounds: any) {
		if (!this.checkPointers()) return null;

		if (!app.map._docLayer._splitPanesContext) {
			return [this.pxBoundsToTileRange(bounds)];
		}

		var boundList = app.map._docLayer._splitPanesContext.getPxBoundList(bounds);
		return boundList.map(this.pxBoundsToTileRange, this);
	}

	private static getMissingTiles(pixelBounds: any, zoom: number) {
		var tileRanges = this.pxBoundsToTileRanges(pixelBounds);
		var queue = [];

		// create a queue of coordinates to load tiles from
		this.beginTransaction();
		var redraw = false;
		for (var rangeIdx = 0; rangeIdx < tileRanges.length; ++rangeIdx) {
			var tileRange = tileRanges[rangeIdx];
			for (var j = tileRange.min.y; j <= tileRange.max.y; ++j) {
				for (var i = tileRange.min.x; i <= tileRange.max.x; ++i) {
					var coords = new TileCoordData(
						i * this.tileSize,
						j * this.tileSize,
						zoom,
						app.map._docLayer._selectedPart,
						app.map._docLayer._selectedMode,
					);

					if (!this.isValidTile(coords)) {
						continue;
					}

					var key = coords.key();
					var tile = this.tiles[key];
					if (tile && !tile.needsFetch())
						redraw = redraw || this.makeTileCurrent(tile);
					else queue.push(coords);
				}
			}
		}
		this.endTransaction(
			redraw ? () => app.sectionContainer.requestReDraw() : null,
		);

		return queue;
	}

	private static removeIrrelevantsFromCoordsQueue(
		coordsQueue: Array<TileCoordData>,
	) {
		const part: number = app.map._docLayer._selectedPart;
		const mode: number = app.map._docLayer._selectedMode;

		for (let i = coordsQueue.length - 1; i > 0; i--) {
			if (
				coordsQueue[i].part !== part ||
				coordsQueue[i].mode !== mode ||
				!this.tileNeedsFetch(coordsQueue[i].key())
			) {
				coordsQueue.splice(i, 1);
			} else if (app.map._docLayer._moveInProgress) {
				// While we are actively scrolling, filter out duplicate
				// (still) missing tiles requests during the scroll.
				if (app.map._docLayer._moveTileRequests.includes(coordsQueue[i].key()))
					coordsQueue.splice(i, 1);
				else app.map._docLayer._moveTileRequests.push(coordsQueue[i].key());
			}
		}
	}

	// create tiles if needed for queued coordinates, and build a
	// tilecombined request for any tiles we need to fetch.
	private static addTiles(
		coordsQueue: Array<TileCoordData>,
		preFetch: boolean = false,
	) {
		// Remove irrelevant tiles from the queue earlier.
		this.removeIrrelevantsFromCoordsQueue(coordsQueue);

		// If we're pre-fetching, we may end up rehydrating tiles, so begin a transaction
		// so that they're grouped together.
		if (preFetch) this.beginTransaction();

		let redraw: boolean = false;

		for (let i = 0; i < coordsQueue.length; i++) {
			const key = coordsQueue[i].key();
			let tile: Tile = this.tiles[key];

			// We always want to ensure the tile exists.
			if (!tile) tile = this.createTile(coordsQueue[i], key);

			if (preFetch) {
				// If preFetching at idle, take the
				// opportunity to create an up to date
				// canvas for the tile in advance.
				this.ensureCanvas(tile, null, true);
				redraw = redraw || tile.hasPendingUpdate();
			}
		}

		if (preFetch) {
			this.endTransaction(
				redraw ? () => app.sectionContainer.requestReDraw() : null,
			);
		}

		// sort the tiles by the rows
		coordsQueue.sort(function (a, b) {
			if (a.y !== b.y) return a.y - b.y;
			else return a.x - b.x;
		});

		// try group the tiles into rectangular areas
		const rectangles = [];
		while (coordsQueue.length > 0) {
			const coords: TileCoordData = coordsQueue[0];

			const rectQueue: Array<TileCoordData> = [coords];
			const bound = coords.getPos(); // L.Point

			// remove it
			coordsQueue.splice(0, 1);

			// find the close ones
			let rowLocked = false;
			let hasHole = false;
			let i = 0;
			while (i < coordsQueue.length) {
				const current: TileCoordData = coordsQueue[i];

				// extend the bound vertically if possible (so far it was continuous)
				if (!hasHole && current.y === bound.y + this.tileSize) {
					rowLocked = true;
					bound.y += this.tileSize;
				}

				if (current.y > bound.y) break;

				if (!rowLocked) {
					if (current.y === bound.y && current.x === bound.x + this.tileSize) {
						// extend the bound horizontally
						bound.x += this.tileSize;
						rectQueue.push(current);
						coordsQueue.splice(i, 1);
					} else {
						// ignore the rest of the row
						rowLocked = true;
						++i;
					}
				} else if (current.x <= bound.x && current.y <= bound.y) {
					// we are inside the bound
					rectQueue.push(current);
					coordsQueue.splice(i, 1);
				} else {
					// ignore this one, but there still may be other tiles
					hasHole = true;
					++i;
				}
			}

			rectangles.push(rectQueue);
		}

		for (let r = 0; r < rectangles.length; ++r)
			this.sendTileCombineRequest(rectangles[r]);

		if (
			app.map._docLayer._docType === 'presentation' ||
			app.map._docLayer._docType === 'drawing'
		)
			this.initPreFetchPartTiles();
	}

	public static refreshTilesInBackground() {
		for (const key in this.tiles) {
			this.tiles[key].wireId = 0;
			this.tiles[key].invalidFrom = 0;
		}
	}

	public static setDebugDeltas(state: boolean) {
		this.debugDeltas = state;
		this.debugDeltasDetail = state;
	}

	public static get(key: string): Tile {
		return this.tiles[key];
	}

	private static coordsToTileBounds(coords: TileCoordData): number[] {
		var zoomFactor = app.map.zoomToFactor(coords.z);
		const x =
			(coords.x * app.map._docLayer._tileWidthTwips) /
			this.tileSize /
			zoomFactor;
		const y =
			(coords.y * app.map._docLayer._tileHeightTwips) /
			this.tileSize /
			zoomFactor;
		const width = app.map._docLayer._tileWidthTwips / zoomFactor;
		const height = app.map._docLayer._tileHeightTwips / zoomFactor;

		return [x, y, width, height];
	}

	public static overlapInvalidatedRectangleWithView(
		part: number,
		mode: number,
		wireId: number,
		invalidatedRectangle: cool.SimpleRectangle,
		textMsg: string,
	) {
		let needsNewTiles = false;

		for (const key in this.tiles) {
			const coords: TileCoordData = this.tiles[key].coords;
			const tileRectangle = this.coordsToTileBounds(coords);

			if (
				coords.part === part &&
				coords.mode === mode &&
				invalidatedRectangle.intersectsRectangle(tileRectangle)
			) {
				if (app.isRectangleVisibleInTheDisplayedArea(tileRectangle))
					needsNewTiles = true;

				this.invalidateTile(key, wireId);
			}
		}

		if (
			app.map._docLayer._debug.tileInvalidationsOn &&
			part === app.map._docLayer._selectedPart
		) {
			app.map._docLayer._debug.addTileInvalidationRectangle(
				invalidatedRectangle.toArray(),
				textMsg,
			);

			if (needsNewTiles && mode === app.map._docLayer._selectedMode)
				app.map._docLayer._debug.addTileInvalidationMessage(textMsg);
		}
	}

	public static resetPreFetching(resetBorder: boolean) {
		if (!this.checkDocLayer()) return;

		this.clearPreFetch();

		if (resetBorder) this._borders = undefined;

		var interval = 250;
		var idleTime = 750;
		this._preFetchPart = this._docLayer._selectedPart;
		this._preFetchMode = this._docLayer._selectedMode;
		this._preFetchIdle = setTimeout(
			L.bind(function () {
				this._tilesPreFetcher = setInterval(
					L.bind(this.preFetchTiles, this),
					interval,
				);
				this._preFetchIdle = undefined;
				this._cumTileCount = 0;
			}, this),
			idleTime,
		);
	}

	public static clearPreFetch() {
		if (!this.checkDocLayer()) return;

		this.clearTilesPreFetcher();
		if (this._preFetchIdle !== undefined) {
			clearTimeout(this._preFetchIdle);
			this._preFetchIdle = undefined;
		}
	}

	public static preFetchTiles(forceBorderCalc: boolean, immediate: boolean) {
		if (!this.checkDocLayer()) return;

		if (app.file.fileBasedView && this._docLayer) this.updateFileBasedView();

		if (
			!this._docLayer ||
			this.emptyTilesCount > 0 ||
			!this._docLayer._canonicalIdInitialized
		)
			return;

		const propertiesUpdated = this.updateProperties();
		const tileSize = this.tileSize;
		const maxTilesToFetch = this.getMaxTileCountToPrefetch(tileSize);
		const maxBorderWidth = !this._hasEditPerm ? 40 : 10;

		// FIXME: when we are actually editing we should pre-load much less until we stop
		/*		if (isActiveEditing()) {
			maxTilesToFetch = 5;
			maxBorderWidth = 2;
		} */

		if (
			propertiesUpdated ||
			forceBorderCalc ||
			!this._borders ||
			this._borders.length === 0
		)
			this.computeBorders();

		var finalQueue = [];
		const visitedTiles: any = {};

		var validTileRange = new L.Bounds(
			new L.Point(0, 0),
			new L.Point(
				Math.floor(
					(this._docLayer._docWidthTwips - 1) / this._docLayer._tileWidthTwips,
				),
				Math.floor(
					(this._docLayer._docHeightTwips - 1) /
						this._docLayer._tileHeightTwips,
				),
			),
		);

		var tilesToFetch = immediate ? Infinity : maxTilesToFetch; // total tile limit per call of preFetchTiles()
		var doneAllPanes = true;

		for (let paneIdx = 0; paneIdx < this._borders.length; ++paneIdx) {
			const queue = [];
			const paneBorder = this._borders[paneIdx];
			const borderBounds = paneBorder.getBorderBounds();
			const paneXFixed = paneBorder.isXFixed();
			const paneYFixed = paneBorder.isYFixed();

			while (tilesToFetch > 0 && paneBorder.getBorderIndex() < maxBorderWidth) {
				const clampedBorder = validTileRange.clamp(borderBounds);
				const fetchTopBorder =
					!paneYFixed && borderBounds.min.y === clampedBorder.min.y;
				const fetchBottomBorder =
					!paneYFixed && borderBounds.max.y === clampedBorder.max.y;
				const fetchLeftBorder =
					!paneXFixed && borderBounds.min.x === clampedBorder.min.x;
				const fetchRightBorder =
					!paneXFixed && borderBounds.max.x === clampedBorder.max.x;

				if (
					!fetchLeftBorder &&
					!fetchRightBorder &&
					!fetchTopBorder &&
					!fetchBottomBorder
				) {
					break;
				}

				if (fetchBottomBorder) {
					for (var i = clampedBorder.min.x; i <= clampedBorder.max.x; i++) {
						// tiles below the visible area
						queue.push(
							new TileCoordData(
								i * tileSize,
								borderBounds.max.y * tileSize,
								this._zoom,
								this._preFetchPart,
								this._preFetchMode,
							),
						);
					}
				}

				if (fetchTopBorder) {
					for (i = clampedBorder.min.x; i <= clampedBorder.max.x; i++) {
						// tiles above the visible area
						queue.push(
							new TileCoordData(
								i * tileSize,
								borderBounds.min.y * tileSize,
								this._zoom,
								this._preFetchPart,
								this._preFetchMode,
							),
						);
					}
				}

				if (fetchRightBorder) {
					for (i = clampedBorder.min.y; i <= clampedBorder.max.y; i++) {
						// tiles to the right of the visible area
						queue.push(
							new TileCoordData(
								borderBounds.max.x * tileSize,
								i * tileSize,
								this._zoom,
								this._preFetchPart,
								this._preFetchMode,
							),
						);
					}
				}

				if (fetchLeftBorder) {
					for (i = clampedBorder.min.y; i <= clampedBorder.max.y; i++) {
						// tiles to the left of the visible area
						queue.push(
							new TileCoordData(
								borderBounds.min.x * tileSize,
								i * tileSize,
								this._zoom,
								this._preFetchPart,
								this._preFetchMode,
							),
						);
					}
				}

				var tilesPending = false;
				for (i = 0; i < queue.length; i++) {
					const coords = queue[i];
					const key: string = coords.key();

					if (
						visitedTiles[key] ||
						!this.isValidTile(coords) ||
						!this.tileNeedsFetch(key)
					)
						continue;

					if (tilesToFetch > 0) {
						visitedTiles[key] = true;
						finalQueue.push(coords);
						tilesToFetch -= 1;
					} else {
						tilesPending = true;
					}
				}

				if (tilesPending) {
					// don't update the border as there are still
					// some tiles to be fetched
					continue;
				}

				if (!paneXFixed) {
					if (borderBounds.min.x > 0) {
						borderBounds.min.x -= 1;
					}
					if (borderBounds.max.x < validTileRange.max.x) {
						borderBounds.max.x += 1;
					}
				}

				if (!paneYFixed) {
					if (borderBounds.min.y > 0) {
						borderBounds.min.y -= 1;
					}

					if (borderBounds.max.y < validTileRange.max.y) {
						borderBounds.max.y += 1;
					}
				}

				paneBorder.incBorderIndex();
			} // border width loop end

			if (paneBorder.getBorderIndex() < maxBorderWidth) {
				doneAllPanes = false;
			}
		} // pane loop end

		if (!immediate)
			window.app.console.assert(
				finalQueue.length <= maxTilesToFetch,
				'finalQueue length(' +
					finalQueue.length +
					') exceeded maxTilesToFetch(' +
					maxTilesToFetch +
					')',
			);

		var tilesRequested = false;

		if (finalQueue.length > 0) {
			this._cumTileCount += finalQueue.length;
			this.addTiles(finalQueue, !immediate);
			tilesRequested = true;
		}

		if (!tilesRequested || doneAllPanes) {
			this.clearTilesPreFetcher();
			this._borders = undefined;
		}
	}

	public static sendProcessedResponse() {
		var toSend = this.queuedProcessed;
		this.queuedProcessed = [];
		if (toSend.length > 0)
			app.socket.sendMessage('tileprocessed wids=' + toSend.join(','));
		if (this.fetchKeyframeQueue.length > 0) {
			window.app.console.warn('re-fetching prematurely GCd keyframes');
			this.sendTileCombineRequest(this.fetchKeyframeQueue);
			this.fetchKeyframeQueue = [];
		}
	}

	public static onTileMsg(textMsg: string, img: any) {
		var tileMsgObj: any = app.socket.parseServerCmd(textMsg);
		this.checkTileMsgObject(tileMsgObj);

		if (app.map._debug.tileDataOn) {
			app.map._debug.tileDataAddMessage();
		}

		// a rather different code-path with a png; should have its own msg perhaps.
		if (tileMsgObj.id !== undefined) {
			app.map.fire('tilepreview', {
				tile: img,
				id: tileMsgObj.id,
				width: tileMsgObj.width,
				height: tileMsgObj.height,
				part: tileMsgObj.part,
				mode: tileMsgObj.mode !== undefined ? tileMsgObj.mode : 0,
				docType: app.map._docLayer._docType,
			});
			this.queueAcknowledgement(tileMsgObj);
			return;
		}

		var coords = this.tileMsgToCoords(tileMsgObj);
		var key = coords.key();
		var tile = this.tiles[key];

		if (!tile) tile = this.createTile(coords, key);

		tile.viewId = tileMsgObj.nviewid;
		// update monotonic timestamp
		tile.wireId = +tileMsgObj.wireId;
		if (tile.invalidFrom == tile.wireId)
			window.app.console.debug('Nasty - updated wireId matches old one');

		var hasContent = img != null;

		// obscure case: we could have garbage collected the
		// keyframe content in JS but coolwsd still thinks we have
		// it and now we just have a delta with nothing to apply
		// it to; if so, mark it bad to re-fetch.
		if (
			img &&
			!img.isKeyframe &&
			!tile.hasKeyframe() &&
			tile.hasPendingKeyframe === 0
		) {
			window.app.console.debug(
				'Unusual: Delta sent - but we have no keyframe for ' + key,
			);
			// force keyframe
			tile.forceKeyframe();
			tile.gcErrors++;

			// queue a later fetch of this and any other
			// rogue tiles in this state
			this.fetchKeyframeQueue.push(coords);

			hasContent = false;
		}

		// updates don't need more chattiness with a tileprocessed
		if (hasContent) {
			this.applyCompressedDelta(tile, img.rawData, img.isKeyframe, true);
		}

		this.queueAcknowledgement(tileMsgObj);
	}

	// Returns a guess of how many tiles are yet to arrive
	public static predictTilesToSlurp() {
		if (!this.checkPointers()) return 0;

		var size = app.map.getSize();

		if (size.x === 0 || size.y === 0) return 0;

		var zoom = Math.round(app.map.getZoom());
		var pixelBounds = app.map.getPixelBoundsCore(app.map.getCenter(), zoom);

		var queue = this.getMissingTiles(pixelBounds, zoom);

		return queue.length;
	}

	public static pruneTiles() {
		// update tile.current for the view
		if (app.file.fileBasedView) this.updateFileBasedView(true);

		this.garbageCollect();
	}

	public static isValidTile(coords: TileCoordData) {
		if (coords.x < 0 || coords.y < 0) {
			return false;
		} else if (
			(coords.x / this.tileSize) * app.map._docLayer._tileWidthTwips >
				app.map._docLayer._docWidthTwips ||
			(coords.y / this.tileSize) * app.map._docLayer._tileHeightTwips >
				app.map._docLayer._docHeightTwips
		) {
			return false;
		} else return true;
	}

	public static redraw() {
		if (app.map) {
			this.removeAllTiles();
			this.update();
		}
		return this;
	}

	public static update(center: any = null, zoom: number = null) {
		const map: any = app.map;

		if (
			!map ||
			app.map._docLayer._documentInfo === '' ||
			!app.map._docLayer._canonicalIdInitialized
		) {
			return;
		}

		// Calc: do not set view area too early after load and before we get the cursor position.
		if (app.map._docLayer.isCalc() && !app.map._docLayer._gotFirstCellCursor)
			return;

		// be sure canvas is initialized already, has correct size and that we aren't
		// currently processing a transaction
		const size: any = map.getSize();
		if (size.x === 0 || size.y === 0) {
			setTimeout(
				function () {
					this.update();
				}.bind(this),
				1,
			);
			return;
		}

		if (app.file.fileBasedView) {
			this.updateFileBasedView();
			return;
		}

		if (!center) {
			center = map.getCenter();
		}
		if (!zoom) {
			zoom = Math.round(map.getZoom());
		}

		for (var key in this.tiles) {
			var thiscoords = TileCoordData.keyToTileCoords(key);
			if (
				thiscoords.z !== zoom ||
				thiscoords.part !== app.map._docLayer._selectedPart ||
				thiscoords.mode !== app.map._docLayer._selectedMode
			) {
				this.tiles[key].current = false;
			}
		}

		var pixelBounds = map.getPixelBoundsCore(center, zoom);
		var queue = this.getMissingTiles(pixelBounds, zoom);

		app.map._docLayer._sendClientVisibleArea();
		app.map._docLayer._sendClientZoom();

		if (queue.length !== 0) this.addTiles(queue, false);

		if (app.map._docLayer.isCalc() || app.map._docLayer.isWriter())
			this.initPreFetchAdjacentTiles();
	}

	public static onWorkerMessage(e: any) {
		switch (e.data.message) {
			case 'endTransaction':
				for (var x of e.data.deltas) {
					var tile = this.tiles[x.key];
					if (!tile) {
						window.app.console.warn(
							'Tile deleted during rawDelta decompression.',
						);
						continue;
					}

					var keyframeImage = null;
					if (x.isKeyframe)
						keyframeImage = new ImageData(
							x.keyframeBuffer,
							e.data.tileSize,
							e.data.tileSize,
						);
					this.applyDelta(
						tile,
						x.rawDelta,
						x.deltas,
						x.keyframeDeltaSize,
						keyframeImage,
						x.wireMessage,
						false,
					);

					if (x.isKeyframe) --tile.hasPendingKeyframe;
					else --tile.hasPendingDelta;
					if (!tile.hasPendingUpdate()) this.tileReady(tile.coords);
				}

				if (this.pendingTransactions === 0)
					window.app.console.warn('Unexpectedly received decompressed deltas');
				else --this.pendingTransactions;

				if (!this.hasPendingTransactions()) {
					while (this.transactionCallbacks.length) {
						var callback = this.transactionCallbacks.pop();
						if (callback) callback();
					}
				}
				break;

			default:
				window.app.console.error('Unrecognised message from worker');
				this.disableWorker();
		}
	}

	public static updateOnChangePart() {
		if (!this.checkPointers() || app.map._docLayer._documentInfo === '') {
			return;
		}
		var key, coords, tile;
		var center = app.map.getCenter();
		var zoom = Math.round(app.map.getZoom());

		var pixelBounds = app.map.getPixelBoundsCore(center, zoom);
		var tileRanges = this.pxBoundsToTileRanges(pixelBounds);
		var queue = [];

		// mark tiles not matching our part & mode as not being current
		for (key in this.tiles) {
			var thiscoords = TileCoordData.keyToTileCoords(key);
			if (
				thiscoords.z !== zoom ||
				thiscoords.part !== app.map._docLayer._selectedPart ||
				thiscoords.mode !== app.map._docLayer._selectedMode
			) {
				this.tiles[key].current = false;
			}
		}

		// create a queue of coordinates to load tiles from
		this.beginTransaction();
		var redraw = false;
		for (var rangeIdx = 0; rangeIdx < tileRanges.length; ++rangeIdx) {
			var tileRange = tileRanges[rangeIdx];
			for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
				for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
					coords = new TileCoordData(
						i * this.tileSize,
						j * this.tileSize,
						zoom,
						app.map._docLayer._selectedPart,
						app.map._docLayer._selectedMode,
					);

					if (!this.isValidTile(coords)) {
						continue;
					}

					key = coords.key();
					tile = this.tiles[key];
					if (tile && !tile.needsFetch())
						redraw = redraw || this.makeTileCurrent(tile);
					else queue.push(coords);
				}
			}
		}
		this.endTransaction(
			redraw ? () => app.sectionContainer.requestReDraw() : null,
		);

		if (queue.length !== 0) {
			var tileCombineQueue = [];

			for (i = 0; i < queue.length; i++) {
				coords = queue[i];
				key = coords.key();
				if (!this.tiles[key]) this.createTile(coords, key);

				if (this.tileNeedsFetch(key)) {
					tileCombineQueue.push(coords);
				}
			}

			if (tileCombineQueue.length >= 0) {
				this.sendTileCombineRequest(tileCombineQueue);
			} else {
				// We have all necessary tile images in the cache, schedule a paint..
				// This may not be immediate if we are now in a slurp events call.
				app.map._docLayer._painter.update();
			}
		}
		if (
			app.map._docLayer._docType === 'presentation' ||
			app.map._docLayer._docType === 'drawing'
		)
			this.initPreFetchPartTiles();
	}

	public static pxBoundsToTileRange(bounds: any) {
		return new L.Bounds(
			bounds.min.divideBy(this.tileSize).floor(),
			bounds.max.divideBy(this.tileSize).floor(),
		);
	}

	public static updateFileBasedView(
		checkOnly: boolean = false,
		zoomFrameBounds: any = null,
		forZoom: any = null,
	) {
		if (app.map._docLayer._partHeightTwips === 0)
			// This is true before status message is handled.
			return [];
		if (app.map._docLayer._isZooming) return [];

		if (!checkOnly) {
			// zoomFrameBounds and forZoom params were introduced to work only in checkOnly mode.
			window.app.console.assert(
				zoomFrameBounds === null,
				'zoomFrameBounds must only be supplied when checkOnly is true',
			);
			window.app.console.assert(
				forZoom === null,
				'forZoom must only be supplied when checkOnly is true',
			);
		}

		if (forZoom !== null) {
			window.app.console.assert(
				zoomFrameBounds,
				'zoomFrameBounds must be valid when forZoom is specified',
			);
		}

		var zoom = forZoom || Math.round(app.map.getZoom());
		var currZoom = Math.round(app.map.getZoom());
		var relScale = currZoom == zoom ? 1 : app.map.getZoomScale(zoom, currZoom);

		var ratio = (this.tileSize * relScale) / app.map._docLayer._tileHeightTwips;
		var partHeightPixels = Math.round(
			(app.map._docLayer._partHeightTwips +
				app.map._docLayer._spaceBetweenParts) *
				ratio,
		);
		var partWidthPixels = Math.round(app.map._docLayer._partWidthTwips * ratio);
		var mode = 0; // mode is different only in Impress MasterPage mode so far

		var intersectionAreaRectangle = app.LOUtil._getIntersectionRectangle(
			app.file.viewedRectangle.pToArray(),
			[0, 0, partWidthPixels, partHeightPixels * app.map._docLayer._parts],
		);

		var queue = [];

		if (intersectionAreaRectangle) {
			var minLocalX =
				Math.floor(intersectionAreaRectangle[0] / app.tile.size.pixels[0]) *
				app.tile.size.pixels[0];
			var maxLocalX =
				Math.floor(
					(intersectionAreaRectangle[0] + intersectionAreaRectangle[2]) /
						app.tile.size.pixels[0],
				) * app.tile.size.pixels[0];

			var startPart = Math.floor(
				intersectionAreaRectangle[1] / partHeightPixels,
			);
			var startY = app.file.viewedRectangle.pY1 - startPart * partHeightPixels;
			startY =
				Math.floor(startY / app.tile.size.pixels[1]) * app.tile.size.pixels[1];

			var endPart = Math.ceil(
				(intersectionAreaRectangle[1] + intersectionAreaRectangle[3]) /
					partHeightPixels,
			);
			var endY =
				app.file.viewedRectangle.pY1 +
				app.file.viewedRectangle.pY2 -
				endPart * partHeightPixels;
			endY =
				Math.floor(endY / app.tile.size.pixels[1]) * app.tile.size.pixels[1];

			var vTileCountPerPart = Math.ceil(
				partHeightPixels / app.tile.size.pixels[1],
			);

			for (var i = startPart; i < endPart; i++) {
				for (var j = minLocalX; j <= maxLocalX; j += app.tile.size.pixels[0]) {
					for (
						var k = 0;
						k <= vTileCountPerPart * app.tile.size.pixels[0];
						k += app.tile.size.pixels[1]
					)
						if (
							(i !== startPart || k >= startY) &&
							(i !== endPart || k <= endY)
						)
							queue.push(new TileCoordData(j, k, zoom, i, mode));
				}
			}

			this.sortFileBasedQueue(queue);

			for (i = 0; i < this.tiles.length; i++) {
				this.tiles[i].current = false; // Visible ones's "current" property will be set to true below.
			}

			this.beginTransaction();
			var redraw = false;
			for (i = 0; i < queue.length; i++) {
				const tempTile = this.tiles[queue[i].key()];

				if (tempTile) redraw = redraw || this.makeTileCurrent(tempTile);
			}
			this.endTransaction(
				redraw ? () => app.sectionContainer.requestReDraw() : null,
			);
		}

		if (checkOnly) {
			return queue;
		} else {
			app.map._docLayer._sendClientVisibleArea();
			app.map._docLayer._sendClientZoom();

			var tileCombineQueue = [];
			for (var i = 0; i < queue.length; i++) {
				var key = queue[i].key();
				var tile = this.tiles[key];
				if (!tile) tile = this.createTile(queue[i], key);
				if (tile.needsFetch()) tileCombineQueue.push(queue[i]);
			}
			this.sendTileCombineRequest(tileCombineQueue);
		}
	}

	// We keep tile content around, but it will need
	// refreshing if we show it again - and we need to
	// know what monotonic time the invalidate came from
	// so we match this to a new incoming tile to unset
	// the invalid state later.
	public static invalidateTile(key: any, wireId: number) {
		const tile: Tile = this.tiles[key];
		if (!tile) return;

		tile.invalidateCount++;
		tile.allowFastRequest();

		if (app.map._debug.tileDataOn) {
			app.map._debug.tileDataAddInvalidate();
		}

		if (!tile.hasContent() && tile.hasPendingKeyframe === 0)
			this.removeTile(key);
		else {
			if (this.debugDeltas)
				window.app.console.debug(
					'invalidate tile ' + key + ' with wireId ' + wireId,
				);
			if (wireId) tile.invalidFrom = wireId;
			else tile.invalidFrom = tile.wireId;
		}
	}

	// Ensure we have a renderable canvas for a given tile
	// Use this immediately before drawing a tile, pass in the time.
	public static ensureCanvas(tile: Tile, now: any, forPrefetch: any) {
		if (!tile) return;
		if (!tile.canvas) {
			// This allocation is usually cheap and reliable,
			// getting the canvas context, not so much.
			var canvas = document.createElement('canvas');
			canvas.width = this.tileSize;
			canvas.height = this.tileSize;

			tile.canvas = canvas;

			this.rehydrateTile(tile);
		}
		if (!forPrefetch) {
			if (now !== null) tile.lastRendered = now;
			if (!tile.hasContent() && tile.hasPendingKeyframe === 0)
				tile.missingContent++;
		}
	}
}
