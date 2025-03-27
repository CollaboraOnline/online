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

class TileCoordData {
	x: number;
	y: number;
	z: number;
	part: number;
	mode: number;

	constructor(
		left: number,
		top: number,
		zoom: number,
		part: number,
		mode: number,
	) {
		this.x = left;
		this.y = top;
		this.z = zoom;
		this.part = part;
		this.mode = mode !== undefined ? mode : 0;
	}

	getPos() {
		return new L.Point(this.x, this.y);
	}

	key() {
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

	toString() {
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

	public static parseKey = function (key: string) {
		window.app.console.assert(
			typeof key === 'string',
			'key should be a string',
		);
		const k = key.split(':');
		const mode = k.length === 4 ? +k[4] : 0;
		window.app.console.assert(k.length >= 5, 'invalid key format');
		return new TileCoordData(+k[0], +k[1], +k[2], +k[3], mode);
	};
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

class TilesPreFetcher {
	_docLayer: any;
	_zoom: number;
	_preFetchPart: number;
	_preFetchMode: number;
	_hasEditPerm: boolean;
	_pixelBounds: any;
	_splitPos: any;
	_borders: any;
	_cumTileCount: number;
	_preFetchIdle: any;
	_tilesPreFetcher: any;

	constructor(docLayer: any) {
		this._docLayer = docLayer;
	}

	private getMaxTileCountToPrefetch(tileSize: number): number {
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

	private updateProperties() {
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

	private computeBorders() {
		// Need to compute borders afresh and fetch tiles for them.
		this._borders = []; // Stores borders for each split-pane.
		const tileRanges = this._docLayer._pxBoundsToTileRanges(this._pixelBounds);

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

	private clearTilesPreFetcher() {
		if (this._tilesPreFetcher !== undefined) {
			clearInterval(this._tilesPreFetcher);
			this._tilesPreFetcher = undefined;
		}
	}

	public resetPreFetching(resetBorder: boolean) {
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

	public clearPreFetch() {
		this.clearTilesPreFetcher();
		if (this._preFetchIdle !== undefined) {
			clearTimeout(this._preFetchIdle);
			this._preFetchIdle = undefined;
		}
	}

	public preFetchTiles(forceBorderCalc: boolean, immediate: boolean) {
		if (app.file.fileBasedView && this._docLayer)
			this._docLayer._updateFileBasedView();

		if (
			!this._docLayer ||
			this._docLayer._emptyTilesCount > 0 ||
			!this._docLayer._canonicalIdInitialized
		)
			return;

		const propertiesUpdated = this.updateProperties();
		const tileSize = this._docLayer._tileSize;
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
					const key: string = this._docLayer._tileCoordsToKey(coords);

					if (
						visitedTiles[key] ||
						!this._docLayer._isValidTile(coords) ||
						!this._docLayer._tileNeedsFetch(key)
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
			this._docLayer._addTiles(finalQueue, !immediate);
			tilesRequested = true;
		}

		if (!tilesRequested || doneAllPanes) {
			this.clearTilesPreFetcher();
			this._borders = undefined;
		}
	}
}
