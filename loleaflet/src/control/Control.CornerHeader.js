/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.CornerHeader
*/

/*
	Calc only.
*/

/* global $ */
L.Control.CornerHeader = L.Class.extend({
	name: L.CSections.CornerHeader.name,
	anchor: ['top', 'left'],
	position: [0, 0],
	size: [48 * window.devicePixelRatio, 19 * window.devicePixelRatio], // These values are static.
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
		this._map.sendUnoCommand('.uno:SelectAll');
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
	onMouseUp: function () {}
});

L.control.cornerHeader = function (options) {
	return new L.Control.CornerHeader(options);
};
