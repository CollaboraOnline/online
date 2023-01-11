/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.GroupBase
*/

namespace cool {

export interface GroupEntry {
	level: number,
	index: number,
	startPos: number,
	endPos: number,
	hidden: boolean
}

export interface GroupEntryStrings {
	level: string,
	index: string,
	startPos: string,
	endPos: string,
	hidden: string
}

/*
	This file is Calc only. This is the base class for Control.RowGroup and Control.ColumnGroup files.

	This class is an extended version of "CanvasSectionObject".
*/

export class GroupBase extends CanvasSectionObject {
	_textColor: string;
	_getFont: () => string;
	_levelSpacing: number;
	_groupHeadSize: number;
	_groups: Array<Array<GroupEntry>>;
	isRemoved: boolean = false;

	constructor (options: SectionInitProperties) {
		super(options);
		if (options.interactable === undefined)
			this.interactable = true;
		if (options.sectionProperties === undefined)
			this.sectionProperties = {};
	}

	// Create font for the group headers. Group headers are on the left side of corner header.
	_createFont(): void {
		const baseElem = document.getElementsByTagName('body')[0];
		const elem = L.DomUtil.create('div', 'spreadsheet-header-row', baseElem);
		this.backgroundColor = L.DomUtil.getStyle(elem, 'background-color'); // This is a section property.
		this.borderColor = this.backgroundColor;
		this._textColor = L.DomUtil.getStyle(elem, 'color');
		const fontFamily = L.DomUtil.getStyle(elem, 'font-family');
		const fontSize = parseInt(L.DomUtil.getStyle(elem, 'font-size'));
		this._getFont = function() {
			return Math.round(fontSize * app.dpiScale) + 'px ' + fontFamily;
		};
		L.DomUtil.remove(elem);
	}

	// This returns the required width for the section.
	_computeSectionWidth(): number {
		return this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * (this._groups.length + 1);
	}

	// This function puts data into a good shape for use of this class.
	_collectGroupsData (groups: Array<GroupEntryStrings>): void {
		let level: number, groupEntry: GroupEntry;

		var lastGroupIndex = new Array(groups.length);
		var firstChildGroupIndex = new Array(groups.length);
		var lastLevel = -1;
		for (var i = 0; i < groups.length; ++i) {
			// a new group start
			var groupData = groups[i];
			level = parseInt(groupData.level) - 1;
			if (!this._groups[level]) {
				this._groups[level] = [];
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
				index: parseInt(groupData.index),
				startPos: startPos,
				endPos: endPos,
				hidden: isHidden
			};
			this._groups[level][parseInt(groupData.index)] = groupEntry;
			lastGroupIndex[level] = groupData.index;
			if (level > lastLevel) {
				firstChildGroupIndex[level] = groupData.index;
				lastLevel = level;
			}
			else if (level === lastLevel) {
				firstChildGroupIndex[level + 1] = undefined;
			}
		}
	}

	// If previous group is visible (expanded), current group's plus sign etc. will be drawn. If previous group is not expanded, current group's plus sign etc. won't be drawn.
	_isPreviousGroupVisible (index: number, level: number): boolean {
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
	}

	drawGroupControl (entry: GroupEntry): void {
		return;
	}

	// This calls drawing functions related to tails and plus & minus signs etc.
	drawOutline(): void {
		if (this._groups) {
			for (let i = 0; i < this._groups.length; i++) {
				if (this._groups[i]) {
					for (const group in this._groups[i]) {
						if (Object.prototype.hasOwnProperty.call(this._groups[i], group)) {
							if (this._isPreviousGroupVisible(this._groups[i][group].index, this._groups[i][group].level))
								this.drawGroupControl(this._groups[i][group]);
						}
					}
				}
			}
		}
	}

	drawLevelHeader (level: number): void {
		return;
	}

	// This function calls drawing function for related to headers of groups. Headers are drawn on the left of corner header.
	drawLevelHeaders(): void {
		for (var i = 0; i < this._groups.length + 1; ++i) {
			this.drawLevelHeader(i);
		}
	}

	/// In Calc RTL mode, x-coordinate of a given rectangle of given width is horizontally mirrored
	transformRectX (xcoord: number, rectWidth: number): number {
		return this.isCalcRTL() ? this.size[0] - xcoord - rectWidth : xcoord;
	}

	/// In Calc RTL mode, x-coordinate of a given point is horizontally mirrored
	transformX (xcoord: number): number {
		return this.isCalcRTL() ? this.size[0] - xcoord : xcoord;
	}

	/**
	 * Checks if the given point is within the bounds of the rectangle defined by
	 * startX, startY, endX, endY. If mirrorX is true then point is horizontally
	 * mirrored before checking.
	 */
	isPointInRect (point: number[], startX: number, startY: number, endX: number, endY: number, mirrorX: boolean): boolean {
		var x = mirrorX ? this.size[0] - point[0] : point[0];
		var y = point[1];

		return (x > startX && x < endX && y > startY && y < endY);
	}

	onDraw(): void {
		this.drawOutline();
		this.drawLevelHeaders();
	}

	findClickedGroup (point: number[]): GroupEntry {
		return null;
	}

	findClickedLevel (point: number[]): number {
		return -1;
	}

	onMouseMove (point: number[]): void {
		// If mouse is above a group header or a group control, we change the cursor.
		if (this.findClickedGroup(point) !== null || this.findClickedLevel(point) !== -1)
			this.context.canvas.style.cursor = 'pointer';
		else
			this.context.canvas.style.cursor = 'default';
	}

	onMouseLeave(): void {
		this.context.canvas.style.cursor = 'default';
	}

	_updateOutlineState(group: Partial<GroupEntry>): void {
		return;
	}

	onClick (point: number[]): void {
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
	}

	findTailsGroup (point: number[]): GroupEntry {
		return null;
	}

	/* Double clicking on a group's tail closes it. */
	onDoubleClick (point: number[]): void {
		var group = this.findTailsGroup(point);
		if (group)
			this._updateOutlineState(group);
	}

	onMouseEnter(): void {
		$.contextMenu('destroy', '#document-canvas');
	}

	onRemove(): void {
		this.isRemoved = true;
		this.containerObject.getSectionWithName(L.CSections.RowHeader.name).position[0] = 0;
		this.containerObject.getSectionWithName(L.CSections.CornerHeader.name).position[0] = 0;
	}
}
}

L.Control.GroupBase = cool.GroupBase;
