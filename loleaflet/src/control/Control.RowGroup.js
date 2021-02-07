/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.RowGroup
*/

/* global */

/*
	This file is Calc only. This adds a section for grouped rows in Calc.
	When user selects some rows and groups them using "Data->Group and Outline->Group" menu path, this section is added into
	sections list of CanvasSectionContainer. See _addRemoveGroupSections in file CalcTileLayer.js

	This class is an extended version of "CanvasSectionObject".
*/

L.Control.RowGroup = L.Control.GroupBase.extend({
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

	update: function () {
		if (this.isRemoved) // Prevent calling while deleting the section. It causes errors.
			return;

		this._sheetGeometry = this._map._docLayer.sheetGeometry;
		this._groups = Array(this._sheetGeometry.getRowGroupLevels());

		// Calculate width on the fly.
		this.size[0] = this._computeSectionWidth();

		// Because this section's width is calculated on the fly, RowHeader and CornerHeader sections should be shifted.
		this.containerObject.getSectionWithName(L.CSections.RowHeader.name).position[0] = this.size[0] + Math.round(this.dpiScale);
		this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).position[0] = this.size[0] + Math.round(this.dpiScale);

		this._cornerHeaderHeight = this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).size[1];

		this._splitPos = this._map._docLayer._splitPanesContext.getSplitPos();

		this._collectGroupsData(this._sheetGeometry.getRowGroupsDataInView());
	},

	// This returns the required width for the section.
	_computeSectionWidth: function () {
		return this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * (this._groups.length + 1);
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
				this.context.moveTo(startX + this._groupHeadSize * 0.25, startY + this._groupHeadSize / 2 + 0.5);
				this.context.lineTo(startX + this._groupHeadSize * 0.75 + Math.round(this.dpiScale), startY + this._groupHeadSize / 2 + 0.5);
				this.context.stroke();
			}
		}
		else if (startY > this._cornerHeaderHeight) {
			// draw '+'
			this.context.beginPath();

			this.context.moveTo(startX + this._groupHeadSize * 0.25, startY + this._groupHeadSize / 2 + 0.5);
			this.context.lineTo(startX + this._groupHeadSize * 0.75 + Math.round(this.dpiScale), startY + this._groupHeadSize / 2 + 0.5);

			this.context.moveTo(startX + this._groupHeadSize * 0.50 + 0.5, startY + this._groupHeadSize * 0.25);
			this.context.lineTo(startX + this._groupHeadSize * 0.50 + 0.5, startY + this._groupHeadSize * 0.75 + Math.round(this.dpiScale));

			this.context.stroke();
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
		ctx.font = this._getFont();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(level + 1, startX + (ctrlHeadSize / 2), startY + (ctrlHeadSize / 2) + 2 * this.dpiScale);
	},

	// Handle user interaction.
	_updateOutlineState: function (group) {
		var state = group.hidden ? 'visible' : 'hidden'; // we have to send the new state
		var payload = 'outlinestate type=row' + ' level=' + group.level + ' index=' + group.index + ' state=' + state;
		this._map._socket.sendMessage(payload);
	},

	// When user clicks somewhere on the section, onMouseClick event is called by CanvasSectionContainer.
	// Clicked point is also given to handler function. This function finds the clicked header.
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

	onRemove: function () {
		this.isRemoved = true;
		this.containerObject.getSectionWithName(L.CSections.RowHeader.name).position[0] = 0;
		this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).position[0] = 0;
	},
});

L.control.rowGroup = function (options) {
	return new L.Control.RowGroup(options);
};