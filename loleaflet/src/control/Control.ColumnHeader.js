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
		L.DomEvent.on(cornerHeader, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.addListener(cornerHeader, 'click', this._onCornerHeaderClick, this);
		this._headersContainer = L.DomUtil.create('div', 'spreadsheet-header-columns-container', rowColumnFrame);

		this._headerCanvas = L.DomUtil.create('canvas', 'spreadsheet-header-columns', this._headersContainer);
		this._canvasContext = this._headerCanvas.getContext('2d');
		this._headerCanvas.width = parseInt(L.DomUtil.getStyle(this._headersContainer, 'width'));
		this._headerCanvas.height = parseInt(L.DomUtil.getStyle(this._headersContainer, 'height'));

		L.DomUtil.setStyle(this._headerCanvas, 'cursor', this._cursor);

		L.DomEvent.on(this._headerCanvas, 'mousemove', this._onCanvasMouseMove, this);
		L.DomEvent.on(this._headerCanvas, 'mouseout', this._onMouseOut, this);
		L.DomEvent.on(this._headerCanvas, 'click', this._onHeaderClick, this);

		this._leftmostColumn = 0;
		this._leftOffset = 0;
		this._position = 0;

		var colHeaderObj = this;
		$.contextMenu({
			selector: '.spreadsheet-header-columns',
			className: 'loleaflet-font',
			items: {
				'insertcolbefore': {
					name: _('Insert column before'),
					callback: function(key, options) {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							var colAlpha = colHeaderObj._data[index].text;
							colHeaderObj.insertColumn.call(colHeaderObj, colAlpha);
						}
					}
				},
				'deleteselectedcol': {
					name: _('Delete column'),
					callback: function(key, options) {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							var colAlpha = colHeaderObj._data[index].text;
							colHeaderObj.deleteColumn.call(colHeaderObj, colAlpha);
						}
					}
				},
				'optimalwidth': {
					name: _('Optimal Width') + '...',
					callback: function(key, options) {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							var colAlpha = colHeaderObj._data[index].text;
							colHeaderObj.optimalWidth.call(colHeaderObj, colAlpha);
						}
					}
				},
				'hideColumn': {
					name: _('Hide Columns'),
					callback: function(key, options) {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							var colAlpha = colHeaderObj._data[index].text;
							colHeaderObj.hideColumn.call(colHeaderObj, colAlpha);
						}
					}
				},
				'showColumn': {
					name: _('Show Columns'),
					callback: function(key, options) {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							var colAlpha = colHeaderObj._data[index].text;
							colHeaderObj.showColumn.call(colHeaderObj, colAlpha);
						}
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
		this.clearSelection(this._data);
	},

	_onUpdateSelection: function (e) {
		var data = this._data;
		if (!data)
			return;
		var start = e.start.x;
		var end = e.end.x;
		var twips;
		if (start !== -1) {
			twips = new L.Point(start, start);
			start = Math.round(data.converter.call(data.context, twips).x);
		}
		if (end !== -1) {
			twips = new L.Point(end, end);
			end = Math.round(data.converter.call(data.context, twips).x);
		}
		this.updateSelection(data, start, end);
	},

	_onUpdateCurrentColumn: function (e) {
		var data = this._data;
		if (!data)
			return;
		var x = e.x;
		if (x !== -1) {
			var twips = new L.Point(x, x);
			x = Math.round(data.converter.call(data.context, twips).x);
		}
		this.updateCurrent(data, x);
	},

	_updateColumnHeader: function () {
		this._map.fire('updaterowcolumnheaders', {x: this._map._getTopLeftPoint().x, y: 0, offset: {x: undefined, y: 0}});
	},

	drawHeaderEntry: function (index, isOver) {
		if (!index || index <= 0 || index >= this._data.length)
			return;

		var ctx = this._canvasContext;
		var content = this._data[index].text;
		var start = this._data[index - 1].pos - this._leftOffset;
		var end = this._data[index].pos - this._leftOffset;
		var width = end - start;
		var height = this._headerCanvas.height;
		var isHighlighted = this._data[index].selected;

		if (width <= 0)
			return;

		ctx.save();
		ctx.translate(this._position + this._leftOffset, 0);
		// background gradient
		var selectionBackgroundGradient = null;
		if (isHighlighted) {
			selectionBackgroundGradient = ctx.createLinearGradient(start, 0, start, height);
			selectionBackgroundGradient.addColorStop(0, this._selectionBackgroundGradient[0]);
			selectionBackgroundGradient.addColorStop(0.5, this._selectionBackgroundGradient[1]);
			selectionBackgroundGradient.addColorStop(1, this._selectionBackgroundGradient[2]);
		}
		// clip mask
		ctx.beginPath();
		ctx.rect(start, 0, width, height);
		ctx.clip();
		// draw background
		ctx.fillStyle = isHighlighted ? selectionBackgroundGradient : isOver ? this._hoverColor : this._backgroundColor;
		ctx.fillRect(start, 0, width, height);
		// draw text content
		ctx.fillStyle = isHighlighted ? this._selectionTextColor : this._textColor;
		ctx.font = this._font;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(content, end - width / 2, height / 2);
		// draw row separator
		ctx.fillStyle = this._borderColor;
		ctx.fillRect(end -1, 0, 1, height);
		ctx.restore();
	},

	getHeaderEntryBoundingClientRect: function (index) {
		if (!index)
			index = this._mouseOverIndex; // use last mouse over position

		if (!index || !this._data[index])
			return;

		var rect = this._headerCanvas.getBoundingClientRect();

		var colStart = this._data[index - 1].pos + this._position;
		var colEnd = this._data[index].pos + this._position;

		var left = rect.left + colStart;
		var right = rect.left + colEnd;
		var top = rect.top;
		var bottom = rect.bottom;
		return { left: left, right: right, top: top, bottom: bottom };
	},

	viewRowColumnHeaders: function (e) {
		if (e.data.columns && e.data.columns.length > 0) {
			this.fillColumns(e.data.columns, e.converter, e.context);
		}
	},

	fillColumns: function (columns, converter, context) {
		var iterator, twip, width;

		this._data = new Array(columns.length);
		this._data.converter = converter;
		this._data.context = context;

		var canvas = this._headerCanvas;
		canvas.width = parseInt(L.DomUtil.getStyle(this._headersContainer, 'width'));
		canvas.height = parseInt(L.DomUtil.getStyle(this._headersContainer, 'height'));

		this._canvasContext.clearRect(0, 0, canvas.width, canvas.height);

		var leftmostOffset = new L.Point(columns[0].size, columns[0].size);
		this._leftmostColumn = parseInt(columns[0].text);
		this._leftOffset = Math.round(converter.call(context, leftmostOffset).x);

		this._data[0] = { pos: this._leftOffset, text: '', selected: false };

		for (iterator = 1; iterator < columns.length; iterator++) {
			twip = new L.Point(columns[iterator].size, columns[iterator].size);
			this._data[iterator] = { pos: Math.round(converter.call(context, twip).x), text: columns[iterator].text, selected: false };
			width = this._data[iterator].pos - this._data[iterator - 1].pos;
			if (width > 0) {
				this.drawHeaderEntry(iterator, false);
			}
		}

		this.mouseInit(canvas);

		L.DomEvent.on(canvas, 'contextmenu', L.DomEvent.preventDefault);
		if ($('.spreadsheet-header-columns').length > 0) {
			$('.spreadsheet-header-columns').contextMenu(this._map._permission === 'edit');
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

	_onHeaderClick: function (e) {
		if (!this._mouseOverIndex)
			return;

		var colAlpha = this._data[this._mouseOverIndex].text;

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

		if (this._mouseOverIndex) {
			var clickedColumn = this._data[this._mouseOverIndex];
			var width = clickedColumn.pos - this._data[this._mouseOverIndex - 1];
			var column = this._mouseOverIndex + this._leftmostColumn;

			if (this._data[this._mouseOverIndex + 1]
				&& this._data[this._mouseOverIndex + 1].pos === clickedColumn.pos) {
				column += 1;
			}

			if (width !== distance.x) {
				var command = {
					ColumnWidth: {
						type: 'unsigned short',
						value: this._map._docLayer.twipsToHMM(Math.max(distance.x, 0))
					},
					Column: {
						type: 'unsigned short',
						value: column
					}
				};

				this._map.sendUnoCommand('.uno:ColumnWidth', command);
				this._updateColumnHeader();
			}
		}

		this._map.removeLayer(this._vertLine);
	},

	onDragClick: function (item, clicks, e) {
		this._map.removeLayer(this._vertLine);

		if (!this._mouseOverIndex)
			return;

		if (clicks === 2) {
			var column = this._mouseOverIndex + this._leftmostColumn;
			var command = {
				Col: {
					type: 'unsigned short',
					value: column - 1
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
		if ($('.spreadsheet-header-columns').length > 0) {
			$('.spreadsheet-header-columns').contextMenu(e.perm === 'edit');
		}
	},

	_getPos: function (point) {
		return point.x;
	}
});

L.control.columnHeader = function (options) {
	return new L.Control.ColumnHeader(options);
};
