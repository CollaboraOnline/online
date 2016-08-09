/*
 * L.Control.RowHeader
*/

/* global $ _ */
L.Control.RowHeader = L.Control.Header.extend({
	options: {
		cursor: 'row-resize'
	},

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
			className: 'loleaflet-font',
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
		var iterator, twip, height, row, text, resize;

		this.clearRows();
		for (iterator = 0; iterator < rows.length; iterator++) {
			height = rows[iterator].size - (iterator > 0 ? rows[iterator - 1].size : 0);
			twip = new L.Point(height, height);
			row = L.DomUtil.create('div', 'spreadsheet-header-row', this._rows);
			text = L.DomUtil.create('div', 'spreadsheet-header-row-text', row);
			resize = L.DomUtil.create('div', 'spreadsheet-header-row-resize', row);
			resize.row = iterator + 1;
			resize.height = height;
			var content = rows[iterator].text;
			text.setAttribute('rel', 'spreadsheet-row-' + content); // for easy addressing
			text.innerHTML = content;
			height = Math.round(converter.call(context, twip).y) - 1;
			if (height === -1) {
				L.DomUtil.setStyle(text, 'display', 'none');
			} else {
				L.DomUtil.setStyle(row, 'height', height + 'px');
				L.DomUtil.setStyle(text, 'line-height', height + 'px');
				L.DomUtil.setStyle(text, 'height', height - 3 + 'px');
				L.DomUtil.setStyle(resize, 'height', '3px');
			}

			L.DomEvent.addListener(text, 'click', this._onRowHeaderClick, this);
			this.mouseInit(resize);
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

	_getHorzLatLng: function (e) {
		var drag = this._map.mouseEventToContainerPoint(e);
		return [
			this._map.containerPointToLatLng(new L.Point(0, drag.y)),
			this._map.containerPointToLatLng(new L.Point(this._map.getSize().x, drag.y))
		];
	},

	onDragStart: function (item, start, e) {
		if (!this._horzLine) {
			this._horzLine = L.polyline(this._getHorzLatLng(e), {color: 'darkblue', weight: 1});
		}
		else {
			this._horzLine.setLatLngs(this._getHorzLatLng(e));
		}

		this._map.addLayer(this._horzLine);
	},

	onDragMove: function (item, start, e) {
		if (this._horzLine) {
			this._horzLine.setLatLngs(this._getHorzLatLng(e));
		}
	},

	onDragEnd: function (item, start, e) {
		var end = new L.Point(e.clientX, e.clientY);
		var distance = this._map._docLayer._pixelsToTwips(end.subtract(start));

		if (distance.y > 0 && item.height != distance.y) {
			var command = {
				Row: {
					type: 'unsigned short',
					value: item.row
				},
				Height: {
					type: 'unsigned short',
					value: distance.y
				}
			};

			this._map.sendUnoCommand('.uno:RowHeight', command);
		}

		this._map.removeLayer(this._horzLine);
	},

	_onUpdatePermission: function (e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		setTimeout(function() {
			$('.spreadsheet-header-row').contextMenu(e.perm === 'edit');
		}, 1000);
	}
});

L.control.rowHeader = function (options) {
	return new L.Control.RowHeader(options);
};
