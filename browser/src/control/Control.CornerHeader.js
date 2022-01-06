/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.CornerHeader
*/

/*
	Calc only.
*/

/* global $ app */
L.Control.CornerHeader = L.Class.extend({
	name: L.CSections.CornerHeader.name,
	anchor: [[L.CSections.ColumnGroup.name, 'bottom', 'top'], [L.CSections.RowGroup.name, 'right', 'left']],
	position: [0, 0], // If column group or row group sections exist, myTopleft will be set according to their positions.
	size: [48 * app.dpiScale, 19 * app.dpiScale], // These values are static.
	expand: [''], // Don't expand.
	processingOrder: L.CSections.CornerHeader.processingOrder,
	drawingOrder: L.CSections.CornerHeader.drawingOrder,
	zIndex: L.CSections.CornerHeader.zIndex,
	interactable: true,
	sectionProperties: {
		cursor: 'pointer'
	},

	onInitialize: function () {
		this._map = L.Map.THIS;

		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', 'spreadsheet-header-row', baseElem);
		this._textColor = L.DomUtil.getStyle(elem, 'color');
		this.backgroundColor = L.DomUtil.getStyle(elem, 'background-color'); // This is a section property.
		this.borderColor = L.DomUtil.getStyle(elem, 'border-top-color'); // This is a section property.
		L.DomUtil.remove(elem);
	},

	onDraw: function () {

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
		this.containerObject.canvas.style.cursor = this.sectionProperties.cursor;
		$.contextMenu('destroy', '#document-canvas');
	},

	onMouseLeave: function () {
		this.containerObject.canvas.style.cursor = 'default';
	},

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

L.control.cornerHeader = function (options) {
	return new L.Control.CornerHeader(options);
};
