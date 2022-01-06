/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.CornerGroup
*/

/*
	This file is Calc only. This adds a header section for grouped columns and rows in Calc.
	When user uses row grouping and column grouping at the same time, there occurs a space at the crossing point of the row group and column group sections.
	This sections fills that gap.

	This class is an extended version of "CanvasSectionObject".
*/

/* global $ */

L.Control.CornerGroup = L.Class.extend({
	name: L.CSections.CornerGroup.name,
	anchor: ['top', 'left'],
	position: [0, 0],
	size: [0, 0], // Width and height will be calculated on the fly, according to width of RowGroups and height of ColumnGroups.
	expand: [''], // Don't expand.
	processingOrder: L.CSections.CornerGroup.processingOrder,
	drawingOrder: L.CSections.CornerGroup.drawingOrder,
	zIndex: L.CSections.CornerGroup.zIndex,
	interactable: true,
	sectionProperties: {
		cursor: 'pointer'
	},

	onInitialize: function () {
		this._map = L.Map.THIS;
		this._map.on('sheetgeometrychanged', this.update, this);
		this._map.on('viewrowcolumnheaders', this.update, this);

		// Style.
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', 'spreadsheet-header-row', baseElem);
		this.backgroundColor = L.DomUtil.getStyle(elem, 'background-color'); // This is a section property.
		this.borderColor = this.backgroundColor; // This is a section property.
		L.DomUtil.remove(elem);
	},

	update: function () {
		// Below 2 sections exist (since this section is added), unless they are being removed.

		var rowGroupSection = this.containerObject.getSectionWithName(L.CSections.RowGroup.name);
		if (rowGroupSection) {
			rowGroupSection.update(); // This will update its size.
			this.size[0] = rowGroupSection.size[0];
		}

		var columnGroupSection = this.containerObject.getSectionWithName(L.CSections.ColumnGroup.name);
		if (columnGroupSection) {
			columnGroupSection.update(); // This will update its size.
			this.size[1] = columnGroupSection.size[1];
		}
	},

	onClick: function () {
		this._map.wholeRowSelected = true;
		this._map.wholeColumnSelected = true;
		this._map.sendUnoCommand('.uno:SelectAll');
		// Row and column selections trigger updatecursor: message
		// and eventually _updateCursorAndOverlay function is triggered and focus will be at the map
		// thus the keyboard shortcuts like delete will work again.
		// selecting whole page does not trigger that and the focus will be lost.
		var docLayer = this._map._docLayer;
		if (docLayer)
			docLayer._updateCursorAndOverlay();
	},

	onMouseEnter: function () {
		this.containerObject.canvas.style.cursor = 'pointer';
		$.contextMenu('destroy', '#document-canvas');
	},

	onMouseLeave: function () {
		this.containerObject.canvas.style.cursor = 'default';
	},

	onDraw: function () { /* Only background and border drawings are needed for this section. And they are handled by CanvasSectionContainer. */ },
	onLongPress: function () {},
	onResize: function () {},
	onContextMenu: function () {},
	onMouseMove: function () {},
	onDoubleClick: function () {},
	onNewDocumentTopLeft: function() {},
	onMouseDown: function () {},
	onMouseUp: function () {},
	onRemove: function () {},
});

L.control.cornerGroup = function (options) {
	return new L.Control.CornerGroup(options);
};