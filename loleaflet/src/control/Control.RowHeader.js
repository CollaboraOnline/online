/*
 * L.Control.RowHeader
*/

/* global $ _ */
L.Control.RowHeader = L.Control.extend({
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
		var headersContainer = L.DomUtil.create('div', 'spreadsheet-header-rows-container', docContainer.parentElement);
		this._rows = L.DomUtil.create('div', 'spreadsheet-header-rows', headersContainer);

		this._position = 0;
		this._totalHeight = 0;
		this._viewPort = 0;

		var rowHeaderObj = this;
		$.contextMenu({
			selector: '.spreadsheet-header-row',
			items: {
				'insertrowabove': {
					name: _('Insert row above'),
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.insertRow.call(rowHeaderObj, row);
					}
				},
				'deleteselectedrow': {
					name: _('Delete row'),
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.deleteRow.call(rowHeaderObj, row);
					}
				}
			},
			zIndex: 10
		});
	},

	insertRow: function(row) {
		// First select the corresponding row because
		// .uno:InsertRows doesn't accept any row number
		// as argument and just inserts before the selected row
		this._selectRow(row, 0);
		this._map.sendUnoCommand('.uno:InsertRows');
	},

	deleteRow: function(row) {
		this._selectRow(row, 0);
		this._map.sendUnoCommand('.uno:DeleteRows');
	},

	clearRows: function () {
		while (this._rows.firstChild) {
			this._rows.removeChild(this._rows.firstChild);
		}
	},

	setViewPort: function(e) {
		this._viewPort = e.rows.viewPort;
		this._totalHeight = e.rows.totalHeight;
	},

	setScrollPosition: function (e) {
		var position = -e.y;
		this._position = Math.min(0, position);
		L.DomUtil.setStyle(this._rows, 'top', this._position + 'px');
	},

	offsetScrollPosition: function (e) {
		var offset = e.y;
		this._position = Math.min(0,
		Math.max(this._position - offset,
			-(this._totalHeight - this._viewPort)));
		L.DomUtil.setStyle(this._rows, 'top', this._position + 'px');
	},

	viewRowColumnHeaders: function (e) {
		this.fillRows(e.data.rows, e.converter, e.context);
	},

	fillRows: function (rows, converter, context) {
		var iterator, twip, height, text;

		this.clearRows();
		for (iterator = 0; iterator < rows.length; iterator++) {
			height = rows[iterator].size - (iterator > 0 ? rows[iterator - 1].size : 0);
			twip = new L.Point(height, height);
			text = L.DomUtil.create('div', 'spreadsheet-header-row', this._rows);
			var content = rows[iterator].text;
			text.setAttribute('rel', 'spreadsheet-row-' + content); // for easy addressing
			text.innerHTML = content;
			height = Math.round(converter.call(context, twip).y) - 1 + 'px';
			if (height === '-1px') {
				L.DomUtil.setStyle(text, 'display', 'none');
			} else {
				L.DomUtil.setStyle(text, 'line-height', height);
				L.DomUtil.setStyle(text, 'height', height);
			}

			L.DomEvent.addListener(text, 'click', this._onRowHeaderClick, this);
		}
	},

	_selectRow: function(row, modifier) {
		var command = {
			Row: {
				type: 'long',
				value: parseInt(row - 1)
			},
			Modifier: {
				type: 'unsigned short',
				value: modifier
			}
		};

		this._map.sendUnoCommand('.uno:SelectRow ', command);
	},

	_onRowHeaderClick: function (e) {
		var row = e.target.getAttribute('rel').split('spreadsheet-row-')[1];
		var modifier = 0;
		if (e.shiftKey) {
			modifier += this._map.keyboard.keyModifier.shift;
		}
		if (e.ctrlKey) {
			modifier += this._map.keyboard.keyModifier.ctrl;
		}

		this._selectRow(row, modifier);
	},

	_onUpdatePermission: function () {
		if (this._map.getDocType() === 'spreadsheet' && !this._initialized) {
			this._initialize();
		}
	}
});

L.control.rowHeader = function (options) {
	return new L.Control.RowHeader(options);
};
