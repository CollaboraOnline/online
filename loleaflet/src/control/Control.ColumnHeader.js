/*
* Control.ColumnHeader
*/

/* global $ _ */
L.Control.ColumnHeader = L.Control.Header.extend({
	options: {
		cursor: 'col-resize'
	},

	onAdd: function (map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
	},

	_initialize: function () {
		this._initialized = true;
		this._map.on('scrolloffset', this.offsetScrollPosition, this);
		this._map.on('updatescrolloffset', this.setScrollPosition, this);
		this._map.on('viewrowcolumnheaders', this.viewRowColumnHeaders, this);
		this._map.on('updateselectionheader', this._onUpdateSelection, this);
		this._map.on('clearselectionheader', this._onClearSelection, this);
		this._map.on('updatecurrentheader', this._onUpdateCurrentColumn, this);
		var rowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
		var cornerHeader = L.DomUtil.create('div', 'spreadsheet-header-corner', rowColumnFrame);
		L.DomEvent.addListener(cornerHeader, 'click', this._onCornerHeaderClick, this);
		var headersContainer = L.DomUtil.create('div', 'spreadsheet-header-columns-container', rowColumnFrame);
		this._columns = L.DomUtil.create('div', 'spreadsheet-header-columns', headersContainer);

		this._leftOffset = 0;
		this._position = 0;

		var colHeaderObj = this;
		$.contextMenu({
			selector: '.spreadsheet-header-column-text',
			className: 'loleaflet-font',
			items: {
				'insertcolbefore': {
					name: _('Insert column before'),
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.insertColumn.call(colHeaderObj, colAlpha);
					}
				},
				'deleteselectedcol': {
					name: _('Delete column'),
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.deleteColumn.call(colHeaderObj, colAlpha);
					}
				},
				'optimalwidth': {
					name: _('Optimal Width') + '...',
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.optimalWidth.call(colHeaderObj, colAlpha);
					}
				},
				'hideColumn': {
					name: _('Hide Columns'),
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.hideColumn.call(colHeaderObj, colAlpha);
					}
				},
				'showColumn': {
					name: _('Show Columns'),
					callback: function(key, options) {
						var colAlpha = options.$trigger.attr('rel').split('spreadsheet-column-')[1];
						colHeaderObj.showColumn.call(colHeaderObj, colAlpha);
					}
				}
			},
			zIndex: 10
		});
	},

	optimalWidth: function(colAlpha) {
		if (!this._dialog) {
			this._dialog = L.control.metricInput(this._onDialogResult, this,
							     this._map._docLayer.twipsToHMM(this._map._docLayer.STD_EXTRA_WIDTH),
							     {title: _('Optimal Column Width')});
		}
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._dialog.addTo(this._map);
		this._map.enable(false);
		this._dialog.show();
	},

	insertColumn: function(colAlpha) {
		// First select the corresponding column because
		// .uno:InsertColumn doesn't accept any column number
		// as argument and just inserts before the selected column
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._map.sendUnoCommand('.uno:InsertColumns');
		this._updateColumnHeader();
	},

	deleteColumn: function(colAlpha) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteColumns');
		this._updateColumnHeader();
	},

	hideColumn: function(colAlpha) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._map.sendUnoCommand('.uno:HideColumn');
		this._updateColumnHeader();
	},

	showColumn: function(colAlpha) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(colAlpha, 0);
		}
		this._map.sendUnoCommand('.uno:ShowColumn');
		this._updateColumnHeader();
	},

	setScrollPosition: function (e) {
		var position = -e.x;
		this._position = Math.min(0, position);
	},

	offsetScrollPosition: function (e) {
		var offset = e.x;
		this._position = Math.min(0, this._position- offset);
	},

	_onClearSelection: function (e) {
		this.clearSelection(this._columns);
	},

	_onUpdateSelection: function (e) {
		this.updateSelection(this._columns, e.start.x, e.end.x);
	},

	_onUpdateCurrentColumn: function (e) {
		this.updateCurrent(this._columns, e.x);
	},

	_updateColumnHeader: function () {
		this._map.fire('updaterowcolumnheaders', {x: this._map._getTopLeftPoint().x, y: 0, offset: {x: undefined, y: 0}});
	},

	viewRowColumnHeaders: function (e) {
		if (e.data.columns && e.data.columns.length > 0) {
			this.fillColumns(e.data.columns, e.converter, e.context);
			L.DomUtil.setStyle(this._columns, 'left', (this._position + this._leftOffset) + 'px');
		}
	},

	fillColumns: function (columns, converter, context) {
		var iterator, twip, width, column, text, resize;

		L.DomUtil.empty(this._columns);
		var leftOffset = new L.Point(columns[0].size, columns[0].size);
		// column[0] is a dummy column header whose text attribute is set to the column index
		var leftmostCol = parseInt(columns[0].text);
		this._leftOffset = Math.round(converter.call(context, leftOffset).x);
		for (iterator = 1; iterator < columns.length; iterator++) {
			width = columns[iterator].size - columns[iterator - 1].size;
			twip = new L.Point(width, width);
			column = L.DomUtil.create('div', 'spreadsheet-header-column', this._columns);
			text = L.DomUtil.create('div', 'spreadsheet-header-column-text', column);
			resize = L.DomUtil.create('div', 'spreadsheet-header-column-resize', column);
			L.DomEvent.on(resize, 'contextmenu', L.DomEvent.preventDefault);
			column.size = columns[iterator].size;
			var content = columns[iterator].text;
			text.setAttribute('rel', 'spreadsheet-column-' + content); // for easy addressing
			text.innerHTML = content;
			width = Math.round(converter.call(context, twip).x) - 1;
			if (width <= 0) {
				L.DomUtil.setStyle(column, 'display', 'none');
			} else if (width < 10) {
				text.column = iterator + leftmostCol;
				text.width = width;
				L.DomUtil.setStyle(column, 'width', width + 'px');
				L.DomUtil.setStyle(column, 'cursor', 'col-resize');
				L.DomUtil.setStyle(text, 'cursor', 'col-resize');
				L.DomUtil.setStyle(resize, 'display', 'none');
				this.mouseInit(text);
			} else {
				resize.column = iterator + leftmostCol;
				resize.width = width;
				L.DomUtil.setStyle(column, 'width', width + 'px');
				L.DomUtil.setStyle(text, 'width', width - 3 + 'px');
				L.DomUtil.setStyle(resize, 'width', '3px');
				this.mouseInit(resize);
			}
			L.DomEvent.addListener(text, 'click', this._onColumnHeaderClick, this);
		}

		if ($('.spreadsheet-header-column-text').length > 0) {
			$('.spreadsheet-header-column-text').contextMenu(this._map._permission === 'edit');
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

	_selectColumn: function(colAlpha, modifier) {
		var colNumber = this._colAlphaToNumber(colAlpha);

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

	_onColumnHeaderClick: function (e) {
		var colAlpha = e.target.getAttribute('rel').split('spreadsheet-column-')[1];

		var modifier = 0;
		if (e.shiftKey) {
			modifier += this._map.keyboard.keyModifier.shift;
		}
		if (e.ctrlKey) {
			modifier += this._map.keyboard.keyModifier.ctrl;
		}

		this._selectColumn(colAlpha, modifier);
	},

	_onCornerHeaderClick: function() {
		this._map.sendUnoCommand('.uno:SelectAll');
	},

	_onDialogResult: function (e) {
		if (e.type === 'submit' && !isNaN(e.value)) {
			var extra = {
				aExtraWidth: {
					type: 'unsigned short',
					value: e.value
				}
			};

			this._map.sendUnoCommand('.uno:SetOptimalColumnWidth', extra);
		}

		this._map.enable(true);
	},

	_getVertLatLng: function (start, offset, e) {
		var limit = this._map.mouseEventToContainerPoint({clientX: start.x, clientY: start.y});
		var drag = this._map.mouseEventToContainerPoint(e);
		return [
			this._map.containerPointToLatLng(new L.Point(Math.max(limit.x, drag.x + offset.x), 0)),
			this._map.containerPointToLatLng(new L.Point(Math.max(limit.x, drag.x + offset.x), this._map.getSize().y))
		];
	},

	onDragStart: function (item, start, offset, e) {
		if (!this._vertLine) {
			this._vertLine = L.polyline(this._getVertLatLng(start, offset, e), {color: 'darkblue', weight: 1});
		}
		else {
			this._vertLine.setLatLngs(this._getVertLatLng(start, offset, e));
		}

		this._map.addLayer(this._vertLine);
	},

	onDragMove: function (item, start, offset, e) {
		if (this._vertLine) {
			this._vertLine.setLatLngs(this._getVertLatLng(start, offset, e));
		}
	},

	onDragEnd: function (item, start, offset, e) {
		var end = new L.Point(e.clientX + offset.x, e.clientY);
		var distance = this._map._docLayer._pixelsToTwips(end.subtract(start));

		if (item.width != distance.x) {
			var command = {
				Column: {
					type: 'unsigned short',
					value: item.parentNode && item.parentNode.nextSibling &&
					       L.DomUtil.getStyle(item.parentNode.nextSibling, 'display') === 'none' ? item.column + 1 : item.column
				},
				Width: {
					type: 'unsigned short',
					value: Math.max(distance.x, 0)
				}
			};

			this._map.sendUnoCommand('.uno:ColumnWidth', command);
			this._updateColumnHeader();
		}

		this._map.removeLayer(this._vertLine);
	},

	onDragClick: function (item, clicks, e) {
		this._map.removeLayer(this._vertLine);

		if (clicks === 2) {
			var command = {
				Col: {
					type: 'unsigned short',
					value: item.column - 1
				},
				Modifier: {
					type: 'unsigned short',
					value: 0
				}
			};

			this._map.sendUnoCommand('.uno:SelectColumn ', command);
			this._map.sendUnoCommand('.uno:SetOptimalColumnWidthDirect');
		}
	},

	_onUpdatePermission: function (e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		if ($('.spreadsheet-header-column-text').length > 0) {
			$('.spreadsheet-header-column-text').contextMenu(e.perm === 'edit');
		}
	}
});

L.control.columnHeader = function (options) {
	return new L.Control.ColumnHeader(options);
};
