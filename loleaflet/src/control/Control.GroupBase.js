/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.GroupBase
*/

/* global $ */

/*
	This file is Calc only. This is the base class for Control.RowGroup and Control.ColumnGroup files.

	This class is an extended version of "CanvasSectionObject".
*/

L.Control.GroupBase = L.Class.extend({
	interactable: true,
	sectionProperties: {},

	// Create font for the group headers. Group headers are on the left side of corner header.
	_createFont: function () {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', 'spreadsheet-header-row', baseElem);
		this.backgroundColor = L.DomUtil.getStyle(elem, 'background-color'); // This is a section property.
		this.borderColor = this.backgroundColor;
		this._textColor = L.DomUtil.getStyle(elem, 'color');
		var fontFamily = L.DomUtil.getStyle(elem, 'font-family');
		var fontSize = parseInt(L.DomUtil.getStyle(elem, 'font-size'));
		this._getFont = function() {
			return Math.round(fontSize * this.dpiScale) + 'px ' + fontFamily;
		};
		L.DomUtil.remove(elem);
	},

	// This returns the required width for the section.
	_computeSectionWidth: function () {
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
			var startPos = parseInt(groupData.startPos);
			var endPos = parseInt(groupData.endPos);
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
		if (level === 0) // First group's drawings are always drawn.
			return true;

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

	// This function calls drawing function for related to headers of groups. Headers are drawn on the left of corner header.
	drawLevelHeaders: function () {
		for (var i = 0; i < this._groups.length + 1; ++i) {
			this.drawLevelHeader(i);
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

	onRemove: function () {
		this.isRemoved = true;
		this.containerObject.getSectionWithName(L.CSections.RowHeader.name).position[0] = 0;
		this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).position[0] = 0;
	},

	onNewDocumentTopLeft: function () {},
	onLongPress: function () {},
	onMouseDown: function () {},
	onMouseUp: function () {},
	onMouseWheel: function () {},
	onContextMenu: function () {},
	onResize: function () {},
});