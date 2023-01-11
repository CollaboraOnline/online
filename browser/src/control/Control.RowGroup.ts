/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.RowGroup
*/

/* global app */

/*
	This file is Calc only. This adds a section for grouped rows in Calc.
	When user selects some rows and groups them using "Data->Group and Outline->Group" menu path, this section is added into
	sections list of CanvasSectionContainer. See _addRemoveGroupSections in file CalcTileLayer.js

	This class is an extended version of "CanvasSectionObject".
*/
namespace cool {

export class RowGroup extends GroupBase {

	_map: any;
	_sheetGeometry: cool.SheetGeometry;
	_cornerHeaderHeight: number;
	_splitPos: cool.Point;

	constructor() {
		super({
			name: L.CSections.RowGroup.name,
			anchor: [[L.CSections.CornerGroup.name, 'bottom', 'top'], 'left'],
			position: [0, 0], // This section's myTopLeft is placed according to corner group section if exists, if not, this is placed at (0, 0).
			size: [0, 0], // No initial height is necessary. Height will be expanded. Width is computed inside update function.
			expand: 'top bottom', // Expand vertically.
			processingOrder: L.CSections.RowGroup.processingOrder,
			drawingOrder: L.CSections.RowGroup.drawingOrder,
			zIndex: L.CSections.RowGroup.zIndex,
			interactable: true,
			sectionProperties: {},
		});

	}

	// This function is called by CanvasSectionContainer when the section is added to the sections list.
	onInitialize(): void {
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

	update(): void {
		if (this.isRemoved) // Prevent calling while deleting the section. It causes errors.
			return;

		this._sheetGeometry = this._map._docLayer.sheetGeometry;
		this._groups = Array(this._sheetGeometry.getRowGroupLevels());

		// Calculate width on the fly.
		this.size[0] = this._computeSectionWidth();

		this._cornerHeaderHeight = this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).size[1];

		this._splitPos = (this._map._docLayer._splitPanesContext as cool.SplitPanesContext).getSplitPos();

		this._collectGroupsData(this._sheetGeometry.getRowGroupsDataInView());
	}

	// This returns the required width for the section.
	_computeSectionWidth(): number {
		return this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * (this._groups.length + 1);
	}

	getRelativeY (docPos: number): number {
		if (docPos <= this._splitPos.y) {
			return docPos - this.documentTopLeft[1] + this._cornerHeaderHeight;
		}
		else {
			// max here is to prevent encroachment of the fixed pane-area.
			return Math.max(docPos - this.documentTopLeft[1], this._splitPos.y) + this._cornerHeaderHeight;
		}
	}

	drawGroupControl (group: GroupEntry): void {
		let startX = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group.level;
		const startY = this.getRelativeY(group.startPos);
		const endY = group.endPos + this._cornerHeaderHeight - this.documentTopLeft[1];

		if (startY > this._cornerHeaderHeight) {
			// draw head
			this.context.fillStyle = this.backgroundColor;
			this.context.fillRect(this.transformRectX(startX, this._groupHeadSize), startY, this._groupHeadSize, this._groupHeadSize);
			this.context.strokeStyle = 'black';
			this.context.lineWidth = app.dpiScale;
			this.context.strokeRect(this.transformRectX(startX + 0.5, this._groupHeadSize), startY + 0.5, this._groupHeadSize, this._groupHeadSize);
		}

		if (!group.hidden && endY > startY) {
			//draw tail
			startX += this._groupHeadSize * 0.5;
			this.context.strokeStyle = 'black';
			this.context.lineWidth = app.dpiScale;
			this.context.beginPath();
			this.context.moveTo(this.transformX(startX + 0.5), startY + this._groupHeadSize + 0.5);
			this.context.lineTo(this.transformX(startX + 0.5), endY - app.roundedDpiScale + 0.5);
			this.context.lineTo(this.transformX(startX + this._groupHeadSize / 2), endY - app.roundedDpiScale + 0.5);
			this.context.stroke();
			startX -= this._groupHeadSize * 0.5;
			if (startY > this._cornerHeaderHeight) {
				// draw '-'
				this.context.moveTo(this.transformX(startX + this._groupHeadSize * 0.25), startY + this._groupHeadSize / 2 + 0.5);
				this.context.lineTo(this.transformX(startX + this._groupHeadSize * 0.75 + app.roundedDpiScale), startY + this._groupHeadSize / 2 + 0.5);
				this.context.stroke();
			}
		}
		else if (startY > this._cornerHeaderHeight) {
			// draw '+'
			this.context.beginPath();

			this.context.moveTo(this.transformX(startX + this._groupHeadSize * 0.25), startY + this._groupHeadSize / 2 + 0.5);
			this.context.lineTo(this.transformX(startX + this._groupHeadSize * 0.75 + app.roundedDpiScale), startY + this._groupHeadSize / 2 + 0.5);

			this.context.moveTo(this.transformX(startX + this._groupHeadSize * 0.50 + 0.5), startY + this._groupHeadSize * 0.25);
			this.context.lineTo(this.transformX(startX + this._groupHeadSize * 0.50 + 0.5), startY + this._groupHeadSize * 0.75 + app.roundedDpiScale);

			this.context.stroke();
		}
	}

