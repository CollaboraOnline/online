/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.ColumnGroup
*/

/* global $ */

/*
	This file is Calc only. This adds a section for grouped columns in Calc.
	When user selects some columns and groups them using "Data->Group and Outline->Group" menu path, this section is added into
	sections list of CanvasSectionContainer. See _addRemoveGroupSections in file CalcTileLayer.js

	This class is an extended version of "CanvasSectionObject".
*/

L.Control.ColumnGroup = L.Class.extend({
	name: L.CSections.ColumnGroup.name,
	anchor: ['top', 'left'],
	position: [350 * window.devicePixelRatio, 0], // Set its initial position to somewhere blank. Other sections shouldn't cover this point after initializing.
	size: [0, 0], // No initial width is necessary. Height is computed inside update function.
	expand: ['left', 'right'], // Expand vertically.
	processingOrder: L.CSections.ColumnGroup.processingOrder,
	drawingOrder: L.CSections.ColumnGroup.drawingOrder,
	zIndex: L.CSections.ColumnGroup.zIndex,
	interactable: true,
	sectionProperties: {},

	// This function is called by CanvasSectionContainer when the section is added to the sections list.
	onInitialize: function () {
		this._map = L.Map.THIS;
		this._groups = null;

		// group control styles
		this._groupHeadSize = Math.round(12 * this.dpiScale);
		this._levelSpacing = Math.round(this.dpiScale);

		this._map.on('sheetgeometrychanged', this.update, this);
		this._map.on('viewrowcolumnheaders', this.update, this);
		this._createFont();
		this.update();
		this.isRemoved = false;
	},

	// Create font for the group headers. Group headers are on the left side of corner header.
	_createFont: function () {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', 'spreadsheet-header-column', baseElem);
		this.backgroundColor = L.DomUtil.getStyle(elem, 'background-color'); // This is a section property.
		this.borderColor = L.DomUtil.getStyle(elem, 'background-color'); // This is a section property.
		this._textColor = L.DomUtil.getStyle(elem, 'color');
		var fontFamily = L.DomUtil.getStyle(elem, 'font-family');
		var fontSize = parseInt(L.DomUtil.getStyle(elem, 'font-size'));
		this._getFont = function() {
			return Math.round(fontSize * this.dpiScale) + 'px ' + fontFamily;
		};
		L.DomUtil.remove(elem);
	},

	update: function () {
		if (this.isRemoved) // Prevent calling while deleting the section. It causes errors.
			return;

		this._sheetGeometry = this._map._docLayer.sheetGeometry;
		this._groups = Array(this._sheetGeometry.getColumnGroupLevels());

		// Calculate width on the fly.
		this.size[1] = this._computeSectionHeight();

		// Because this section's width is calculated on the fly, ColumnHeader and CornerHeader sections should be shifted.
		this.containerObject.getSectionWithName(L.CSections.ColumnHeader.name).position[1] = this.size[1] + Math.round(this.dpiScale);
		this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).position[1] = this.size[1] + Math.round(this.dpiScale);

		this._cornerHeaderWidth = this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).size[0];

		this._splitPos = this._map._docLayer._splitPanesContext.getSplitPos();

		this._collectGroupsData(this._sheetGeometry.getColumnGroupsDataInView());
	},

	// This returns the required height for the section.
	_computeSectionHeight: function () {
		return this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * (this._groups.length + 1);
	},

	// This function puts data into a good shape for use of this class.
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
				// the second one has to be shifted as much as possible in order to avoid overlapping.
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

	// If previous group is visible (expanded), current group's plus sign etc. will be drawn. If previous group is not expanded, current group's plus sign etc. won't be drawn.
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
									// This recursive call is needed.
									// Because first upper group may have been expanded and second upper group may have been collapsed.
									// If one of the upper groups is not expanded, this function should return false.
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

	// This calls drawing functions related to tails and plus & minus signs etc.
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

	getRelativeX: function (docPos) {
		if (docPos <= this._splitPos.x) {
			return docPos - this.documentTopLeft[0] + this._cornerHeaderWidth;
		}
		else {
			// max here is to prevent encroachment of the fixed pane-area.
			return Math.max(docPos - this.documentTopLeft[0], this._splitPos.x) + this._cornerHeaderWidth;
		}
	},

	drawGroupControl: function (group) {
		var startX = this.getRelativeX(group.startPos);
		var startY = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group.level;
		var endX = group.endPos + this._cornerHeaderWidth - this.documentTopLeft[0];

		if (startX > this._cornerHeaderWidth) {
			// draw head
			this.context.fillStyle = this.backgroundColor;
			this.context.fillRect(startX, startY, this._groupHeadSize, this._groupHeadSize);
			this.context.strokeStyle = 'black';
			this.context.lineWidth = this.dpiScale;
			this.context.strokeRect(startX + 0.5, startY + 0.5, this._groupHeadSize, this._groupHeadSize);
		}

		if (!group.hidden && endX > startX) {
			//draw tail
			startY += this._groupHeadSize * 0.5;
			this.context.strokeStyle = 'black';
			this.context.lineWidth = this.dpiScale;
			this.context.beginPath();
			this.context.moveTo(startX + this._groupHeadSize + 0.5, startY + 0.5);
			this.context.lineTo(endX - Math.round(this.dpiScale) + 0.5, startY + 0.5);
			this.context.lineTo(endX - Math.round(this.dpiScale) + 0.5, startY + this._groupHeadSize / 2);
			this.context.stroke();
			startY -= this._groupHeadSize * 0.5;
			if (startX > this._cornerHeaderWidth) {
				// draw '-'
				this.context.moveTo(startX + this._groupHeadSize * 0.25 + 0.5, startY + this._groupHeadSize * 0.5 + 0.5);
				this.context.lineTo(startX + this._groupHeadSize * 0.75 + 0.5, startY + this._groupHeadSize * 0.5 + 0.5);
				this.context.stroke();
			}
		}
		else if (startX > this._cornerHeaderWidth) {
			// draw '+'
			this.context.beginPath();
			this.context.moveTo(startX + this._groupHeadSize * 0.25 + 0.5, startY + this._groupHeadSize * 0.5 + 0.5);
			this.context.lineTo(startX + this._groupHeadSize * 0.75 + 0.5, startY + this._groupHeadSize * 0.5 + 0.5);

			this.context.moveTo(startX + this._groupHeadSize * 0.50 + 0.5, startY + this._groupHeadSize * 0.25 + 0.5);
			this.context.lineTo(startX + this._groupHeadSize * 0.50 + 0.5, startY + this._groupHeadSize * 0.75 + 0.5);

			this.context.stroke();
		}
	},

	// This function calls drawing function for related to headers of groups. Headers are drawn on the left of corner header.
	drawLevelHeaders: function () {
		for (var i = 0; i < this._groups.length + 1; ++i) {
			this.drawLevelHeader(i);
		}
	},

	drawLevelHeader: function (level) {
		var ctx = this.context;
		var ctrlHeadSize = this._groupHeadSize;
		var levelSpacing = this._levelSpacing;

		var startX = Math.round((this._cornerHeaderWidth - ctrlHeadSize) * 0.5);
		var startY = levelSpacing + (ctrlHeadSize + levelSpacing) * level;

		ctx.strokeStyle = 'black';
		ctx.lineWidth = this.dpiScale;
		ctx.strokeRect(startX + 0.5, startY + 0.5, ctrlHeadSize, ctrlHeadSize);
		// draw level number
		ctx.fillStyle = this._textColor;
		ctx.font = this._getFont();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(level + 1, startX + (ctrlHeadSize / 2), startY + (ctrlHeadSize / 2) + 2 * this.dpiScale);
	},

	// Handle user interaction.
	_updateOutlineState: function (group) {
		var state = group.hidden ? 'visible' : 'hidden'; // we have to send the new state
		var payload = 'outlinestate type=column' + ' level=' + group.level + ' index=' + group.index + ' state=' + state;
		this._map._socket.sendMessage(payload);
	},

	// When user clicks somewhere on the section, onMouseClick event is called by CanvasSectionContainer.
	// Clicked point is also given to handler function. This function finds the clicked header.
	findClickedLevel: function (point) {
		if (point[0] < this._cornerHeaderWidth) {
			var index = (point[1] / this.size[1]) * 100; // Percentage.
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
						var startX = this.getRelativeX(group_.startPos);
						var startY = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group_.level;
						var endX = startX + this._groupHeadSize;
						var endY = group_.endPos + this._cornerHeaderWidth - this.documentTopLeft[1];
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
						var startX = this.getRelativeX(group_.startPos);
						var startY = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group_.level;
						var endX = group_.endPos + this._cornerHeaderWidth - this.documentTopLeft[0];
						var endY = startY + this._groupHeadSize;

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
			this._updateOutlineState({level: level, index: -1}); // index: -1 targets all groups (there may be multiple separate column groups.).
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

	onRemove: function () {
		this.isRemoved = true;
		this.containerObject.getSectionWithName(L.CSections.ColumnHeader.name).position[1] = 0;
		this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).position[1] = 0;
	},

	onNewDocumentTopLeft: function () {},
	onLongPress: function () {},
	onMouseDown: function () {},
	onMouseUp: function () {},
	onMouseWheel: function () {},
	onContextMenu: function () {},
	onResize: function () {},
});

L.control.columnGroup = function (options) {
	return new L.Control.ColumnGroup(options);
};