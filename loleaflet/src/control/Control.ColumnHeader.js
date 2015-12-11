/*
* Control.ColumnHeader
*/

L.Control.ColumnHeader = L.Control.extend({
	onAdd: function (map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
		return document.createElement('div');
	},

	_initialize: function () {
		this._initialized = true;
		this._map.on('scrolloffset', this.offsetScrollPosition, this);
		this._map.on('updatescrolloffset', this.setScrollPosition, this);
		this._map.on('updateviewport', this.setViewPort, this);
		this._map.on('viewrowcolumnheaders', this.viewRowColumnHeaders, this);
		var docContainer = L.DomUtil.get('document-container');
		var divHeader = L.DomUtil.create('div', 'spreadsheet-container-column', docContainer.parentElement);
		var tableContainer =  L.DomUtil.create('table', 'spreadsheet-container-table', divHeader);
		var trContainer = L.DomUtil.create('tr', '', tableContainer);
		var thCorner = L.DomUtil.create('th', 'spreadsheet-container-th-corner', trContainer);
		var tableCorner = L.DomUtil.create('table', 'spreadsheet-table-corner', thCorner);
		var trCorner = L.DomUtil.create('tr', '', tableCorner);
		L.DomUtil.create('th', '', trCorner);

		var thColumns = L.DomUtil.create('th', 'spreadsheet-container-th-column', trContainer);
		this._table = L.DomUtil.create('table', 'spreadsheet-table-column', thColumns);
		this._columns = L.DomUtil.create('tr', '', this._table);

		this._position = 0;
		this._totalWidth = 0;
		this._viewPort = 0;

		// dummy initial header
		var dummy = L.DomUtil.create('th', 'spreadsheet-table-column-cell', this._columns);
		L.DomUtil.create('div', 'spreadsheet-table-column-cell-text', dummy);
	},

	clearColumns : function () {
		L.DomUtil.remove(this._columns);
		this._columns = L.DomUtil.create('tr', '', this._table);
	},

	setViewPort: function(e) {
		this._viewPort = e.columns.viewPort;
		this._totalWidth = e.columns.totalWidth;
	},

	setScrollPosition: function (e) {
		var position = -e.x;
		this._position = Math.min(0, position);
		L.DomUtil.setStyle(this._table, 'left', this._position + 'px');
	},

	offsetScrollPosition: function (e) {
		var offset = e.x;
		this._position = Math.min(0,
					  Math.max(this._position - offset,
						   -(this._totalWidth - this._viewPort)));
		L.DomUtil.setStyle(this._table, 'left', this._position + 'px');
	},

	viewRowColumnHeaders: function (e) {
		if (e.isZoomed) {
			this.updateColumns(e.data.columns, e.converter, e.context);
		}
		else {
			this.fillColumns(e.data.columns, e.converter, e.context);
		}
	},

	fillColumns: function (columns, converter, context) {
		var iterator, twip, width, column, text;

		this.clearColumns();
		for (iterator = 0; iterator < columns.length; iterator++) {
			width = columns[iterator].size - (iterator > 0 ? columns[iterator - 1].size : 0);
			twip = new L.Point(width, width);
			column = L.DomUtil.create('th', 'spreadsheet-table-column-cell', this._columns);
			text = L.DomUtil.create('div', 'spreadsheet-table-column-cell-text', column);
			text.innerHTML = columns[iterator].text;
			column.width = Math.round(converter.call(context, twip).x) - 1 + 'px';
		}
	},

	updateColumns: function (columns, converter, context) {
		var iterator, twip, width, column;

		for (iterator = 0; iterator < this._columns.childNodes.length; iterator++) {
			column = this._columns.childNodes[iterator];
			width = columns[iterator].size - (iterator > 0 ? columns[iterator - 1].size : 0);
			twip = new L.Point(width, width);
			column.width = Math.round(converter.call(context, twip).x) - 1 + 'px';
		}
	},

	_onUpdatePermission: function () {
		if (this._map.getDocType() === 'spreadsheet' && !this._initialized) {
			this._initialize();
		}
	}
});

L.control.columnHeader = function (options) {
	return new L.Control.ColumnHeader(options);
};
