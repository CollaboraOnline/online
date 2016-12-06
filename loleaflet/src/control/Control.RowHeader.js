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
		this._map.on('updateselectionheader', this._onUpdateSelection, this);
		this._map.on('clearselectionheader', this._onClearSelection, this);
		this._map.on('updatecurrentheader', this._onUpdateCurrentRow, this);
		var docContainer = this._map.options.documentContainer;
		var headersContainer = L.DomUtil.create('div', 'spreadsheet-header-rows-container', docContainer.parentElement);
		this._rows = L.DomUtil.create('div', 'spreadsheet-header-rows', headersContainer);

		this._position = 0;
		this._totalHeight = 0;
		this._viewPort = 0;

		var rowHeaderObj = this;
		$.contextMenu({
			selector: '.spreadsheet-header-row-text',
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
				},
				'optimalheight': {
					name: _('Optimal Height') + '...',
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.optimalHeight.call(rowHeaderObj, row);
					}
				},
				'hideRow': {
					name: _('Hide Rows'),
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.hideRow.call(rowHeaderObj, row);
					}
				},
				'showRow': {
					name: _('Show Rows'),
					callback: function(key, options) {
						var row = parseInt(options.$trigger.attr('rel').split('spreadsheet-row-')[1]);
						rowHeaderObj.showRow.call(rowHeaderObj, row);
					}
				}
			},
			zIndex: 10
		});
	},

	optimalHeight: function(row) {
		if (!this._dialog) {
			this._dialog = L.control.metricInput(this._onDialogResult, this, 0, {title: _('Optimal Row Height')});
		}
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(row, 0);
		}
		this._dialog.addTo(this._map);
		this._map.enable(false);
		this._dialog.show();
	},

	insertRow: function(row) {
		// First select the corresponding row because
		// .uno:InsertRows doesn't accept any row number
		// as argument and just inserts before the selected row
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(row, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRows');
	},

	deleteRow: function(row) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(row, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteRows');
	},

	hideRow: function(row) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(row, 0);
		}
		this._map.sendUnoCommand('.uno:HideRow');
	},

	showRow: function(row) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(row, 0);
		}
		this._map.sendUnoCommand('.uno:ShowRow');
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

	_onClearSelection: function (e) {
		this.clearSelection(this._rows);
	},

	_onUpdateSelection: function (e) {
		this.updateSelection(this._rows, e.start.y, e.end.y);
	},

	_onUpdateCurrentRow: function (e) {
		this.updateCurrent(this._rows, e.y);
	},

	viewRowColumnHeaders: function (e) {
		this.fillRows(e.data.rows, e.converter, e.context);
	},

	fillRows: function (rows, converter, context) {
		var iterator, twip, height, row, text, resize;

		L.DomUtil.empty(this._rows);
		for (iterator = 0; iterator < rows.length; iterator++) {
			height = rows[iterator].size - (iterator > 0 ? rows[iterator - 1].size : 0);
			twip = new L.Point(height, height);
			row = L.DomUtil.create('div', 'spreadsheet-header-row', this._rows);
			text = L.DomUtil.create('div', 'spreadsheet-header-row-text', row);
			resize = L.DomUtil.create('div', 'spreadsheet-header-row-resize', row);
			row.size = rows[iterator].size;
			var content = rows[iterator].text;
			text.setAttribute('rel', 'spreadsheet-row-' + content); // for easy addressing
			text.innerHTML = content;
			height = Math.round(converter.call(context, twip).y) - 1;
			if (height <= 0) {
				L.DomUtil.setStyle(row, 'display', 'none');
			} else if (height < 10) {
				text.row = iterator + 1;
				text.height = height;
				L.DomUtil.setStyle(row, 'height', height + 'px');
				L.DomUtil.setStyle(row, 'cursor', 'row-resize');
				L.DomUtil.setStyle(text, 'line-height', height + 'px');
				L.DomUtil.setStyle(text, 'cursor', 'row-resize');
				L.DomUtil.setStyle(resize, 'display', 'none');
				this.mouseInit(text);
			} else {
				resize.row = iterator + 1;
				resize.height = height;
				L.DomUtil.setStyle(row, 'height', height + 'px');
				L.DomUtil.setStyle(text, 'line-height', height - 3 + 'px');
				L.DomUtil.setStyle(text, 'height', height - 3 + 'px');
				L.DomUtil.setStyle(resize, 'height', '3px');
				this.mouseInit(resize);
			}
			L.DomEvent.addListener(text, 'click', this._onRowHeaderClick, this);
		}

		if ($('.spreadsheet-header-row-text').length > 0) {
			$('.spreadsheet-header-row-text').contextMenu(this._map._permission === 'edit');
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

	_onDialogResult: function (e) {
		if (e.type === 'submit' && !isNaN(e.value)) {
			var extra = {
				aExtraHeight: {
					type: 'unsigned short',
					value: e.value
				}
			};

			this._map.sendUnoCommand('.uno:SetOptimalRowHeight', extra);
		}

		this._map.enable(true);
	},

	_getHorzLatLng: function (start, offset, e) {
		var limit = this._map.mouseEventToContainerPoint({clientX: start.x, clientY: start.y});
		var drag = this._map.mouseEventToContainerPoint(e);
		return [
			this._map.containerPointToLatLng(new L.Point(0, Math.max(limit.y, drag.y + offset.y))),
			this._map.containerPointToLatLng(new L.Point(this._map.getSize().x, Math.max(limit.y, drag.y + offset.y)))
		];
	},

	onDragStart: function (item, start, offset, e) {
		if (!this._horzLine) {
			this._horzLine = L.polyline(this._getHorzLatLng(start, offset, e), {color: 'darkblue', weight: 1});
		}
		else {
			this._horzLine.setLatLngs(this._getHorzLatLng(start, offset, e));
		}

		this._map.addLayer(this._horzLine);
	},

	onDragMove: function (item, start, offset, e) {
		if (this._horzLine) {
			this._horzLine.setLatLngs(this._getHorzLatLng(start, offset, e));
		}
	},

	onDragEnd: function (item, start, offset, e) {
		var end = new L.Point(e.clientX, e.clientY + offset.y);
		var distance = this._map._docLayer._pixelsToTwips(end.subtract(start));

		if (item.height != distance.y) {
			var command = {
				Row: {
					type: 'unsigned short',
					value: item.parentNode && item.parentNode.nextSibling &&
					       L.DomUtil.getStyle(item.parentNode.nextSibling, 'display') === 'none' ? item.row + 1 : item.row
				},
				Height: {
					type: 'unsigned short',
					value: Math.max(distance.y, 0)
				}
			};

			this._map.sendUnoCommand('.uno:RowHeight', command);
		}

		this._map.removeLayer(this._horzLine);
	},

	onDragClick: function (item, clicks, e) {
		this._map.removeLayer(this._horzLine);

		if (clicks === 2) {
			var command = {
				Row: {
					type: 'long',
					value: item.row - 1
				},
				Modifier: {
					type: 'unsigned short',
					value: 0
				}
			};

			var extra = {
				aExtraHeight: {
					type: 'unsigned short',
					value: 0
				}
			};

			this._map.sendUnoCommand('.uno:SelectRow', command);
			this._map.sendUnoCommand('.uno:SetOptimalRowHeight', extra);
		}
	},

	_onUpdatePermission: function (e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		// Enable context menu on row headers only if permission is 'edit'
		if ($('.spreadsheet-header-row-text').length > 0) {
			$('.spreadsheet-header-row-text').contextMenu(e.perm === 'edit');
		}
	}
});

L.control.rowHeader = function (options) {
	return new L.Control.RowHeader(options);
};
