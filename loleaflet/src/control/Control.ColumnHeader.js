/*
* Control.ColumnHeader
*/

L.Control.ColumnHeader = L.Control.extend({
	onAdd: function (map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
	},

	_initialize: function () {
		this._initialized = true;
		this._map.on('scrolloffset', this.offsetScrollPosition, this);
		this._map.on('updatescrolloffset', this.setScrollPosition, this);
		this._map.on('updateviewport', this.setViewPort, this);
		this._map.on('viewrowcolumnheaders', this.viewRowColumnHeaders, this);
		var docContainer = this._map.options.documentContainer;
		L.DomUtil.create('div', 'spreadsheet-corner', docContainer.parentElement);
		var headersContainer = L.DomUtil.create('div', 'spreadsheet-columns-container', docContainer.parentElement);
		this._columns = L.DomUtil.create('div', 'spreadsheet-columns', headersContainer);

		this._position = 0;
		this._totalWidth = 0;
		this._viewPort = 0;
	},

	clearColumns : function () {
		while (this._columns.firstChild) {
			this._columns.removeChild(this._columns.firstChild);
		}
	},

	setViewPort: function(e) {
		this._viewPort = e.columns.viewPort;
		this._totalWidth = e.columns.totalWidth;
	},

	setScrollPosition: function (e) {
		var position = -e.x;
		this._position = Math.min(0, position);
		L.DomUtil.setStyle(this._columns, 'left', this._position + 'px');
	},

	offsetScrollPosition: function (e) {
		var offset = e.x;
		this._position = Math.min(0,
					  Math.max(this._position - offset,
						   -(this._totalWidth - this._viewPort)));
		L.DomUtil.setStyle(this._columns, 'left', this._position + 'px');
	},

	viewRowColumnHeaders: function (e) {
		this.fillColumns(e.data.columns, e.converter, e.context);
	},

	fillColumns: function (columns, converter, context) {
		var iterator, twip, width, text;

		this.clearColumns();
		for (iterator = 0; iterator < columns.length; iterator++) {
			width = columns[iterator].size - (iterator > 0 ? columns[iterator - 1].size : 0);
			twip = new L.Point(width, width);
			text = L.DomUtil.create('div', 'spreadsheet-column', this._columns);
			text.innerHTML = columns[iterator].text;
			width = Math.round(converter.call(context, twip).x) - 1 + 'px';
			L.DomUtil.setStyle(text, 'width', width);
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
