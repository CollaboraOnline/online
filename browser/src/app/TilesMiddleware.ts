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

	/*
		No need to calculate the scale every time. We have the current scale, reachable via app.getScale().
		We can compare these two when we need check if a tile is in the current scale. Assigned on creation.
	*/
	scale: number;

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

		this.scale = Math.pow(1.2, this.z - 10);
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

class RawDelta {
	private _delta: Uint8Array;
	private _id: number;
	private _isKeyframe: boolean;

	constructor(delta: Uint8Array, id: number, isKeyframe: boolean) {
		this._delta = delta;
		this._id = id;
		this._isKeyframe = isKeyframe;
	}

	public get length() {
		return this.delta.length;
	}

	public get delta() {
		return this._delta;
	}

	public get id() {
		return this._id;
	}

	public get isKeyframe() {
		return this._isKeyframe;
	}
}

class Tile {
	coords: TileCoordData;
	distanceFromView: number = 0; // distance to the center of the nearest visible area (0 = visible)
	image: ImageBitmap | null = null; // ImageBitmap ready to render
	imgDataCache: any = null; // flat byte array of image data
	rawDeltas: RawDelta[] = []; // deltas ready to decompress
	deltaCount: number = 0; // how many deltas on top of the keyframe
	updateCount: number = 0; // how many updates did we have
	loadCount: number = 0; // how many times did we get a new keyframe
	gcErrors: number = 0; // count freed keyframe in JS, but kept in wsd.
	missingContent: number = 0; // how many times rendered without content
	invalidateCount: number = 0; // how many invalidations touched this tile
	viewId: number = 0; // canonical view id
	wireId: number = 0; // monotonic timestamp for optimizing fetch
	invalidFrom: number = 0; // a wireId - for avoiding races on invalidation
	deltaId: number = 0; // monotonic id for delta updates
	lastPendingId: number = 0; // the id of the last delta requested to be decompressed
	decompressedId: number = 0; // the id of the last decompressed delta chunk in imgDataCache
	lastRendered: number = performance.timeOrigin;
	private lastRequestTime: Date = undefined; // when did we last do a tilecombine request.

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
		if (this.rawDeltas.length === 0) return false;
		const lastId = this.rawDeltas[this.rawDeltas.length - 1].id;
		return this.lastPendingId !== lastId;
	}

	hasKeyframe(): boolean {
		return !!this.rawDeltas.length;
	}

	isReady(): boolean {
		return this.decompressedId === this.lastPendingId;
	}

	/// Demand a whole tile back to the keyframe from coolwsd.
	forceKeyframe(wireId: number = 0) {
		this.wireId = wireId;
		this.invalidFrom = wireId;
		this.allowFastRequest();
	}

	/// Avoid continually re-requesting tiles for eg. preloading
	requestingTooFast(now: Date): boolean {
		const tooFast: boolean =
			this.lastRequestTime &&
			now.getTime() - this.lastRequestTime.getTime() < 5000; /* ms */
		return tooFast;
	}

	updateLastRequest(now: Date) {
		this.lastRequestTime = now;
	}

	/// Allow faster requests
	allowFastRequest() {
		this.updateLastRequest(undefined);
	}

	isReadyToDraw(): boolean {
		return !!this.image;
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
	private static pendingTransactions: any = [[]];
	private static pendingDeltas: any = [];
	private static worker: any;
	private static nullDeltaUpdate = 0;
	private static queuedProcessed: any = [];
	private static fetchKeyframeQueue: any = []; // Queue of tiles which were GC'd earlier than coolwsd expected
	private static emptyTilesCount: number = 0;
	private static debugDeltas: boolean = false;
	private static debugDeltasDetail: boolean = false;
	private static tiles: Map<string, Tile> = new Map(); // stores all tiles, keyed by coordinates, and cached, compressed deltas
	private static tileBitmapList: Tile[] = []; // stores all tiles with bitmaps, sorted by distance from view(s)
	public static tileSize: number = 256;

	// The tile distance around the visible tile area that will be requested when updating
	private static visibleTileExpansion: number = 1;
	// The tile expansion ratio that the visible tile area will be expanded towards when
	// updating during scrolling
	private static directionalTileExpansion: number = 2;
	private static pausedForDehydration: boolean = false;
	private static shrinkCurrentId: any = null;

	//private static _debugTime: any = {}; Reserved for future.

	public static initialize() {
		if (window.Worker && !(window as any).ThisIsAMobileApp) {
			window.app.console.info('Creating CanvasTileWorker');
			this.worker = new Worker(
				app.LOUtil.getURL('/src/layer/tile/TileWorker.js'),
			);
			this.worker.addEventListener('message', (e: any) =>
				this.onWorkerMessage(e),
			);
			this.worker.addEventListener('error', (e: any) => this.disableWorker(e));
		}
	}

	/// Called before frame rendering to update details
	public static updateOverlayMessages() {
		if (!app.map._debug.tileDataOn) return;

		var totalSize = 0;
		var n_bitmaps = 0;
		var n_current = 0;
		for (const tile of this.tiles.values()) {
			if (tile.image) ++n_bitmaps;
			if (tile.distanceFromView === 0) ++n_current;
			totalSize += tile.rawDeltas.reduce((a, c) => a + c.length, 0);
		}
		let mismatch = '';
		if (n_bitmaps != this.tileBitmapList.length)
			mismatch = '\nmismatch! ' + n_bitmaps + ' vs. ' + this.tileBitmapList;

		app.map._debug.setOverlayMessage(
			'top-tileMem',
			'Tiles: ' +
				String(this.tiles.size).padStart(4, ' ') +
				', bitmaps: ' +
				String(n_bitmaps).padStart(3, ' ') +
				' current ' +
				String(n_current).padStart(3, ' ') +
				', Delta size ' +
				Math.ceil(totalSize / 1024) +
				'(KB)' +
				', Bitmap size: ' +
				Math.ceil(n_bitmaps / 2) +
				'(MB)' +
				mismatch,
		);
	}

	private static sortTileKeysByDistance() {
		return Array.from(this.tiles.keys()).sort((a: any, b: any) => {
			return (
				this.tiles.get(b).distanceFromView - this.tiles.get(a).distanceFromView
			);
		});
	}

	// Set a high and low watermark of how many bitmaps we want
	// and expire old ones
	private static garbageCollect(discardAll = false) {
		// real RAM sizes for keyframes + delta cache in memory.
		let highDeltaMemory = 120 * 1024 * 1024; // 120Mb
		let lowDeltaMemory = 100 * 1024 * 1024; // 100Mb
		// number of tiles
		let highTileCount = 2048;
		let lowTileCount = highTileCount - 128;

		if (discardAll) {
			highDeltaMemory = 0;
			lowDeltaMemory = 0;
			highTileCount = 0;
			lowTileCount = 0;
		}

		/* uncomment to exercise me harder. */
		/* highDeltaMemory = 1024*1024; lowDeltaMemory = 1024*128;
		   highTileCount = 100; lowTileCount = 50; */

		// FIXME: could maintain this as we go rather than re-accounting it regularly.
		var totalSize = 0;
		var tileCount = 0;
		for (const tile of this.tiles.values()) {
			// Don't count size of tiles that are visible. We don't have
			// a mechanism to immediately rehydrate tiles, so GC'ing visible tiles would
			// cause flickering.
			if (tile.distanceFromView !== 0) {
				totalSize += tile.rawDeltas.reduce((a, c) => a + c.length, 0);
				tileCount++;
			}
		}

		// FIXME: We should consider also sorting keys by wireId -
		// which is monotonic server rendering ~time.

		// Try to re-use sorting whenever we can - it's expensive
		let sortedKeys: string[] = [];

		// Trim memory down to size.
		if (totalSize > highDeltaMemory) {
			const keys = this.sortTileKeysByDistance();
			sortedKeys = keys;

			for (var i = 0; i < keys.length && totalSize > lowDeltaMemory; ++i) {
				const key = keys[i];
				const tile: Tile = this.tiles.get(key);
				if (tile.rawDeltas.length && tile.distanceFromView !== 0) {
					const rawDeltaSize = tile.rawDeltas.reduce((a, c) => a + c.length, 0);
					totalSize -= rawDeltaSize;
					if (this.debugDeltas)
						window.app.console.log(
							'Reclaim delta ' + key + ' memory: ' + rawDeltaSize + ' bytes',
						);
					this.reclaimTileBitmapMemory(tile);
					tile.rawDeltas = [];
					tile.forceKeyframe();
				}
			}
		}

		// Trim the number of tiles down too ...
		if (tileCount > highTileCount) {
			var keys = sortedKeys;
			if (!keys.length) keys = this.sortTileKeysByDistance();

			for (var i = 0; i < keys.length - lowTileCount; ++i) {
				const key = keys[i];
				const tile: Tile = this.tiles.get(key);
				if (tile.distanceFromView !== 0) this.removeTile(keys[i]);
			}
		}
	}

	// When a new bitmap is set on a tile we should see if we need to expire an old tile
	private static setBitmapOnTile(tile: Tile, bitmap: ImageBitmap) {
		// 4k screen -> 8Mpixel, each tile is 64kpixel uncompressed
		const highNumBitmaps = 250; // ~60Mb.

		const assertChecks = false;

		if (tile.image) {
			// fast case - no impact on count of tiles or bitmap list:
			if (assertChecks)
				window.app.console.assert(!!this.tileBitmapList.find((i) => i == tile));
			tile.image.close();
			tile.image = bitmap;
			return;
		}

		if (assertChecks)
			window.app.console.assert(!this.tileBitmapList.find((i) => i == tile));

		// free the last tile if we need to
		if (this.tileBitmapList.length > highNumBitmaps)
			this.reclaimTileBitmapMemory(
				this.tileBitmapList[this.tileBitmapList.length - 1],
			);

		// current tiles are first:
		if (tile.distanceFromView === 0) this.tileBitmapList.unshift(tile);
		else {
			let low = 0;
			let high = this.tileBitmapList.length;
			const distance = tile.distanceFromView;

			// sort on insertion
			while (low < high) {
				const mid = Math.floor((low + high) / 2);
				if (this.tileBitmapList[mid].distanceFromView < distance) low = mid + 1;
				else high = mid;
			}
			this.tileBitmapList.splice(low, 0, tile);
		}

		tile.image = bitmap;
	}

	private static sortTileBitmapList() {
		// furthest away at the end
		this.tileBitmapList.sort((a, b) => a.distanceFromView - b.distanceFromView);
	}

	// returns negative for not present, and otherwise proportion, low is low expiry.
	public static getExpiryFactor(tile: Tile) {
		return (
			this.tileBitmapList.indexOf(tile) /
			Math.max(this.tileBitmapList.length, 1)
		);
	}

	private static endTransactionHandleBitmaps(
		deltas: any[],
		bitmaps: ImageBitmap[],
	) {
		const visibleRanges = this.getVisibleRanges();
		while (deltas.length) {
			const delta = deltas.shift();
			const bitmap = bitmaps.shift();

			const tile = this.tiles.get(delta.key);
			if (!tile) continue;

			this.setBitmapOnTile(tile, bitmap);

			if (tile.isReady()) this.tileReady(tile.coords, visibleRanges);
		}

		if (this.pendingTransactions.length === 0)
			window.app.console.warn('Unexpectedly received decompressed deltas');
		else {
			const callbacks = this.pendingTransactions.shift();
			while (callbacks.length) callbacks.pop()();
		}

		if (this.pausedForDehydration) {
			// Check if all current tiles are accounted for and resume drawing if so.
			let shouldUnpause = true;
			for (const tile of this.tiles.values()) {
				if (tile.distanceFromView === 0 && !tile.isReady()) {
					shouldUnpause = false;
					break;
				}
			}
			if (shouldUnpause) {
				app.sectionContainer.resumeDrawing();
				this.pausedForDehydration = false;
			}
		}

		this.garbageCollect();
	}

	private static createTileBitmap(
		tile: Tile,
		delta: any,
		deltas: any[],
		bitmaps: Promise<ImageBitmap>[],
	) {
		if (tile.imgDataCache) {
			bitmaps.push(
				createImageBitmap(tile.imgDataCache, {
					premultiplyAlpha: 'none',
				}),
			);
			deltas.push(delta);
		} else {
			window.app.console.warn(
				'Unusual: Tried to create a tile bitmap with no image data',
			);
		}
	}

	private static decompressPendingDeltas(message: string) {
		if (this.worker) {
			this.worker.postMessage(
				{
					message: message,
					deltas: this.pendingDeltas,
					tileSize: this.tileSize,
					current: Array.from(this.tiles.keys()).filter(
						(key) => this.tiles.get(key).distanceFromView === 0,
					),
				},
				this.pendingDeltas.map((x: any) => x.rawDelta.buffer),
			);
		} else {
			// Synchronous path
			this.onWorkerMessage({
				data: {
					message: 'endTransaction',
					deltas: this.pendingDeltas,
					tileSize: this.tileSize,
				},
			});
		}
		this.pendingDeltas.length = 0;
	}

	private static applyCompressedDelta(
		tile: Tile,
		rawDeltas: RawDelta[],
		isKeyframe: any,
		wireMessage: any,
		ids: number[],
	) {
		if (this.inTransaction === 0)
			window.app.console.warn(
				'applyCompressedDelta called outside of transaction',
			);

		// Concatenate the raw deltas for decompression. This also has the benefit of copying
		// them, which allows us to transfer full ownership of the memory to a worker.
		const rawDelta = new Uint8Array(
			rawDeltas.reduce((a, c) => a + c.length, 0),
		);
		rawDeltas.reduce((a, c) => {
			rawDelta.set(c.delta, a);
			return a + c.length;
		}, 0);

		var e = {
			key: tile.coords.key(),
			rawDelta: rawDelta,
			isKeyframe: isKeyframe,
			wireMessage: wireMessage,
			ids: ids,
		};
		tile.lastPendingId = ids[1];

		this.pendingDeltas.push(e);
	}

	private static applyDeltaChunk(
		imgData: any,
		delta: any,
		oldData: any,
		width: any,
		height: any,
	) {
		var pixSize = width * height * 4;
		if (this.debugDeltas)
			window.app.console.log(
				'Applying a delta of length ' +
					delta.length +
					' image size: ' +
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
		return this.inTransaction > 0 || this.pendingTransactions.length;
	}

	private static beginTransaction() {
		++this.inTransaction;
	}

	private static getVisibleRanges(): Array<cool.Bounds> {
		var zoom = Math.round(app.map.getZoom());
		var pixelBounds = app.map.getPixelBoundsCore(app.map.getCenter(), zoom);
		return app.map._docLayer._splitPanesContext
			? app.map._docLayer._splitPanesContext.getPxBoundList(pixelBounds)
			: [pixelBounds];
	}

	private static tileZoomIsCurrent(coords: TileCoordData) {
		const scale = Math.pow(1.2, app.map.getZoom() - 10);
		return Math.round(coords.scale * 1000) === Math.round(scale * 1000);
	}

	private static tileReady(
		coords: TileCoordData,
		visibleRanges: Array<cool.Bounds>,
	) {
		var key = coords.key();

		const tile: Tile = this.tiles.get(key);
		if (!tile) return;

		// Discard old raw deltas
		for (let i = tile.rawDeltas.length - 1; i > 0; --i) {
			if (tile.rawDeltas[i].isKeyframe) {
				tile.rawDeltas = tile.rawDeltas.splice(i);
				break;
			}
		}

		var emptyTilesCountChanged = false;
		if (this.emptyTilesCount > 0) {
			this.emptyTilesCount -= 1;
			emptyTilesCountChanged = true;
		}

		if (app.map && emptyTilesCountChanged && this.emptyTilesCount === 0) {
			app.map.fire('statusindicator', { statusType: 'alltilesloaded' });
		}

		// Request a redraw if the tile is visible
		const tileBounds = new L.Bounds(
			[tile.coords.x, tile.coords.y],
			[tile.coords.x + this.tileSize, tile.coords.y + this.tileSize],
		);
		if (tileBounds.intersectsAny(visibleRanges))
			app.sectionContainer.requestReDraw();
	}

	private static createTile(coords: TileCoordData, key: string) {
		if (this.tiles.has(key)) {
			if (this.debugDeltas)
				window.app.console.debug('Already created tile ' + key);
			return this.tiles.get(key);
		}
		const tile = new Tile(coords);

		this.tiles.set(key, tile);

		return tile;
	}

	// Make the given tile current and rehydrates if necessary. Returns true if the tile
	// has pending updates.
	private static makeTileCurrent(tile: Tile): boolean {
		tile.distanceFromView = 0;
		tile.allowFastRequest();
		this.rehydrateTile(tile, false);

		return !tile.isReady();
	}

	private static rehydrateTile(tile: Tile, wireMessage: boolean) {
		if (tile.needsRehydration()) {
			// Re-hydrate tile from cached raw deltas.
			if (this.debugDeltas)
				window.app.console.log(
					'Restoring a tile from cached delta at ' + tile.coords.key(),
				);

			// Get the index of the last stored keyframe
			// FIXME: EcmaScript 2023 has Array.findLastIndex
			let firstDelta = 0;
			for (let i = tile.rawDeltas.length - 1; i > 0; --i) {
				if (tile.rawDeltas[i].isKeyframe) {
					firstDelta = i;
					break;
				}
			}

			// Check if we have already decompressed data we can work from
			if (tile.lastPendingId > tile.rawDeltas[firstDelta].id) {
				const continuedIdIndex = tile.rawDeltas.findIndex(
					(d) => d.id === tile.lastPendingId,
				);
				if (continuedIdIndex !== -1) firstDelta = continuedIdIndex + 1;
			}
			const rawDeltas = tile.rawDeltas.slice(firstDelta);
			const lastId = tile.rawDeltas[tile.rawDeltas.length - 1].id;

			this.applyCompressedDelta(
				tile,
				rawDeltas,
				tile.rawDeltas[firstDelta].isKeyframe,
				wireMessage,
				[tile.rawDeltas[firstDelta].id, lastId],
			);
		}
	}

	private static endTransaction(callback: any = null) {
		if (this.inTransaction === 0) {
			window.app.console.error('Mismatched endTransaction');
			return;
		}

		--this.inTransaction;
		if (callback)
			this.pendingTransactions[this.pendingTransactions.length - 1].push(
				callback,
			);

		if (this.inTransaction !== 0) return;

		// Short-circuit if there's nothing to decompress
		if (!this.pendingDeltas.length) {
			const callbacks =
				this.pendingTransactions[this.pendingTransactions.length - 1];
			while (callbacks.length) callbacks.pop()();
			return;
		}

		try {
			this.pendingTransactions.push([]);
			this.decompressPendingDeltas('endTransaction');
		} catch (e) {
			window.app.console.error('Failed to decompress pending deltas');
			this.inTransaction = 0;
			this.disableWorker(e);
			if (callback) callback();
			return;
		}
	}

	private static disableWorker(e: any = null) {
		if (e) window.app.console.error('Worker-related error encountered', e);
		if (!this.worker) return;

		window.app.console.warn('Disabling worker thread');
		try {
			this.worker.terminate();
		} catch (e) {
			window.app.console.error('Error terminating worker thread', e);
		}

		this.pendingDeltas.length = 0;
		this.worker = null;
		while (this.pendingTransactions.length) {
			const callbacks = this.pendingTransactions.shift();
			while (callbacks.length) callbacks.pop()();
		}
		this.pendingTransactions.push([]);
		this.redraw();
	}

	private static applyDelta(
		tile: Tile,
		rawDeltas: any[],
		deltas: any,
		keyframeDeltaSize: any,
		keyframeImage: any,
		wireMessage: any,
	) {
		const rawDeltaSize = tile.rawDeltas.reduce((a, c) => a + c.length, 0);

		if (this.debugDeltas) {
			const hexStrings = [];
			for (const rawDelta of rawDeltas)
				hexStrings.push(hex2string(rawDelta, rawDelta.length));
			const hexString = hexStrings.join('');

			window.app.console.log(
				'Applying a raw ' +
					(keyframeDeltaSize ? 'keyframe' : 'delta') +
					' of length ' +
					rawDeltaSize +
					(this.debugDeltasDetail ? ' hex: ' + hexString : ''),
			);
		}

		// if re-creating ImageData from rawDeltas, don't update counts
		if (wireMessage) {
			if (keyframeDeltaSize) {
				tile.loadCount++;
				tile.deltaCount = 0;
				tile.updateCount = 0;
				if (app.map._debug.tileDataOn) {
					app.map._debug.tileDataAddLoad();
				}
			} else if (rawDeltas.length === 0) {
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
			{ keyFrame: !!keyframeDeltaSize, length: rawDeltaSize },
		);

		// apply potentially several deltas in turn.
		var i = 0;

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
			if (delta.length >= this.tileSize * this.tileSize * 4) {
				window.app.console.warn(
					'Unusual delta possibly mis-tagged, suspicious size vs. type ' +
						delta.length +
						' vs. ' +
						this.tileSize * this.tileSize * 4,
				);
			}

			if (!imgData)
				// no keyframe
				imgData = tile.imgDataCache;
			if (!imgData) {
				window.app.console.error(
					'Trying to apply delta with no ImageData cache',
				);
				return;
			}

			// copy old data to work from:
			var oldData = new Uint8ClampedArray(imgData.data);

			var len = this.applyDeltaChunk(
				imgData,
				delta,
				oldData,
				this.tileSize,
				this.tileSize,
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

		// hold onto the original imgData for reuse in the no keyframe case
		tile.imgDataCache = imgData;

		if (traceEvent) traceEvent.finish();
	}

	private static removeTile(key: string) {
		const tile = this.tiles.get(key);
		if (!tile) return;

		if (!tile.hasContent() && this.emptyTilesCount > 0)
			this.emptyTilesCount -= 1;

		this.reclaimTileBitmapMemory(tile);
		this.tiles.delete(key);
	}

	private static removeAllTiles() {
		this.tileBitmapList = [];
		for (const key in Array.from(this.tiles.keys())) {
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

	private static reclaimTileBitmapMemory(tile: Tile) {
		if (tile.image) {
			tile.image.close();
			tile.image = null;
			tile.imgDataCache = null;

			tile.decompressedId = 0;
			tile.lastPendingId = 0;

			const n = this.tileBitmapList.findIndex((it) => it == tile);
			if (n !== -1) this.tileBitmapList.splice(n, 1);
		}
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

				if (queue.length !== 0) this.addTiles(queue);
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
				const tile = this.tiles.get(key);

				// don't send lots of duplicate, fast tilecombines
				if (tile && tile.requestingTooFast(now)) continue;

				// request each tile just once in these tilecombines
				if (added[key]) continue;
				added[key] = true;
				hasTiles = true;

				// build parameters
				tileWids.push(tile && tile.wireId !== undefined ? tile.wireId : 0);

				const twips = new L.Point(
					Math.floor(coords.x / this.tileSize) * app.tile.size.x,
					Math.floor(coords.y / this.tileSize) * app.tile.size.y,
				);

				tilePositionsX.push(twips.x);
				tilePositionsY.push(twips.y);

				if (tile) tile.updateLastRequest(now);
			}

			var msg =
				'tilecombine ' +
				'nviewid=0 ' +
				'part=' +
				part +
				' ' +
				(mode !== 0 ? 'mode=' + mode + ' ' : '') +
				'width=' +
				this.tileSize +
				' ' +
				'height=' +
				this.tileSize +
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
				app.tile.size.x +
				' ' +
				'tileheight=' +
				app.tile.size.y;
			if (hasTiles) app.socket.sendMessage(msg, '');
			else window.app.console.log('Skipped empty (too fast) tilecombine');
		}
	}

	private static tileNeedsFetch(key: string) {
		const tile: Tile = this.tiles.get(key);
		return !tile || tile.needsFetch();
	}

	private static pxBoundsToTileRanges(bounds: any) {
		if (!this.checkPointers()) return null;

		if (!app.map._docLayer._splitPanesContext) {
			return [this.pxBoundsToTileRange(bounds)];
		}

		var boundList = app.map._docLayer._splitPanesContext.getPxBoundList(bounds);
		return boundList.map((x: any) => this.pxBoundsToTileRange(x));
	}

	private static updateTileDistance(
		tile: Tile,
		zoom: number,
		visibleRanges: any | null = null,
	) {
		if (
			tile.coords.z !== zoom ||
			tile.coords.part !== app.map._docLayer._selectedPart ||
			tile.coords.mode !== app.map._docLayer._selectedMode
		) {
			tile.distanceFromView = Number.MAX_SAFE_INTEGER;
			return;
		}
		if (!visibleRanges) visibleRanges = this.getVisibleRanges();
		const tileBounds = new L.Bounds(
			[tile.coords.x, tile.coords.y],
			[tile.coords.x + this.tileSize, tile.coords.y + this.tileSize],
		);
		tile.distanceFromView = tileBounds.distanceTo(visibleRanges[0]);
		for (let i = 1; i < visibleRanges.length; ++i) {
			const distance = tileBounds.distanceTo(visibleRanges[i]);
			if (distance < tile.distanceFromView) tile.distanceFromView = distance;
		}
	}

	private static getMissingTiles(
		pixelBounds: any,
		zoom: number,
		isCurrent: boolean = false,
	) {
		var tileRanges = this.pxBoundsToTileRanges(pixelBounds);
		var queue = [];

		// If we're looking for tiles for the current (visible) area, update tile distance.
		if (isCurrent) {
			const currentBounds = app.map._docLayer._splitPanesContext
				? app.map._docLayer._splitPanesContext.getPxBoundList(pixelBounds)
				: [pixelBounds];
			for (const tile of this.tiles.values()) {
				this.updateTileDistance(tile, zoom, currentBounds);
			}
			this.sortTileBitmapList();
		}

		// create a queue of coordinates to load tiles from. Rehydrate tiles if we're dealing
		// with the currently visible area.
		this.beginTransaction();
		let dehydratedVisible = false;
		for (var rangeIdx = 0; rangeIdx < tileRanges.length; ++rangeIdx) {
			// Expand the 'current' area to add a small buffer around the visible area that
			// helps us avoid visible tile updates.
			const tileRange =
				isCurrent && !this.shrinkCurrentId
					? this.expandTileRange(tileRanges[rangeIdx])
					: tileRanges[rangeIdx];

			for (var j = tileRange.min.y; j <= tileRange.max.y; ++j) {
				for (var i = tileRange.min.x; i <= tileRange.max.x; ++i) {
					var coords = new TileCoordData(
						i * this.tileSize,
						j * this.tileSize,
						zoom,
						app.map._docLayer._selectedPart,
						app.map._docLayer._selectedMode,
					);

					if (!this.isValidTile(coords)) continue;

					var key = coords.key();
					const tile = this.tiles.get(key);

					if (!tile || tile.needsFetch()) queue.push(coords);
					else if (isCurrent && this.makeTileCurrent(tile)) {
						const tileIsVisible =
							j >= tileRanges[rangeIdx].min.y &&
							j <= tileRanges[rangeIdx].max.y &&
							i >= tileRanges[rangeIdx].min.x &&
							i <= tileRanges[rangeIdx].max.x;
						if (tileIsVisible) dehydratedVisible = true;
					}
				}
			}
		}

		// If we dehydrated a visible tile, wait for it to be ready before drawing
		if (dehydratedVisible && !this.pausedForDehydration) {
			app.sectionContainer.pauseDrawing();
			this.pausedForDehydration = true;
		}
		this.endTransaction(null);

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
		isCurrent: boolean = false,
	) {
		// Remove irrelevant tiles from the queue earlier.
		this.removeIrrelevantsFromCoordsQueue(coordsQueue);

		// If these aren't current tiles, calculate the visible ranges to update tile distance.
		const visibleRanges = isCurrent ? null : this.getVisibleRanges();
		const zoom = Math.round(app.map.getZoom());

		// Ensure tiles exist for requested coordinates
		for (let i = 0; i < coordsQueue.length; i++) {
			const key = coordsQueue[i].key();
			let tile: Tile = this.tiles.get(key);

			if (!tile) {
				tile = this.createTile(coordsQueue[i], key);

				// Newly created tiles have a distance of zero, which means they're current.
				if (!isCurrent) this.updateTileDistance(tile, zoom, visibleRanges);
			}
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
		for (const tile of this.tiles.values()) {
			tile.forceKeyframe();
		}
	}

	public static setDebugDeltas(state: boolean) {
		this.debugDeltas = state;
		this.debugDeltasDetail = state;
	}

	public static get(key: string): Tile {
		return this.tiles.get(key);
	}

	private static pixelCoordsToTwipTileBounds(coords: TileCoordData): number[] {
		// We need to calculate pixelsToTwips for the scale of this tile. 15 is the ratio between pixels and twips when the scale is 1.
		const pixelsToTwipsForTile = 15 / app.dpiScale / coords.scale;
		const x = coords.x * pixelsToTwipsForTile;
		const y = coords.y * pixelsToTwipsForTile;
		const width = app.tile.size.pX * pixelsToTwipsForTile;
		const height = app.tile.size.pY * pixelsToTwipsForTile;

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
		const calc = app.map._docLayer.isCalc();

		this.tiles.forEach((tile, key) => {
			const coords: TileCoordData = tile.coords;
			const tileRectangle = this.pixelCoordsToTwipTileBounds(coords);

			if (
				coords.part === part &&
				coords.mode === mode &&
				(invalidatedRectangle.intersectsRectangle(tileRectangle) ||
					(calc && !this.tileZoomIsCurrent(coords))) // In calc, we invalidate all tiles with different zoom levels.
			) {
				if (tile.distanceFromView === 0) needsNewTiles = true;

				this.invalidateTile(key, wireId);
			}
		});

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

	public static preFetchTiles(forceBorderCalc: boolean) {
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
				Math.floor((app.file.size.x - 1) / app.tile.size.x),
				Math.floor((app.file.size.y - 1) / app.tile.size.y),
			),
		);

		var tilesToFetch = maxTilesToFetch; // total tile limit per call of preFetchTiles()
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
			this.addTiles(finalQueue);
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
		let tile = this.tiles.get(key);

		if (!tile) {
			tile = this.createTile(coords, key);
			this.updateTileDistance(tile, Math.round(app.map.getZoom()));
		}

		tile.viewId = tileMsgObj.nviewid;
		// update monotonic timestamp
		tile.wireId = +tileMsgObj.wireId;
		if (tile.invalidFrom == tile.wireId)
			window.app.console.debug('Nasty - updated wireId matches old one');

		var hasContent = img != null && img.rawData.length > 0;

		// obscure case: we could have garbage collected the
		// keyframe content in JS but coolwsd still thinks we have
		// it and now we just have a delta with nothing to apply
		// it to; if so, mark it bad to re-fetch.
		if (img && !img.isKeyframe && !tile.hasKeyframe()) {
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
			// Store the compressed tile data for later decompression and
			// display. This lets us store many more tiles than if we were
			// to only store the decompressed tile data.
			const rawDelta = new RawDelta(
				img.rawData,
				++tile.deltaId,
				img.isKeyframe,
			);
			if (img.isKeyframe || tile.hasKeyframe()) {
				tile.rawDeltas.push(rawDelta);
			} else {
				window.app.console.warn(
					'Unusual: attempt to append a delta when we have no keyframe.',
				);
			}

			// Only decompress deltas for tiles that are current. This stops
			// prefetching from blowing past GC limits.
			if (tile.distanceFromView === 0) this.rehydrateTile(tile, true);
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
		// update tile.distanceFromView for the view
		if (app.file.fileBasedView) this.updateFileBasedView(true);

		this.garbageCollect();
	}

	public static discardAllCache() {
		// update tile.distanceFromView for the view
		if (app.file.fileBasedView) this.updateFileBasedView(true);

		this.garbageCollect(true);
	}

	public static isValidTile(coords: TileCoordData) {
		if (coords.x < 0 || coords.y < 0) {
			return false;
		} else if (
			coords.x * app.pixelsToTwips > app.file.size.x ||
			coords.y * app.pixelsToTwips > app.file.size.y
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
		if (app.file.writer.multiPageView) return;

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

		// be sure canvas is initialized already and has the correct size.
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

		// If an update occurs while we're paused for dehydration, we haven't been able to
		// keep up with scrolling. In this case, we should stop expanding the current area
		// so that it takes less time to dehydrate it.
		if (this.pausedForDehydration) {
			if (this.shrinkCurrentId) clearTimeout(this.shrinkCurrentId);
			this.shrinkCurrentId = setTimeout(() => {
				this.shrinkCurrentId = null;
			}, 100);
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

		var pixelBounds = map.getPixelBoundsCore(center, zoom);
		var queue = this.getMissingTiles(pixelBounds, zoom, true);

		app.map._docLayer._sendClientZoom();
		app.map._docLayer._sendClientVisibleArea();

		if (queue.length !== 0) this.addTiles(queue, true);

		if (app.map._docLayer.isCalc() || app.map._docLayer.isWriter())
			this.initPreFetchAdjacentTiles();
	}

	public static onWorkerMessage(e: any) {
		const bitmaps: Promise<ImageBitmap>[] = [];
		const pendingDeltas: any[] = [];
		switch (e.data.message) {
			case 'endTransaction':
				for (const x of e.data.deltas) {
					const tile = this.tiles.get(x.key);

					if (!tile) {
						if (this.debugDeltas)
							window.app.console.warn(
								'Tile deleted during rawDelta decompression.',
							);
						continue;
					}

					if (!x.deltas) {
						// This path is taken when this is called on the DOM thread (i.e. the worker
						// hasn't decompressed the raw delta)
						x.deltas = (window as any).fzstd.decompress(x.rawDelta);
						if (x.isKeyframe) {
							x.keyframeBuffer = new Uint8ClampedArray(
								e.data.tileSize * e.data.tileSize * 4,
							);
							x.keyframeDeltaSize = L.CanvasTileUtils.unrle(
								x.deltas,
								e.data.tileSize,
								e.data.tileSize,
								x.keyframeBuffer,
							);
						} else x.keyframeDeltaSize = 0;
					}

					let rawDeltas: any[] = [];
					const firstDelta = tile.rawDeltas.findIndex((d) => d.id === x.ids[0]);
					const lastDelta = tile.rawDeltas.findIndex((d) => d.id === x.ids[1]);
					if (firstDelta !== -1 && lastDelta !== -1)
						rawDeltas = tile.rawDeltas.slice(firstDelta, lastDelta + 1);
					else
						window.app.console.warn(
							'Unusual: Received unknown decompressed keyframe delta(s)',
						);

					let keyframeImage = null;
					if (x.isKeyframe) {
						keyframeImage = new ImageData(
							x.keyframeBuffer,
							e.data.tileSize,
							e.data.tileSize,
						);
					} else if (tile.decompressedId !== 0) {
						if (x.ids[0] !== tile.decompressedId + 1) {
							window.app.console.warn(
								'Unusual: Received discontiguous decompressed delta',
							);
						}
					} else {
						if (this.debugDeltas)
							window.app.console.warn(
								"Decompressed delta received on GC'd tile",
							);
						continue;
					}

					this.applyDelta(
						tile,
						rawDeltas,
						x.deltas,
						x.keyframeDeltaSize,
						keyframeImage,
						x.wireMessage,
					);

					this.createTileBitmap(tile, x, pendingDeltas, bitmaps);
					tile.decompressedId = x.ids[1];
				}

				Promise.all(bitmaps).then((bitmaps) => {
					this.endTransactionHandleBitmaps(pendingDeltas, bitmaps);
				});
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
		var key, coords;
		var center = app.map.getCenter();
		var zoom = Math.round(app.map.getZoom());

		var pixelBounds = app.map.getPixelBoundsCore(center, zoom);

		// create a queue of coordinates to load tiles from
		const queue = this.getMissingTiles(pixelBounds, zoom, true);

		if (queue.length !== 0) {
			for (let i = 0; i < queue.length; i++) {
				coords = queue[i];
				key = coords.key();
				if (!this.tiles.has(key)) this.createTile(coords, key);
			}

			this.sendTileCombineRequest(queue);
		}
		if (
			app.map._docLayer._docType === 'presentation' ||
			app.map._docLayer._docType === 'drawing'
		)
			this.initPreFetchPartTiles();
	}

	public static expandTileRange(range: cool.Bounds): cool.Bounds {
		const grow = this.visibleTileExpansion;
		const direction = app.sectionContainer.getLastPanDirection();
		const minOffset = new L.Point(
			grow - grow * this.directionalTileExpansion * Math.min(0, direction[0]),
			grow - grow * this.directionalTileExpansion * Math.min(0, direction[1]),
		);
		const maxOffset = new L.Point(
			grow + grow * this.directionalTileExpansion * Math.max(0, direction[0]),
			grow + grow * this.directionalTileExpansion * Math.max(0, direction[1]),
		);
		return new L.Bounds(
			range.min.subtract(minOffset),
			range.max.add(maxOffset),
		);
	}

	public static pxBoundsToTileRange(bounds: any) {
		return new L.Bounds(
			bounds.min.divideBy(this.tileSize)._floor(),
			bounds.max.divideBy(this.tileSize)._floor(),
		);
	}

	/*
		Checks the visible tiles in current zoom level.
		Marks the visible ones as current.
	*/
	public static updateLayoutView(bounds: any): any {
		const queue = this.getMissingTiles(
			bounds,
			Math.round(app.map.getZoom()),
			true,
		);

		if (queue.length > 0) this.addTiles(queue, true);
	}

	public static getVisibleCoordList(
		rectangle: cool.SimpleRectangle = app.file.viewedRectangle,
	) {
		const coordList = Array<TileCoordData>();
		const zoom = app.map.getZoom();

		for (const tile of this.tiles.values()) {
			const coords = tile.coords;
			if (
				coords.z === zoom &&
				rectangle.intersectsRectangle([
					coords.x * app.pixelsToTwips,
					coords.y * app.pixelsToTwips,
					this.tileSize * app.pixelsToTwips,
					this.tileSize * app.pixelsToTwips,
				])
			)
				coordList.push(coords);
		}

		return coordList;
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

		var ratio = (this.tileSize * relScale) / app.tile.size.y;
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
				Math.floor(intersectionAreaRectangle[0] / app.tile.size.pX) *
				app.tile.size.pX;
			var maxLocalX =
				Math.floor(
					(intersectionAreaRectangle[0] + intersectionAreaRectangle[2]) /
						app.tile.size.pX,
				) * app.tile.size.pX;

			var startPart = Math.floor(
				intersectionAreaRectangle[1] / partHeightPixels,
			);
			var startY = app.file.viewedRectangle.pY1 - startPart * partHeightPixels;
			startY = Math.floor(startY / app.tile.size.pY) * app.tile.size.pY;

			var endPart = Math.ceil(
				(intersectionAreaRectangle[1] + intersectionAreaRectangle[3]) /
					partHeightPixels,
			);
			var endY =
				app.file.viewedRectangle.pY1 +
				app.file.viewedRectangle.pY2 -
				endPart * partHeightPixels;
			endY = Math.floor(endY / app.tile.size.pY) * app.tile.size.pY;

			var vTileCountPerPart = Math.ceil(partHeightPixels / app.tile.size.pY);

			for (var i = startPart; i < endPart; i++) {
				for (var j = minLocalX; j <= maxLocalX; j += app.tile.size.pX) {
					for (
						var k = 0;
						k <= vTileCountPerPart * app.tile.size.pX;
						k += app.tile.size.pY
					)
						if (
							(i !== startPart || k >= startY) &&
							(i !== endPart || k <= endY)
						)
							queue.push(new TileCoordData(j, k, zoom, i, mode));
				}
			}

			this.sortFileBasedQueue(queue);

			for (const tile of this.tiles.values()) {
				// Visible tiles' distance property will be set zero below by makeTileCurrent.
				tile.distanceFromView = Number.MAX_SAFE_INTEGER;
			}

			this.beginTransaction();
			for (i = 0; i < queue.length; i++) {
				const tempTile = this.tiles.get(queue[i].key());

				if (tempTile) this.makeTileCurrent(tempTile);
			}
			this.endTransaction(null);
		}

		if (checkOnly) {
			return queue;
		} else {
			app.map._docLayer._sendClientVisibleArea();
			app.map._docLayer._sendClientZoom();

			var tileCombineQueue = [];
			for (var i = 0; i < queue.length; i++) {
				var key = queue[i].key();
				let tile = this.tiles.get(key);
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
		const tile: Tile = this.tiles.get(key);
		if (!tile) return;

		tile.invalidateCount++;

		if (app.map._debug.tileDataOn) {
			app.map._debug.tileDataAddInvalidate();
		}

		if (!tile.hasContent()) this.removeTile(key);
		else {
			if (this.debugDeltas)
				window.app.console.debug(
					'invalidate tile ' + key + ' with wireId ' + wireId,
				);
			tile.forceKeyframe(wireId ? wireId : tile.wireId);
		}
	}

	// Indicate that we're about to render this image.
	public static touchImage(tile: Tile) {
		if (!tile) return;
		tile.lastRendered = performance.now();
		if (!tile.image) tile.missingContent++;
	}
}
