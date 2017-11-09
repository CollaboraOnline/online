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
		this._map.on('viewrowcolumnheaders', this.viewRowColumnHeaders, this);
		this._map.on('updateselectionheader', this._onUpdateSelection, this);
		this._map.on('clearselectionheader', this._onClearSelection, this);
		this._map.on('updatecurrentheader', this._onUpdateCurrentRow, this);
		var rowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
		this._headersContainer = L.DomUtil.create('div', 'spreadsheet-header-rows-container', rowColumnFrame);

		this._headerCanvas = L.DomUtil.create('canvas', 'spreadsheet-header-rows', this._headersContainer);

		this._initHeaderEntryStyles('spreadsheet-header-row');
		this._initHeaderEntryHoverStyles('spreadsheet-header-row-hover');
		this._initHeaderEntrySelectedStyles('spreadsheet-header-row-selected');
		this._initHeaderEntryResizeStyles('spreadsheet-header-row-resize');

		this._canvasContext = this._headerCanvas.getContext('2d');
		this._headerCanvas.width = parseInt(L.DomUtil.getStyle(this._headersContainer, 'width'));
		this._headerCanvas.height = parseInt(L.DomUtil.getStyle(this._headersContainer, 'height'));

		L.DomUtil.setStyle(this._headerCanvas, 'cursor', this._cursor);

		L.DomEvent.on(this._headerCanvas, 'mousemove', this._onCanvasMouseMove, this);
		L.DomEvent.on(this._headerCanvas, 'mouseout', this._onMouseOut, this);
		L.DomEvent.on(this._headerCanvas, 'click', this._onHeaderClick, this);

		this._topRow = 0;
		this._topOffset = 0;
		this._position = 0;

		var rowHeaderObj = this;
		$.contextMenu({
			selector: '.spreadsheet-header-rows',
			className: 'loleaflet-font',
			items: {
				'insertrowabove': {
					name: _('Insert row above'),
					callback: function(key, options) {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.insertRow.call(rowHeaderObj, index);
						}
					}
				},
				'deleteselectedrow': {
					name: _('Delete row'),
					callback: function(key, options) {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.deleteRow.call(rowHeaderObj, index);
						}
					}
				},
				'optimalheight': {
					name: _('Optimal Height') + '...',
					callback: function(key, options) {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.optimalHeight.call(rowHeaderObj, index);
						}
					}
				},
				'hideRow': {
					name: _('Hide Rows'),
					callback: function(key, options) {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.hideRow.call(rowHeaderObj, index);
						}
					}
				},
				'showRow': {
					name: _('Show Rows'),
					callback: function(key, options) {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.showRow.call(rowHeaderObj, index);
						}
					}
				}
			},
			zIndex: 10
		});
	},

	optimalHeight: function(index) {
		if (!this._dialog) {
			this._dialog = L.control.metricInput(this._onDialogResult, this, 0, {title: _('Optimal Row Height')});
		}
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._dialog.addTo(this._map);
		this._map.enable(false);
		this._dialog.show();
	},

	insertRow: function(index) {
		// First select the corresponding row because
		// .uno:InsertRows doesn't accept any row number
		// as argument and just inserts before the selected row
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRows');
	},

	deleteRow: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteRows');
	},

	hideRow: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:HideRow');
	},

	showRow: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:ShowRow');
	},

	setScrollPosition: function (e) {
		var position = -e.y;
		this._position = Math.min(0, position);
	},

	offsetScrollPosition: function (e) {
		var offset = e.y;
		this._position = Math.min(0, this._position - offset);
	},

	_onClearSelection: function (e) {
		this.clearSelection(this._data);
	},

	_onUpdateSelection: function (e) {
		var start = e.start.y;
		var end = e.end.y;
		if (start !== -1) {
			start = this._twipsToPixels(start);
		}
		if (end !== -1) {
			end = this._twipsToPixels(end);
		}
		this.updateSelection(this._data, start, end);
	},

	_onUpdateCurrentRow: function (e) {
		var y = e.y;
		if (y !== -1) {
			y = this._twipsToPixels(y);
		}
		this.updateCurrent(this._data, y);
	},

	_updateRowHeader: function () {
		this._map.fire('updaterowcolumnheaders', {x: 0, y: this._map._getTopLeftPoint().y, offset: {x: 0, y: undefined}});
	},

	drawHeaderEntry: function (entry, isOver, isHighlighted) {
		if (!entry)
			return;

		var ctx = this._canvasContext;
		var content = entry.index + this._topRow;
		var start = entry.pos - entry.size - this._topOffset;
		var end = entry.pos - this._topOffset;
		var height = end - start;
		var width = this._headerCanvas.width;

		if (isHighlighted !== true && isHighlighted !== false) {
			isHighlighted = this.isHighlighted(entry.index);
		}

		if (height <= 0)
			return;

		ctx.save();
		ctx.translate(0, this._position + this._topOffset);
		// background gradient
		var selectionBackgroundGradient = null;
		if (isHighlighted) {
			selectionBackgroundGradient = ctx.createLinearGradient(0, start, 0, start + height);
			selectionBackgroundGradient.addColorStop(0, this._selectionBackgroundGradient[0]);
			selectionBackgroundGradient.addColorStop(0.5, this._selectionBackgroundGradient[1]);
			selectionBackgroundGradient.addColorStop(1, this._selectionBackgroundGradient[2]);
		}
		// clip mask
		ctx.beginPath();
		ctx.rect(0, start, width, height);
		ctx.clip();
		// draw background
		ctx.fillStyle = isHighlighted ? selectionBackgroundGradient : isOver ? this._hoverColor : this._backgroundColor;
		ctx.fillRect(0, start, width, height);
		// draw text content
		ctx.fillStyle = isHighlighted ? this._selectionTextColor : this._textColor;
		ctx.font = this._font;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(content, width / 2, end - (height / 2));
		// draw row separator
		ctx.fillStyle = this._borderColor;
		ctx.fillRect(0, end -1, width, this._borderWidth);
		ctx.restore();
	},

	getHeaderEntryBoundingClientRect: function (index) {
		var entry = this._mouseOverEntry;
		if (index)
			entry = this._data.get(index);

		if (!entry)
			return;

		var rect = this._headerCanvas.getBoundingClientRect();

		var rowStart = entry.pos - entry.size + this._position;
		var rowEnd = entry.pos + this._position;

		var left = rect.left;
		var right = rect.right;
		var top = rect.top + rowStart;
		var bottom = rect.top + rowEnd;
		return {left: left, right: right, top: top, bottom: bottom};
	},

	viewRowColumnHeaders: function (e) {
		if (e.data.rows && e.data.rows.length) {
			this.fillRows(e.data.rows, e.converter, e.context);
		}
	},

	fillRows: function (rows, converter, context) {
		if (rows.length < 2)
			return;

		var entry, index, iterator, height, pos;

		var canvas = this._headerCanvas;
		canvas.width = parseInt(L.DomUtil.getStyle(this._headersContainer, 'width'));
		canvas.height = parseInt(L.DomUtil.getStyle(this._headersContainer, 'height'));
		this._canvasContext.clearRect(0, 0, canvas.width, canvas.height);

		// update first header index and reset no more valid variables
		this._topRow = parseInt(rows[0].text);
		this._current = -1;
		this._selection.start = this._selection.end = -1;
		this._mouseOverEntry = null;
		this._lastMouseOverIndex = undefined;

		// create header data handler instance
		this._data = new L.Control.Header.DataImpl();

		// setup conversion routine
		this.converter = L.Util.bind(converter, context);
		this._data.converter = L.Util.bind(this._twipsToPixels, this);

		var startOffsetTw = parseInt(rows[0].size);
		this._topOffset = this._twipsToPixels(startOffsetTw);

		this._data.pushBack(0, {pos: startOffsetTw, size: 0});
		var prevPos = startOffsetTw;
		var nextIndex = parseInt(rows[1].text);
		var last = rows.length - 1;

		for (iterator = 1; iterator < last; iterator++) {
			index = nextIndex;
			pos = parseInt(rows[iterator].size);
			nextIndex = parseInt(rows[iterator+1].text);
			height = pos - prevPos;
			prevPos = Math.round(pos + height * (nextIndex - index - 1));
			index = index - this._topRow;
			entry = {pos: pos, size: height};
			this._data.pushBack(index, entry);
		}

		// setup last header entry
		index = nextIndex - this._topRow;
		pos = parseInt(rows[last].size);
		height = pos - prevPos;
		this._data.pushBack(index, {pos: pos, size: height});

		// draw header
		entry = this._data.getFirst();
		while (entry) {
			this.drawHeaderEntry(entry, false);
			entry = this._data.getNext();
		}

		this.mouseInit(canvas);

		L.DomEvent.on(canvas, 'contextmenu', L.DomEvent.preventDefault);
		if ($('.spreadsheet-header-rows').length > 0) {
			$('.spreadsheet-header-rows').contextMenu(this._map._permission === 'edit');
		}
	},

	_selectRow: function(row, modifier) {
		var command = {
			Row: {
				type: 'long',
				value: row - 1
			},
			Modifier: {
				type: 'unsigned short',
				value: modifier
			}
		};

		this._map.sendUnoCommand('.uno:SelectRow ', command);
	},

	_onHeaderClick: function (e) {
		if (!this._mouseOverEntry)
			return;

		var row = this._mouseOverEntry.index + this._topRow;

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

		var clickedRow = this._mouseOverEntry;
		if (clickedRow) {
			var height = clickedRow.size;
			var row = clickedRow.index + this._topRow;

			if (this._data.isZeroSize(clickedRow.index + 1)) {
				row += 1;
				height = 0;
			}

			if (height !== distance.y) {
				var command = {
					RowHeight: {
						type: 'unsigned short',
						value: this._map._docLayer.twipsToHMM(Math.max(distance.y, 0))
					},
					Row: {
						type: 'long',
						value: row
					}
				};

				this._map.sendUnoCommand('.uno:RowHeight', command);
			}
		}

		this._map.removeLayer(this._horzLine);
	},

	onDragClick: function (item, clicks, e) {
		this._map.removeLayer(this._horzLine);

		if (!this._mouseOverEntry)
			return;

		if (clicks === 2) {
			var row = this._mouseOverEntry.index + this._topRow;
			var command = {
				Row: {
					type: 'long',
					value: row - 1
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
		if ($('.spreadsheet-header-rows').length > 0) {
			$('.spreadsheet-header-rows').contextMenu(e.perm === 'edit');
		}
	},

	_getPos: function (point) {
		return point.y;
	}
});

L.control.rowHeader = function (options) {
	return new L.Control.RowHeader(options);
};
