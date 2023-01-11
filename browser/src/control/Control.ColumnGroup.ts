/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.ColumnGroup
*/

/* global app */

/*
	This file is Calc only. This adds a section for grouped columns in Calc.
	When user selects some columns and groups them using "Data->Group and Outline->Group" menu path, this section is added into
	sections list of CanvasSectionContainer. See _addRemoveGroupSections in file CalcTileLayer.js

	This class is an extended version of "CanvasSectionObject".
*/

namespace cool {

export class ColumnGroup extends GroupBase {
	_map: any;
	_sheetGeometry: cool.SheetGeometry;
	_cornerHeaderWidth: number;
	_splitPos: cool.Point;

	constructor() {
		super({
			name: L.CSections.ColumnGroup.name,
			anchor: ['top', [L.CSections.CornerGroup.name, 'right', 'left']],
			position: [0, 0], // This section's myTopLeft is placed according to corner group section if exists, if not, this is placed at (0, 0).
			size: [0, 0], // No initial width is necessary. Width will be expanded. Height is computed inside update function.
			expand: 'left right', // Expand horizontally.
			processingOrder: L.CSections.ColumnGroup.processingOrder,
			drawingOrder: L.CSections.ColumnGroup.drawingOrder,
			zIndex: L.CSections.ColumnGroup.zIndex,
			interactable: true,
			sectionProperties: {},
		});
	}

	// This function is called by CanvasSectionContainer when the section is added to the sections list.
	onInitialize() {
		this._map = L.Map.THIS;
		this.sectionProperties.docLayer = this._map._docLayer;
		this._groups = null;

		// group control styles
		this._groupHeadSize = Math.round(12 * app.dpiScale);
		this._levelSpacing = app.roundedDpiScale;

		this._map.on('sheetgeometrychanged', this.update, this);
		this._map.on('viewrowcolumnheaders', this.update, this);
		this._createFont();
		this.update();
		this.isRemoved = false;
	}

	update() {
		if (this.isRemoved) // Prevent calling while deleting the section. It causes errors.
			return;

		this._sheetGeometry = this._map._docLayer.sheetGeometry;
		this._groups = Array(this._sheetGeometry.getColumnGroupLevels());

		// Calculate width on the fly.
		this.size[1] = this._computeSectionHeight();

		this._cornerHeaderWidth = this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).size[0];

		this._splitPos = (this._map._docLayer._splitPanesContext as cool.SplitPanesContext).getSplitPos();

		this._collectGroupsData(this._sheetGeometry.getColumnGroupsDataInView());
	}

	// This returns the required height for the section.
	_computeSectionHeight() {
		return this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * (this._groups.length + 1);
	}

	getRelativeX (docPos: number) {
		if (docPos <= this._splitPos.x) {
			return docPos - this.documentTopLeft[0] + this._cornerHeaderWidth;
		}
		else {
			// max here is to prevent encroachment of the fixed pane-area.
			return Math.max(docPos - this.documentTopLeft[0], this._splitPos.x) + this._cornerHeaderWidth;
		}
	}

	drawGroupControl (group: GroupEntry) {
		var startX = this.getRelativeX(group.startPos);
		var startY = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group.level;
		var endX = group.endPos + this._cornerHeaderWidth - this.documentTopLeft[0];

		if (startX > this._cornerHeaderWidth) {
			// draw head
			this.context.fillStyle = this.backgroundColor;
			this.context.fillRect(this.transformRectX(startX, this._groupHeadSize), startY, this._groupHeadSize, this._groupHeadSize);
			this.context.strokeStyle = 'black';
			this.context.lineWidth = app.dpiScale;
			this.context.strokeRect(this.transformRectX(startX + 0.5, this._groupHeadSize), startY + 0.5, this._groupHeadSize, this._groupHeadSize);
		}

		if (!group.hidden && endX > startX) {
			//draw tail
			startY += this._groupHeadSize * 0.5;
			this.context.strokeStyle = 'black';
			this.context.lineWidth = app.dpiScale;
			this.context.beginPath();
			this.context.moveTo(this.transformX(startX + this._groupHeadSize + 0.5), startY + 0.5);
			this.context.lineTo(this.transformX(endX - app.roundedDpiScale + 0.5), startY + 0.5);
			this.context.lineTo(this.transformX(endX - app.roundedDpiScale + 0.5), startY + this._groupHeadSize / 2);
			this.context.stroke();
			startY -= this._groupHeadSize * 0.5;
			if (startX > this._cornerHeaderWidth) {
				// draw '-'
				this.context.moveTo(this.transformX(startX + this._groupHeadSize * 0.25), startY + this._groupHeadSize * 0.5 + 0.5);
				this.context.lineTo(this.transformX(startX + this._groupHeadSize * 0.75 + app.roundedDpiScale), startY + this._groupHeadSize * 0.5 + 0.5);
				this.context.stroke();
			}
		}
		else if (startX > this._cornerHeaderWidth) {
			// draw '+'
			this.context.beginPath();
			this.context.moveTo(this.transformX(startX + this._groupHeadSize * 0.25), startY + this._groupHeadSize * 0.5 + 0.5);
			this.context.lineTo(this.transformX(startX + this._groupHeadSize * 0.75 + app.roundedDpiScale), startY + this._groupHeadSize * 0.5 + 0.5);

			this.context.moveTo(this.transformX(startX + this._groupHeadSize * 0.50 + 0.5), startY + this._groupHeadSize * 0.25);
			this.context.lineTo(this.transformX(startX + this._groupHeadSize * 0.50 + 0.5), startY + this._groupHeadSize * 0.75 + app.roundedDpiScale);

			this.context.stroke();
		}
	}