	drawLevelHeader (level: number): void {
		const ctx = this.context;
		const ctrlHeadSize = this._groupHeadSize;
		const levelSpacing = this._levelSpacing;

		const startX = levelSpacing + (ctrlHeadSize + levelSpacing) * level;
		const startY = Math.round((this._cornerHeaderHeight - ctrlHeadSize) * 0.5);

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
	_updateOutlineState (group: Partial<GroupEntry>): void {
		const state = group.hidden ? 'visible' : 'hidden'; // we have to send the new state
		const payload = 'outlinestate type=row' + ' level=' + group.level + ' index=' + group.index + ' state=' + state;
		app.socket.sendMessage(payload);
	}

	// When user clicks somewhere on the section, onMouseClick event is called by CanvasSectionContainer.
	// Clicked point is also given to handler function. This function finds the clicked header.
	findClickedLevel (point: number[]): number {
		if (point[1] < this._cornerHeaderHeight) {
			let index = (this.transformX(point[0]) / this.size[0]) * 100; // Percentage.
			const levelPercentage = (1 / (this._groups.length + 1)) * 100; // There is one more button than the number of levels.
			index = Math.floor(index / levelPercentage);
			return index;
		}
		else {
			return -1;
		}
	}

	findClickedGroup (point: number[]): GroupEntry {
		const mirrorX = this.isCalcRTL();
		for (let i = 0; i < this._groups.length; i++) {
			if (this._groups[i]) {
				for (const group in this._groups[i]) {
					if (Object.prototype.hasOwnProperty.call(this._groups[i], group)) {
						const group_ = this._groups[i][group];
						const startX = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group_.level;
						const startY = this.getRelativeY(group_.startPos);
						const endX = startX + this._groupHeadSize;
						const endY = startY + this._groupHeadSize;
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
	findTailsGroup (point: number[]): GroupEntry {
		const mirrorX = this.isCalcRTL();
		for (let i = 0; i < this._groups.length; i++) {
			if (this._groups[i]) {
				for (const group in this._groups[i]) {
					if (Object.prototype.hasOwnProperty.call(this._groups[i], group)) {
						const group_ = this._groups[i][group];
						const startX = this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * group_.level;
						const startY = this.getRelativeY(group_.startPos);
						const endX = startX + this._groupHeadSize; // Let's use this as thikcness. User doesn't have to double click on a pixel:)
						const endY = group_.endPos + this._cornerHeaderHeight - this.documentTopLeft[1];

						if (this.isPointInRect(point, startX, startY, endX, endY, mirrorX)) {
							return group_;
						}
					}
				}
			}
		}
	}

	onRemove(): void {
		this.isRemoved = true;
		this.containerObject.getSectionWithName(L.CSections.RowHeader.name).position[0] = 0;
		this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).position[0] = 0;
	}
}

}

L.Control.RowGroup = cool.RowGroup;

L.control.rowGroup = function () {
	return new L.Control.RowGroup();
};
