/* -*- js-indent-level: 8 -*- */
/*
 * SplitPanesContext stores positions/sizes/objects related to split panes.
 */

/* global app */

L.SplitPanesContext = L.Class.extend({

	options: {
		maxHorizontalSplitPercent: 70,
		maxVerticalSplitPercent: 70,
	},

	initialize: function (docLayer, createSplitters) {
		console.assert(docLayer, 'no docLayer!');
		console.assert(docLayer._map, 'no map!');

		this._docLayer = docLayer;
		this._map = docLayer._map;
		this._setDefaults();

		if (createSplitters === true) {
			this.updateSplitters();
		}
	},

	_setDefaults: function () {
		this._splitPos = new L.Point(0, 0);
	},

	getMaxSplitPosX: function () {
		var rawMax = Math.floor(app.dpiScale * this._map.getSize().x * this.options.maxHorizontalSplitPercent / 100);
		return this._docLayer.getSnapDocPosX(rawMax);
	},

	getMaxSplitPosY: function () {
		var rawMax = Math.floor(app.dpiScale * this._map.getSize().y * this.options.maxVerticalSplitPercent / 100);
		return this._docLayer.getSnapDocPosY(rawMax);
	},

	setSplitPos: function (splitX, splitY, forceUpdate) {

		var xchanged = this.setHorizSplitPos(splitX, forceUpdate, true /* noFire */);
		var ychanged = this.setVertSplitPos(splitY, forceUpdate, true /* noFire */);
		if (xchanged || ychanged)
			this._map.fire('splitposchanged');
	},

	getSplitPos: function () {
		return this._splitPos.divideBy(app.dpiScale);
	},

	justifySplitPos: function (split, isHoriz) {
		if (split <= 0) {
			return 0;
		}

		var maxSplitPos = isHoriz ? this.getMaxSplitPosX() : this.getMaxSplitPosY();
		if (split >= maxSplitPos) {
			return maxSplitPos;
		}

		return isHoriz ? this._docLayer.getSnapDocPosX(split) :
			this._docLayer.getSnapDocPosY(split);
	},

	setHorizSplitPos: function (splitX, forceUpdate, noFire) {

		console.assert(typeof splitX === 'number', 'splitX must be a number');

		if (this._splitPos.x === splitX) {
			if (forceUpdate || !this._docLayer.hasXSplitter()) {
				this._updateXSplitter();
			}
			return false;
		}

		var changed = false;
		var newX = this.justifySplitPos(splitX, true /* isHoriz */);
		if (newX !== this._splitPos.x) {
			this._splitPos.x = newX;
			changed = true;
		}

		this._updateXSplitter();

		if (!noFire)
			this._map.fire('splitposchanged');

		return changed;
	},

	setVertSplitPos: function (splitY, forceUpdate, noFire) {

		console.assert(typeof splitY === 'number', 'splitY must be a number');

		if (this._splitPos.y === splitY) {
			if (forceUpdate || !this._docLayer.hasYSplitter()) {
				this._updateYSplitter();
			}
			return false;
		}

		var changed = false;
		var newY = this.justifySplitPos(splitY, false /* isHoriz */);
		if (newY !== this._splitPos.y) {
			this._splitPos.y = newY;
			changed = true;
		}

		this._updateYSplitter();

		if (!noFire)
			this._map.fire('splitposchanged');

		return changed;
	},

	updateSplitters: function () {
		this._updateXSplitter();
		this._updateYSplitter();
	},

	_updateXSplitter: function () {
		this._docLayer.updateHorizPaneSplitter();
	},

	_updateYSplitter: function () {
		this._docLayer.updateVertPaneSplitter();
	},

	getPanesProperties: function () {
		var paneStatusList = [];
		if (this._splitPos.x && this._splitPos.y) {
			// top-left pane
			paneStatusList.push({
				xFixed: true,
				yFixed: true,
			});
		}

		if (this._splitPos.y) {
			// top-right pane or top half pane
			paneStatusList.push({
				xFixed: false,
				yFixed: true,
			});
		}

		if (this._splitPos.x) {
			// bottom-left pane or left half pane
			paneStatusList.push({
				xFixed: true,
				yFixed: false,
			});
		}

		// bottom-right/bottom-half/right-half pane or the full pane (when there are no split-panes active)
		paneStatusList.push({
			xFixed: false,
			yFixed: false,
		});

		return paneStatusList;
	},

	// returns all the pane rectangles for the provided full-map area (all in core pixels).
	getPxBoundList: function (pxBounds) {
		if (!pxBounds) {
			pxBounds = this._map.getPixelBoundsCore();
		}
		var topLeft = pxBounds.getTopLeft();
		var bottomRight = pxBounds.getBottomRight();
		var boundList = [];

		if (this._splitPos.x && this._splitPos.y) {
			// top-left pane
			boundList.push(new L.Bounds(
				new L.Point(0, 0),
				this._splitPos
			));
		}

		if (this._splitPos.y) {
			// top-right pane or top half pane
			boundList.push(new L.Bounds(
				new L.Point(topLeft.x + this._splitPos.x, 0),
				new L.Point(bottomRight.x, this._splitPos.y)
			));
		}

		if (this._splitPos.x) {
			// bottom-left pane or left half pane
			boundList.push(new L.Bounds(
				new L.Point(0, topLeft.y + this._splitPos.y),
				new L.Point(this._splitPos.x, bottomRight.y)
			));
		}

		if (!boundList.length) {
			// the full pane (when there are no split-panes active)
			boundList.push(new L.Bounds(
				topLeft,
				bottomRight
			));
		} else {
			// bottom-right/bottom-half/right-half pane
			boundList.push(new L.Bounds(
				topLeft.add(this._splitPos),
				bottomRight
			));
		}

		return boundList;
	},

	getTwipsBoundList: function (pxBounds) {
		var bounds = this.getPxBoundList(pxBounds);
		var docLayer = this._docLayer;
		return bounds.map(function (bound) {
			return new L.Bounds(
				docLayer._corePixelsToTwips(bound.min),
				docLayer._corePixelsToTwips(bound.max)
			);
		});
	},

	intersectsVisible: function (areaPx) {
		var pixBounds = this._map.getPixelBoundsCore();
		var boundList = this.getPxBoundList(pixBounds);
		for (var i = 0; i < boundList.length; ++i) {
			if (areaPx.intersects(boundList[i])) {
				return true;
			}
		}

		return false;
	},
});