	drawLevelHeader (level: number) {
		var ctx = this.context;
		var ctrlHeadSize = this._groupHeadSize;
		var levelSpacing = this._levelSpacing;

		var startX = Math.round((this._cornerHeaderWidth - ctrlHeadSize) * 0.5);
		var startY = levelSpacing + (ctrlHeadSize + levelSpacing) * level;

		ctx.strokeStyle = 'black';
		ctx.lineWidth = app.dpiScale;
		ctx.strokeRect(this.transformRectX(startX + 0.5, ctrlHeadSize), startY + 0.5, ctrlHeadSize, ctrlHeadSize);
		// draw level number
		ctx.fillStyle = this._textColor;
		ctx.font = this._getFont();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText((level + 1).toString(), this.transformX(startX + (ctrlHeadSize / 2)), startY + (ctrlHeadSize / 2) + 2 * app.dpiScale);
	}

	// Handle user interaction.
	_updateOutlineState (group: Partial<GroupEntry>) {
		var state = group.hidden ? 'visible' : 'hidden'; // we have to send the new state
		var payload = 'outlinestate type=column' + ' level=' + group.level + ' index=' + group.index + ' state=' + state;
		app.socket.sendMessage(payload);
	}

	// When user clicks somewhere on the section, onMouseClick event is called by CanvasSectionContainer.
	// Clicked point is also given to handler function. This function finds the clicked header.
	findClickedLevel (point: number[]) {
		var mirrorX = this.isCalcRTL();
		if ((!mirrorX && point[0] < this._cornerHeaderWidth)
			|| (mirrorX && point[0] > this.size[0] - this._cornerHeaderWidth)) {
			var index = (point[1] / this.size[1]) * 100; // Percentage.
			var levelPercentage = (1 / (this._groups.length + 1)) * 100; // There is one more button than the number of levels.
			index = Math.floor(index / levelPercentage);
			return index;
		}
		else {
			return -1;
		}
	}

	findClickedGroup (point: number[]) {
		var mirrorX = this.isCalcRTL();
		for (var i = 0; i < this._groups.length; i++) {
			if (this._groups[i]) {
				for (var group in this._groups[i]) {
					if (Object.prototype.hasOwnProperty.call(this._groups[i], group)) {
						var group_ = this._groups[i][group];
						var startX = this.getRelativeX(group_.startPos);
						var startY = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group_.level;
						var endX = startX + this._groupHeadSize;
						var endY = group_.endPos + this._cornerHeaderWidth - this.documentTopLeft[1];
						if (this.isPointInRect(point, startX, startY, endX, endY, mirrorX)) {
							return group_;
						}
					}
				}
			}
		}
		return null;
	}

	// Users can double click on group tails.
	findTailsGroup (point: number[]) {
		var mirrorX = this.isCalcRTL();
		for (var i = 0; i < this._groups.length; i++) {
			if (this._groups[i]) {
				for (var group in this._groups[i]) {
					if (Object.prototype.hasOwnProperty.call(this._groups[i], group)) {
						var group_ = this._groups[i][group];
						var startX = this.getRelativeX(group_.startPos);
						var startY = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group_.level;
						var endX = group_.endPos + this._cornerHeaderWidth - this.documentTopLeft[0];
						var endY = startY + this._groupHeadSize;
						if (this.isPointInRect(point, startX, startY, endX, endY, mirrorX)) {
							return group_;
						}
					}
				}
			}
		}
	}

	onRemove () {
		this.isRemoved = true;
		this.containerObject.getSectionWithName(L.CSections.ColumnHeader.name).position[1] = 0;
		this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).position[1] = 0;
	}
}

}

L.Control.ColumnGroup = cool.ColumnGroup;

L.control.columnGroup = function () {
	return new L.Control.ColumnGroup();
};
