/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class PreloadMapSection extends app.definitions.canvasSectionObject {
	name: string = L.CSections.Debug.PreloadMap.name;
	interactable: boolean = false;
	anchor: string[] = ['top', 'left'];
	processingOrder: number = L.CSections.Debug.PreloadMap.processingOrder;
	drawingOrder: number = L.CSections.Debug.PreloadMap.drawingOrder;
	zIndex: number = L.CSections.Debug.PreloadMap.zIndex;
	boundToSection: string = 'tiles';

	constructor() {
		super();
		this._map = L.Map.THIS;
	}

	onDraw(
		frameCount?: number,
		elapsedTime?: number,
		subsetBounds?: Bounds,
	): void {
		var docLayer = this._map._docLayer;
		var ctx = docLayer._painter._paintContext();

		var zoom = Math.round(this._map.getZoom());
		var part = docLayer._selectedPart;
		var tileRanges = ctx.paneBoundsList.map(
			docLayer._pxBoundsToTileRange,
			docLayer,
		);

		// Get the 'main' view
		var viewRange = tileRanges.length == 4 ? tileRanges[3] : tileRanges[0];

		var offx = 50;
		var offy = 400;
		var sizePix = 3;
		var voffset = sizePix * 10 * 5;
		var canvas = this.context;

		var tileRange = new L.Bounds(viewRange.min, viewRange.max);

		// stop annoying jitter as the view fits different numbers of tiles.
		var viewWidth = Math.floor(
			(this._map.getPixelBoundsCore().getSize().x + docLayer._tileSize - 1) /
				docLayer._tileSize,
		);
		var viewHeight = Math.floor(
			(this._map.getPixelBoundsCore().getSize().y + docLayer._tileSize - 1) /
				docLayer._tileSize,
		);

		// Enlarge in each dimension
		tileRange.min.y = tileRange.min.y - viewHeight * 2;
		tileRange.max.y = tileRange.max.y + viewHeight * 2;
		tileRange.min.x = tileRange.min.x - viewWidth * 2;
		tileRange.max.x = tileRange.max.x + viewWidth * 2;

		console.log('Render preload map ' + viewHeight);
		for (var p = -1; p <= 1; ++p) {
			for (var j = tileRange.min.y; j <= tileRange.max.y; ++j) {
				for (var i: number = tileRange.min.x; i <= tileRange.max.x; ++i) {
					var tile = undefined;

					if (i >= 0 && j >= 0 && part + p >= 0) {
						var coords = new L.TileCoordData(
							i * ctx.tileSize.x,
							j * ctx.tileSize.y,
							zoom,
							part + p,
							docLayer._selectedMode,
						);
						var key = coords.key();
						tile = docLayer._tiles[key];
					} // outside document range
					else canvas.fillStyle = 'rgba(32, 32, 32, 0.3)'; // dark grey

					if (!tile)
						canvas.fillStyle = 'rgba(128, 128, 128, 0.3)'; // grey
					// state of the tile
					else if (!tile.hasContent())
						canvas.fillStyle = 'rgba(255, 0, 0, 0.8)'; // red
					else if (tile.needsFetch())
						canvas.fillStyle = 'rgba(255, 255, 0, 0.8)'; // yellow
					// present
					else canvas.fillStyle = 'rgba(0, 255, 0, 0.5)'; // green
					canvas.fillRect(
						offx + (i - tileRange.min.x) * sizePix,
						offy + (j - tileRange.min.y) * sizePix + voffset * p,
						sizePix,
						sizePix,
					);
				}
			}
		}

		// viewport in tiles - not that accurate.
		canvas.strokeStyle = 'rgba(0, 0, 0, 0.5)';
		canvas.lineWidth = 1.0;
		canvas.strokeRect(
			offx + (viewRange.min.x - tileRange.min.x) * sizePix,
			offy + (viewRange.min.y - tileRange.min.y) * sizePix,
			viewWidth * sizePix,
			viewHeight * sizePix,
		);
	}
}

app.definitions.preloadMapSection = PreloadMapSection;
