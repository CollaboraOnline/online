/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.RowGroup
*/

/* global $ */
L.Control.RowGroup = L.Class.extend({
	name: L.CSections.RowGroup.name,
	anchor: ['top', 'left'],
	position: [0, 350 * window.devicePixelRatio], // Set its initial position to somewhere blank. Other sections shouldn't cover this point after initializing.
	size: [0, 0], // No initial height is necessary. Width is computed inside update function.
	expand: ['top', 'bottom'], // Expand vertically.
	processingOrder: L.CSections.RowGroup.processingOrder,
	drawingOrder: L.CSections.RowGroup.drawingOrder,
	zIndex: L.CSections.RowGroup.zIndex,
	interactable: true,
	sectionProperties: {},

	onInitialize: function () {
		this._map = L.Map.THIS;
		this._groups = null;

		// group control styles
		this._groupHeadSize = Math.round(12 * this.dpiScale);
		this._levelSpacing = this.dpiScale;

		this._map.on('sheetgeometrychanged', this.update, this);
		this._map.on('viewrowcolumnheaders', this.update, this);
		this._createFont();
		this.update();
	},

	getHeaderZoomScale : function(lowerBound, upperBound) {
		if (typeof lowerBound === 'undefined' || lowerBound < 0)
			lowerBound = 0.5;
		if (typeof upperBound === 'undefined' || upperBound < 0)
			upperBound = 2.0;
		if (lowerBound > upperBound) {
			lowerBound = 0.5;
			upperBound = 2.0;
		}
		var zoomScale = this._map.getZoomScale(this._map.getZoom(),
			this._map.options.defaultZoom);
		return Math.min(Math.max(zoomScale, lowerBound), upperBound);
	},

	_createFont: function () {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', 'spreadsheet-header-row', baseElem);
		this.backgroundColor = L.DomUtil.getStyle(elem, 'background-color'); // This is a section property.
		this.borderColor = this.backgroundColor;
		this._textColor = L.DomUtil.getStyle(elem, 'color');
		var fontFamily = L.DomUtil.getStyle(elem, 'font-family');
		var fontSize = parseInt(L.DomUtil.getStyle(elem, 'font-size'));
		var fontHeight = parseInt(L.DomUtil.getStyle(elem, 'line-height'));
		var rate = fontHeight / fontSize;
		var that = this;
		this._font = {
			_baseFontSize: fontSize * this.dpiScale,
			_fontSizeRate: rate,
			_fontFamily: fontFamily,
			getFont: function() {
				var zoomScale = that.getHeaderZoomScale(/* lowerBound */ 0.5, /* upperBound */ 1.15);

				return Math.floor(this._baseFontSize * zoomScale) +	'px/' +	this._fontSizeRate + ' ' + this._fontFamily;
			}
		};
		L.DomUtil.remove(elem);
	},

	update: function () {
		this._sheetGeometry = this._map._docLayer.sheetGeometry;
		this._groups = Array(this._sheetGeometry.getRowGroupLevels());

		// Calculate width on the fly.
		this.size[0] = this._computeOutlineWidth();

		// Because this section's width is calculated on the fly, RowHeader and CornerHeader sections should be shifted.
		this.containerObject.getSectionWithName(L.CSections.RowHeader.name).position[0] = this.size[0] + 1;
		this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).position[0] = this.size[0] + 1;

		this._cornerHeaderHeight = this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).size[1];

		this._splitPos = this._map._docLayer._splitPanesContext.getSplitPos();

		this._collectGroupsData(this._sheetGeometry.getRowGroupsDataInView());
		//this.containerObject.onResize(false);
	},

	_getGroupLevel: function (pos) {
		var levels = this._groups.length;
		var size = this._levelSpacing + this._groupHeadSize;

		var level = (pos + 1) / size | 0;
		var relPos = pos % size;

		if (level <= levels && relPos > this._levelSpacing) {
			return level;
		}
		else {
			return -1;
		}
	},

	_computeOutlineWidth: function () {
		return this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * (this._groups.length + 1);
	},

	_collectGroupsData: function(groups) {
		var level, groupEntry;

		var lastGroupIndex = new Array(groups.length);
		var firstChildGroupIndex = new Array(groups.length);
		var lastLevel = -1;
		for (var i = 0; i < groups.length; ++i) {
			// a new group start
			var groupData = groups[i];
			level = parseInt(groupData.level) - 1;
			if (!this._groups[level]) {
				this._groups[level] = {};
			}
			var startPos = parseInt(groupData.startPos) / this._map._docLayer._tilePixelScale;
			var endPos = parseInt(groupData.endPos) / this._map._docLayer._tilePixelScale;
			var isHidden = !!parseInt(groupData.hidden);
			if (isHidden || startPos === endPos) {
				startPos -= this._groupHeadSize / 2;
				endPos = startPos + this._groupHeadSize;
			}
			else {
				var moved = false;
				// if the first child is collapsed the parent head has to be top-aligned with the child
				if (level < lastLevel && firstChildGroupIndex[lastLevel] !== undefined) {
					var childGroupEntry = this._groups[lastLevel][firstChildGroupIndex[lastLevel]];
					if (childGroupEntry.hidden) {
						if (startPos > childGroupEntry.startPos && startPos < childGroupEntry.endPos) {
							startPos = childGroupEntry.startPos;
							moved = true;
						}
					}
				}
				// if 2 groups belonging to the same level are contiguous and the first group is collapsed,
				// the second one has to be shifted as much as possible in order to avoiding overlapping.
				if (!moved && lastGroupIndex[level] !== undefined) {
					var prevGroupEntry = this._groups[level][lastGroupIndex[level]];
					if (prevGroupEntry.hidden) {
						if (startPos > prevGroupEntry.startPos && startPos < prevGroupEntry.endPos) {
							startPos = prevGroupEntry.endPos;
						}
					}
				}
			}
			groupEntry = {
				level: level,
				index: groupData.index,
				startPos: startPos,
				endPos: endPos,
				hidden: isHidden
			};
			this._groups[level][groupData.index] = groupEntry;
			lastGroupIndex[level] = groupData.index;
			if (level > lastLevel) {
				firstChildGroupIndex[level] = groupData.index;
				lastLevel = level;
			}
			else if (level === lastLevel) {
				firstChildGroupIndex[level + 1] = undefined;
			}
		}
	},

	_isPreviousGroupVisible: function (index, level) {
		if (level === 0) {
			return true;
		}
		else {
			for (var i = 0; i < this._groups.length; i++) {
				for (var group in this._groups[i]) {
					if (Object.prototype.hasOwnProperty.call(this._groups[i], group)) {
						var group_ = this._groups[i][group];
						if (group_.level === level - 1 && group_.index === index) {
							if (group_.hidden === false) {
								if (group_.level > 0) {
									if (this._isPreviousGroupVisible(group_.index, group_.level)) {
										return true;
									}
									else {
										return false;
									}
								}
								else {
									return true;
								}
							}
							else {
								return false;
							}
						}
					}
				}
			}
		}
	},

	drawOutline: function() {
		if (this._groups) {
			for (var i = 0; i < this._groups.length; i++) {
				if (this._groups[i]) {
					for (var group in this._groups[i]) {
						if (Object.prototype.hasOwnProperty.call(this._groups[i], group)) {
							if (this._isPreviousGroupVisible(this._groups[i][group].index, this._groups[i][group].level))
								this.drawGroupControl(this._groups[i][group]);
						}
					}
				}
			}
		}
	},

	getRelativeY: function (docPos) {
		if (docPos <= this._splitPos.y) {
			return docPos - this.documentTopLeft[1] + this._cornerHeaderHeight;
		}
		else {
			// max here is to prevent encroachment of the fixed pane-area.
			return Math.max(docPos - this.documentTopLeft[1], this._splitPos.y) + this._cornerHeaderHeight;
		}
	},

	drawGroupControl: function (group) {
		var startX = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group.level;
		var startY = this.getRelativeY(group.startPos);
		var endY = group.endPos + this._cornerHeaderHeight - this.documentTopLeft[1];

		if (startY > this._cornerHeaderHeight) {
			// draw head
			this.context.fillStyle = this.backgroundColor;
			this.context.fillRect(startX, startY, this._groupHeadSize, this._groupHeadSize);
			this.context.strokeStyle = 'black';
			this.context.lineWidth = this.dpiScale;
			this.context.strokeRect(startX + 0.5, startY + 0.5, this._groupHeadSize, this._groupHeadSize);
		}

		if (!group.hidden && endY > startY) {
			//draw tail
			startX += this._groupHeadSize * 0.5;
			this.context.strokeStyle = 'black';
			this.context.lineWidth = this.dpiScale;
			this.context.beginPath();
			this.context.moveTo(startX + 0.5, startY + this._groupHeadSize + 0.5);
			this.context.lineTo(startX + 0.5, endY - Math.round(this.dpiScale) + 0.5);
			this.context.lineTo(startX + this._groupHeadSize / 2, endY - Math.round(this.dpiScale) + 0.5);
			this.context.stroke();
			startX -= this._groupHeadSize * 0.5;
			if (startY > this._cornerHeaderHeight) {
				// draw '-'
				this.context.moveTo(startX + this._groupHeadSize * 0.25 + 0.5, startY + this._groupHeadSize / 2 + 0.5);
				this.context.lineTo(startX + this._groupHeadSize * 0.75 + 0.5, startY + this._groupHeadSize / 2 + 0.5);
				this.context.stroke();
			}
		}
		else if (startY > this._cornerHeaderHeight) {
			// draw '+'
			this.context.beginPath();

			this.context.moveTo(startX + this._groupHeadSize * 0.25 + 0.5, startY + this._groupHeadSize / 2 + 0.5);
			this.context.lineTo(startX + this._groupHeadSize * 0.75 + 0.5, startY + this._groupHeadSize / 2 + 0.5);

			this.context.moveTo(startX + this._groupHeadSize * 0.50 + 0.5, startY + this._groupHeadSize * 0.25 + 0.5);
			this.context.lineTo(startX + this._groupHeadSize * 0.50 + 0.5, startY + this._groupHeadSize * 0.75 + 0.5);

			this.context.stroke();
		}
	},

	drawLevelHeaders: function () {
		for (var i = 0; i < this._groups.length + 1; ++i) {
			this.drawLevelHeader(i);
		}
	},

	drawLevelHeader: function (level) {
		var ctx = this.context;
		var ctrlHeadSize = this._groupHeadSize;
		var levelSpacing = this._levelSpacing;

		var startX = levelSpacing + (ctrlHeadSize + levelSpacing) * level;
		var startY = Math.round((this._cornerHeaderHeight - ctrlHeadSize) * 0.5);

		ctx.strokeStyle = 'black';
		ctx.lineWidth = this.dpiScale;
		ctx.strokeRect(startX + 0.5, startY + 0.5, ctrlHeadSize, ctrlHeadSize);
		// draw level number
		ctx.fillStyle = this._textColor;
		ctx.font = this._font.getFont();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(level + 1, startX + (ctrlHeadSize / 2), startY + (ctrlHeadSize / 2) + 2 * this.dpiScale);
	},

	_updateOutlineState: function (group) {
		var state = group.hidden ? 'visible' : 'hidden'; // we have to send the new state
		var payload = 'outlinestate type=row' + ' level=' + group.level + ' index=' + group.index + ' state=' + state;
		this._map._socket.sendMessage(payload);
	},

	findClickedLevel: function (point) {
		if (point[1] < this._cornerHeaderHeight) {
			var index = (point[0] / this.size[0]) * 100; // Percentage.
			var levelPercentage = (1 / (this._groups.length + 1)) * 100; // There is one more button than the number of levels.
			index = Math.floor(index / levelPercentage);
			return index;
		}
		else {
			return -1;
		}
	},

	findClickedGroup: function (point) {
		for (var i = 0; i < this._groups.length; i++) {
			if (this._groups[i]) {
				for (var group in this._groups[i]) {
					if (Object.prototype.hasOwnProperty.call(this._groups[i], group)) {
						var group_ = this._groups[i][group];
						var startX = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group_.level;
						var startY = this.getRelativeY(group_.startPos);
						var endX = startX + this._groupHeadSize;
						var endY = startY + this._groupHeadSize;
						if (point[0] > startX && point[0] < endX && point[1] > startY && point[1] < endY) {
							return group_;
						}
					}
				}
			}
		}
		return null;
	},

	// Users can double click on group tails.
	findTailsGroup: function (point) {
		for (var i = 0; i < this._groups.length; i++) {
			if (this._groups[i]) {
				for (var group in this._groups[i]) {
					if (Object.prototype.hasOwnProperty.call(this._groups[i], group)) {
						var group_ = this._groups[i][group];
						var startX = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group_.level;
						var startY = this.getRelativeY(group_.startPos);
						var endX = startX + this._groupHeadSize; // Let's use this as thikcness. User doesn't have to double click on a pixel:)
						var endY = group_.endPos + this._cornerHeaderHeight - this.documentTopLeft[1];

						if (point[0] > startX && point[0] < endX && point[1] > startY && point[1] < endY) {
							return group_;
						}
					}
				}
			}
		}
	},

	onDraw: function () {
		this.drawOutline();
		this.drawLevelHeaders();
	},

	onMouseMove: function (point) {
		// If mouse is above a group header or a group control, we change the cursor.
		if (this.findClickedGroup(point) !== null || this.findClickedLevel(point) !== -1)
			this.context.canvas.style.cursor = 'pointer';
		else
			this.context.canvas.style.cursor = 'default';
	},

	onMouseLeave: function () {
		this.context.canvas.style.cursor = 'default';
	},

	onClick: function (point) {
		// User may have clicked on one of the level headers.
		var level = this.findClickedLevel(point);
		if (level !== -1) {
			this._updateOutlineState({level: level, index: -1}); // index: -1 targets all groups (there may be multiple separate row groups.).
		}
		else {
			// User may have clicked on one of the group control boxes (boxes with plus / minus symbols).
			var group = this.findClickedGroup(point);

			if (group) {
				this._updateOutlineState(group);
			}
		}
	},

	/* Double clicking on a group's tail closes it. */
	onDoubleClick: function (point) {
		var group = this.findTailsGroup(point);
		if (group)
			this._updateOutlineState(group);
	},

	onMouseEnter: function () {
		$.contextMenu('destroy', '#document-canvas');
	},

	onNewDocumentTopLeft: function () {},
	onLongPress: function () {},
	onMouseDown: function () {},
	onMouseUp: function () {},
	onMouseWheel: function () {},
	onContextMenu: function () {},
	onResize: function () {},
});

L.control.rowGroup = function (options) {
	return new L.Control.RowGroup(options);
};