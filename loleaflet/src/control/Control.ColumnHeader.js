/*
* Control.ColumnHeader
*/

/* global $ */
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
		var cornerHeader = L.DomUtil.create('div', 'spreadsheet-header-corner', docContainer.parentElement);
		L.DomEvent.addListener(cornerHeader, 'click', this._onCornerHeaderClick, this);
		var headersContainer = L.DomUtil.create('div', 'spreadsheet-header-columns-container', docContainer.parentElement);
		this._columns = L.DomUtil.create('div', 'spreadsheet-header-columns', headersContainer);

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
			text = L.DomUtil.create('div', 'spreadsheet-header-column', this._columns);
			var content = columns[iterator].text;
			text.setAttribute('rel', 'spreadsheet-column-' + content); // for easy addressing
			text.innerHTML = content;
			width = Math.round(converter.call(context, twip).x) - 1 + 'px';
			if (width === '-1px') {
				L.DomUtil.setStyle(text, 'display', 'none');
			}
			else {
				L.DomUtil.setStyle(text, 'width', width);
			}

			L.DomEvent.addListener(text, 'click', this._onColumnHeaderClick, this);
		}
	},

	_colAlphaToNumber: function(alpha) {
		var res = 0;
		var offset = 'A'.charCodeAt();
		for (var i = 0; i < alpha.length; i++) {
			var chr = alpha[alpha.length - i - 1];
			res += (chr.charCodeAt() - offset + 1) * Math.pow(26, i);
		}

		return res;
	},

	_onColumnHeaderClick: function (e) {
		var colAlpha = e.target.getAttribute('rel').split('spreadsheet-column-')[1];
		var colNumber = this._colAlphaToNumber(colAlpha);

		var modifier = 0;
		if (e.shiftKey) {
			modifier += this._map.keyboard.keyModifier.shift;
		}
		if (e.ctrlKey) {
			modifier += this._map.keyboard.keyModifier.ctrl;
		}

		var command = {
			Col: {
				type: 'unsigned short',
				value: parseInt(colNumber - 1)
			},
			Modifier: {
				type: 'unsigned short',
				value: modifier
			}
		};

		this._map.sendUnoCommand('.uno:SelectColumn ', command);
	},

	_onCornerHeaderClick: function() {
		this._map.sendUnoCommand('.uno:SelectAll');
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
