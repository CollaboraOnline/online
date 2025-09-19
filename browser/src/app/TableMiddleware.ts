/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class TableMiddleware {
	static markerid = 0;

	currentTableData: any = {};
	lastTableMarkerJson = '';
	currentTableMarkerJson = '';

	tableResizeColumnMarkers: Array<TableResizeMarkerSection> = [];
	tableResizeRowMarkers: Array<TableResizeMarkerSection> = [];
	tableSelectionColumnMarkers: Array<TableSelectMarkerSection> = [];
	tableSelectionRowMarkers: Array<TableSelectMarkerSection> = [];
	tableAnchorSection: ShapeHandleAnchorSubSection | null = null;
	tableInsertMarkers: Array<TableInsertMarkerSection> = [];

	tableMarkersDragged = false;
	selectionHeaderDistanceFromTable = 6;
	selectionHeaderHeight = 16;
	resizeMarkerWidth = 0;
	resizeMarkerHeight = 0;
	selectionMarkerWidth = 24;
	selectionMarkerHeight = 24;
	addButtonWidth = 16;
	addButtonHeight = 16;
	addButtonOffset = 10;

	public setupTableOverlay() {
		app.map.on('messagesdone', this.updateTableMarkers, this);
		app.map.on('zoomend', this.onZoomForTableMarkers, this);
		this.initializeStyles();
	}

	public hasTableSelection() {
		if (!this.currentTableData) return false;
		return (
			this.currentTableData.rows != null ||
			this.currentTableData.columns != null
		);
	}

	public onZoomForTableMarkers() {
		this.lastTableMarkerJson = 'foo';
		this.updateTableMarkers();
	}

	public onTableSelectedMsg(txtMessage: string) {
		if (!app.map.isEditMode()) {
			this.clearTableMarkers();
			return;
		}

		if (this.tableMarkersDragged === true) {
			return;
		}

		// Parse the message
		txtMessage = txtMessage.substring('tableselected:'.length + 1);
		const message = JSON.parse(txtMessage);
		this.currentTableMarkerJson = txtMessage;
		this.currentTableData = message;

		app.map.fire('resettopbottompagespacing', {
			disableMarker: this.hasTableSelection(),
		});
	}

	private initializeStyles(): void {
		const bodyElement = document.getElementsByTagName('body')[0];

		const element = document.createElement('div');
		element.className = 'table-column-resize-marker';
		bodyElement.appendChild(element);

		const style = window.getComputedStyle(element, null);
		this.resizeMarkerWidth = parseInt(
			style.getPropertyValue('width').replace('px', ''),
		);
		this.resizeMarkerHeight = parseInt(
			style.getPropertyValue('height').replace('px', ''),
		);

		element.remove();
	}

	private clearTableMarkers() {
		var markerIndex;
		for (
			markerIndex = 0;
			markerIndex < this.tableResizeColumnMarkers.length;
			markerIndex++
		) {
			app.sectionContainer.removeSection(
				this.tableResizeColumnMarkers[markerIndex].name,
			);
		}
		this.tableResizeColumnMarkers = [];

		for (
			markerIndex = 0;
			markerIndex < this.tableResizeRowMarkers.length;
			markerIndex++
		) {
			app.sectionContainer.removeSection(
				this.tableResizeRowMarkers[markerIndex].name,
			);
		}
		this.tableResizeRowMarkers = [];

		for (
			markerIndex = 0;
			markerIndex < this.tableSelectionColumnMarkers.length;
			markerIndex++
		) {
			app.sectionContainer.removeSection(
				this.tableSelectionColumnMarkers[markerIndex].name,
			);
		}
		this.tableSelectionColumnMarkers = [];

		for (
			markerIndex = 0;
			markerIndex < this.tableSelectionRowMarkers.length;
			markerIndex++
		) {
			app.sectionContainer.removeSection(
				this.tableSelectionRowMarkers[markerIndex].name,
			);
		}
		this.tableSelectionRowMarkers = [];

		for (
			markerIndex = 0;
			markerIndex < this.tableInsertMarkers.length;
			markerIndex++
		) {
			app.sectionContainer.removeSection(
				this.tableInsertMarkers[markerIndex].name,
			);
		}
		this.tableInsertMarkers = [];

		if (this.tableAnchorSection)
			app.sectionContainer.removeSection(this.tableAnchorSection.name);
	}

	private addResizeMarker(markerType: string, x: number, y: number) {
		const position = new cool.SimplePoint(x, y);

		const marker = new TableResizeMarkerSection(
			'marker-' + String(TableMiddleware.markerid++),
			this.resizeMarkerWidth,
			this.resizeMarkerHeight,
			position,
			markerType === 'column'
				? 'table-column-resize-marker'
				: 'table-row-resize-marker',
		);

		app.sectionContainer.addSection(marker);

		if (markerType === 'column') this.tableResizeColumnMarkers.push(marker);
		else this.tableResizeRowMarkers.push(marker);

		return marker;
	}

	private addResizeMarkers() {
		this.lastTableMarkerJson = this.currentTableMarkerJson;

		if (!this.currentTableData.columns) return;

		const yForColumnMarkers =
			this.currentTableData.rows.tableOffset -
			(this.resizeMarkerHeight + this.selectionMarkerHeight) *
				app.dpiScale *
				app.pixelsToTwips;

		/// The first column marker.
		this.addResizeMarker(
			'column',
			this.currentTableData.columns.tableOffset +
				this.currentTableData.columns.left -
				this.resizeMarkerWidth * 0.5 * app.pixelsToTwips * app.dpiScale,
			yForColumnMarkers,
		);

		// Other column markers.
		for (let i = 0; i < this.currentTableData.columns.entries.length; i++) {
			this.addResizeMarker(
				'column',
				this.currentTableData.columns.tableOffset +
					this.currentTableData.columns.entries[i].position -
					this.resizeMarkerWidth * 0.5 * app.pixelsToTwips * app.dpiScale,
				yForColumnMarkers,
			);
		}

		// The last column marker.
		this.addResizeMarker(
			'column',
			this.currentTableData.columns.tableOffset +
				this.currentTableData.columns.right -
				this.resizeMarkerWidth * 0.5 * app.pixelsToTwips * app.dpiScale,
			yForColumnMarkers,
		);

		const xForRowMarkers =
			this.currentTableData.columns.tableOffset +
			this.currentTableData.columns.left -
			(this.resizeMarkerWidth + this.selectionMarkerWidth) *
				app.dpiScale *
				app.pixelsToTwips;

		// Row markers.
		for (let i = 0; i < this.currentTableData.rows.entries.length; i++) {
			this.addResizeMarker(
				'row',
				xForRowMarkers,
				this.currentTableData.rows.tableOffset +
					this.currentTableData.rows.entries[i].position -
					this.resizeMarkerHeight * 0.5 * app.dpiScale * app.pixelsToTwips,
			);
		}

		// The last row marker.
		this.addResizeMarker(
			'row',
			xForRowMarkers,
			this.currentTableData.rows.tableOffset +
				this.currentTableData.rows.right -
				this.resizeMarkerHeight * 0.5 * app.dpiScale * app.pixelsToTwips,
		);
	}

	private addSelectionMarker(
		markerType: string,
		x: number,
		y: number,
		width: number,
		height: number,
	) {
		const position = new cool.SimplePoint(x, y);

		const marker = new TableSelectMarkerSection(
			'marker-' + String(TableMiddleware.markerid++),
			width,
			height,
			position,
			'table-select-marker ' +
				(markerType === 'column'
					? 'table-select-marker--column'
					: 'table-select-marker--row'),
		);

		app.sectionContainer.addSection(marker);

		if (markerType === 'column') this.tableSelectionColumnMarkers.push(marker);
		else this.tableSelectionRowMarkers.push(marker);

		return marker;
	}

	private addSelectionMarkers() {
		const yForColumnSelectionMarkers =
			this.currentTableData.rows.tableOffset -
			this.selectionMarkerHeight * app.dpiScale * app.pixelsToTwips;

		// First column selection marker.
		this.addSelectionMarker(
			'column',
			this.currentTableData.columns.tableOffset +
				this.currentTableData.columns.left,
			yForColumnSelectionMarkers,
			((this.currentTableData.columns.entries[0].position -
				this.currentTableData.columns.left) *
				app.twipsToPixels) /
				app.dpiScale,
			this.selectionMarkerHeight,
		);

		for (let i = 1; i < this.currentTableData.columns.entries.length; i++) {
			this.addSelectionMarker(
				'column',
				this.currentTableData.columns.tableOffset +
					this.currentTableData.columns.entries[i - 1].position,
				yForColumnSelectionMarkers,
				((this.currentTableData.columns.entries[i].position -
					this.currentTableData.columns.entries[i - 1].position) *
					app.twipsToPixels) /
					app.dpiScale,
				this.selectionMarkerHeight,
			);
		}

		// Last column selection marker.
		this.addSelectionMarker(
			'column',
			this.currentTableData.columns.tableOffset +
				this.currentTableData.columns.entries[
					this.currentTableData.columns.entries.length - 1
				].position,
			yForColumnSelectionMarkers,
			((this.currentTableData.columns.right -
				this.currentTableData.columns.entries[
					this.currentTableData.columns.entries.length - 1
				].position) *
				app.twipsToPixels) /
				app.dpiScale,
			this.selectionMarkerHeight,
		);

		const xForColumnSelectionMarkers =
			this.currentTableData.columns.tableOffset +
			this.currentTableData.columns.left -
			this.selectionMarkerWidth * app.dpiScale * app.pixelsToTwips;

		// First row selection marker.
		this.addSelectionMarker(
			'row',
			xForColumnSelectionMarkers,
			this.currentTableData.rows.tableOffset + this.currentTableData.rows.left,
			this.selectionMarkerWidth,
			((this.currentTableData.rows.entries[0].position -
				this.currentTableData.rows.left) *
				app.twipsToPixels) /
				app.dpiScale,
		);

		for (let i = 1; i < this.currentTableData.rows.entries.length; i++) {
			this.addSelectionMarker(
				'row',
				xForColumnSelectionMarkers,
				this.currentTableData.rows.tableOffset +
					this.currentTableData.rows.entries[i - 1].position,
				this.selectionMarkerWidth,
				((this.currentTableData.rows.entries[i].position -
					this.currentTableData.rows.entries[i - 1].position) *
					app.twipsToPixels) /
					app.dpiScale,
			);
		}

		// Last row selection marker.
		this.addSelectionMarker(
			'row',
			xForColumnSelectionMarkers,
			this.currentTableData.rows.tableOffset +
				this.currentTableData.rows.entries[
					this.currentTableData.rows.entries.length - 1
				].position,
			this.selectionMarkerWidth,
			((this.currentTableData.rows.right -
				this.currentTableData.rows.entries[
					this.currentTableData.rows.entries.length - 1
				].position) *
				app.twipsToPixels) /
				app.dpiScale,
		);
	}

	private addMoveMarker() {
		let x = parseInt(this.currentTableData.rectangle.x);
		let y = parseInt(this.currentTableData.rectangle.y);

		const anchorSize = ShapeHandleAnchorSubSection.tableAnchorIconSize;

		x -= Math.round(anchorSize[0] * app.pixelsToTwips);
		y -= Math.round(anchorSize[1] * app.pixelsToTwips);

		this.tableAnchorSection = new ShapeHandleAnchorSubSection(
			null,
			'table-anchor',
			anchorSize,
			new cool.SimplePoint(x, y),
			null,
		);
		app.sectionContainer.addSection(this.tableAnchorSection);
	}

	private updateMoveMarkerVisibility() {
		if (
			this.currentTableData &&
			this.currentTableMarkerJson === this.lastTableMarkerJson &&
			this.currentTableData.rows &&
			this.currentTableData.columns &&
			app.map.getDocType() === 'presentation' &&
			this.currentTableData.rectangle &&
			!this.tableAnchorSection
		)
			this.addMoveMarker();
	}

	private addInsertMarkers() {
		// Column insert marker.
		const insertColumnX =
			this.currentTableData.columns.tableOffset +
			this.currentTableData.columns.right +
			(this.addButtonOffset * app.pixelsToTwips) / app.dpiScale;
		const insertColumnY =
			this.currentTableData.rows.tableOffset + this.currentTableData.rows.left;
		const insertColumnWidth = this.addButtonWidth;
		const insertColumnHeight =
			((this.currentTableData.rows.right - this.currentTableData.rows.left) *
				app.twipsToPixels) /
			app.dpiScale;

		const insertColumnMarkerSection = new TableInsertMarkerSection(
			'column',
			new cool.SimplePoint(insertColumnX, insertColumnY),
		);
		insertColumnMarkerSection.setMarkerSize(
			insertColumnWidth,
			insertColumnHeight,
		);
		app.sectionContainer.addSection(insertColumnMarkerSection);

		this.tableInsertMarkers.push(insertColumnMarkerSection);

		// Row insert marker.
		const insertRowX =
			this.currentTableData.columns.tableOffset +
			this.currentTableData.columns.left;
		const insertRowY =
			this.currentTableData.rows.tableOffset +
			this.currentTableData.rows.right +
			(this.addButtonOffset * app.pixelsToTwips) / app.dpiScale;
		const insertRowWidth =
			((this.currentTableData.columns.right -
				this.currentTableData.columns.left) *
				app.twipsToPixels) /
			app.dpiScale;
		const insertRowHeight = this.addButtonHeight;

		const insertRowMarkerSection = new TableInsertMarkerSection(
			'row',
			new cool.SimplePoint(insertRowX, insertRowY),
		);
		insertRowMarkerSection.setMarkerSize(insertRowWidth, insertRowHeight);
		app.sectionContainer.addSection(insertRowMarkerSection);

		this.tableInsertMarkers.push(insertRowMarkerSection);
	}

	private updateTableMarkers() {
		this.clearTableMarkers();

		if (this.currentTableData === undefined) return; // not writer, no table selected yet etc.

		if (this.currentTableData && this.currentTableData.columns) {
			this.updateMoveMarkerVisibility(); // cursor might be shown, then it doesn't work
			this.addResizeMarkers();
			this.addSelectionMarkers();
			this.addInsertMarkers();
		}
	}
}
