/* -*- js-indent-level: 8 -*- */
/*
 * SplitPanesContext stores positions/sizes/objects related to split panes.
 */

/* global */

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

	setDefaults: function () {
		this._setDefaults();
		this.updateSplitters();
	},

	getMaxSplitPosX: function () {
		var rawMax = Math.floor(window.devicePixelRatio * this._map.getSize().x * this.options.maxHorizontalSplitPercent / 100);
		return this._docLayer.getSnapDocPosX(rawMax);
	},

	getMaxSplitPosY: function () {
		var rawMax = Math.floor(window.devicePixelRatio * this._map.getSize().y * this.options.maxVerticalSplitPercent / 100);
		return this._docLayer.getSnapDocPosY(rawMax);
	},

	setSplitPos: function (splitX, splitY, forceUpdate) {

		var xchanged = this.setHorizSplitPos(splitX, forceUpdate, true /* noFire */);
		var ychanged = this.setVertSplitPos(splitY, forceUpdate, true /* noFire */);
		if (xchanged || ychanged)
			this._map.fire('splitposchanged');
	},

	alignSplitPos: function () {
		this.alignHorizSplitPos();
		this.alignVertSplitPos();
	},

	getSplitPos: function () {
		return this._splitPos.clone();
	},

	getSplitPosX: function () {
		return this._splitPos.x;
	},

	getSplitPosY: function () {
		return this._splitPos.y;
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

	alignHorizSplitPos: function () {
		this._splitPos.x = this._docLayer.getSnapDocPosX(this._splitPos.x);
		this._updateXSplitter();
	},

	alignVertSplitPos: function () {
		this._splitPos.y = this._docLayer.getSnapDocPosY(this._splitPos.y);
		this._updateYSplitter();
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
				new L.Point(topLeft.x + this._splitPos.x + 1, 0),
				new L.Point(bottomRight.x, this._splitPos.y)
			));
		}

		if (this._splitPos.x) {
			// bottom-left pane or left half pane
			boundList.push(new L.Bounds(
				new L.Point(0, topLeft.y + this._splitPos.y + 1),
				new L.Point(this._splitPos.x, bottomRight.y)
			));
		}

		// bottom-right/bottom-half/right-half pane or the full pane (when there are no split-panes active)
		boundList.push(new L.Bounds(
			topLeft.add(this._splitPos).add(new L.Point(1, 1)),
			bottomRight
		));

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

	getClientVisibleArea: function () {
		var pixelBounds = this._map.getPixelBoundsCore();
		var fullSize = pixelBounds.getSize();
		var cursorPos = this._docLayer.getCursorPos();
		cursorPos._floor();
		var oneone = new L.Point(1, 1);
		var topLeft = pixelBounds.getTopLeft()._add(this._splitPos)._add(oneone);
		var size = fullSize.subtract(this._splitPos);

		if (this._splitPos.x) {
			size.x -= 1;
		}

		if (this._splitPos.y) {
			size.y -= 1;
		}

		if (cursorPos.x <= this._splitPos.x) {
			topLeft.x = 0;
			size.x = fullSize.x;
		}

		if (cursorPos.y <= this._splitPos.y) {
			topLeft.y = 0;
			size.y = fullSize.y;
		}

		return new L.Bounds(topLeft, topLeft.add(size));
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
