/*
 * L.Control.RowHeader
*/

L.Control.RowHeader = L.Control.ColRowHeader.extend({
    onAdd: function () {
	var docContainer = L.DomUtil.get('document-container');
	var divRowHeader = L.DomUtil.create('div', 'spreadsheet-container-row', docContainer.parentElement);
	this._table = L.DomUtil.create('table', 'spreadsheet-table-row', divRowHeader);
	this._rows = L.DomUtil.create('tbody', '', this._table);

	this._position = 0;
	this._totalHeight = 0;
	this._viewPort = 0;

	// dummy initial row header
	var trRow = L.DomUtil.create('tr', '', this._rows);
	var thRow = L.DomUtil.create('th', 'spreadsheet-table-row-cell  spreadsheet-table-noselect', trRow);
	L.DomUtil.create('div', 'spreadsheet-table-row-cell-text  spreadsheet-table-noselect', thRow);

	this._initializeColRowBar('rowbar');

	return document.createElement('div');
    },

    clearRows: function () {
	L.DomUtil.remove(this._rows);
	this._rows = L.DomUtil.create('tbody', '', this._table);
    },

    setViewPort: function(totalHeight, viewPort) {
	this._viewPort = viewPort;
	this._totalHeight = totalHeight;
    },

    setScrollPosition: function (position) {
	this._position = Math.min(0, position);
	L.DomUtil.setStyle(this._table, 'top', this._position + 'px');
    },

    offsetScrollPosition: function (offset) {
	this._position = Math.min(0,
	Math.max(this._position - offset,
		-(this._totalHeight - this._viewPort - 4)));
	L.DomUtil.setStyle(this._table, 'top', this._position + 'px');
    },

    fillRows: function (rows, converter, context) {
	var iterator, twip, height, row, cell, text;

	this.clearRows();
	for (iterator = 0; iterator < rows.length; iterator++) {
		height = rows[iterator].size - (iterator > 0 ? rows[iterator - 1].size : 0);
		twip = new L.Point(height, height);
		row  = L.DomUtil.create('tr', '', this._rows);
		cell = L.DomUtil.create('th', 'spreadsheet-table-row-cell  spreadsheet-table-noselect', row);
		text = L.DomUtil.create('div', 'spreadsheet-table-row-cell-text  spreadsheet-table-noselect', cell);
		text.innerHTML  = rows[iterator].text;
		height = Math.round(converter.call(context, twip).y) - (iterator > 0 ? 1 : 0) + 'px';
		L.DomUtil.setStyle(text, 'line-height', height);
		L.DomUtil.setStyle(text, 'height', height);
	}
    },

    updateRows: function (rows, converter, context) {
	var iterator, twip, height, text;

	for (iterator = 0; iterator < this._rows.childNodes.length; iterator++) {
		text  = this._rows.childNodes[iterator].firstChild.firstChild;
		height = rows[iterator].size - (iterator > 0 ? rows[iterator - 1].size : 0);
		twip = new L.Point(height, height);
		height = Math.round(converter.call(context, twip).y) - (iterator > 0 ? 1 : 0) + 'px';
		L.DomUtil.setStyle(text, 'line-height', height);
		L.DomUtil.setStyle(text, 'height', height);
	}
    }
});

L.control.rowHeader = function (options) {
	return new L.Control.RowHeader(options);
};
