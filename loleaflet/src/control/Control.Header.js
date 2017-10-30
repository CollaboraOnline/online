/*
* Control.Header
*/

L.Control.Header = L.Control.extend({
	options: {
		cursor: 'col-resize'
	},

	initialize: function () {
		this._headerCanvas = null;
		this._clicks = 0;
		this._current = -1;
		this._selection = {start: -1, end: -1};
		this._mouseOverIndex = undefined;
		this._lastMouseOverIndex = undefined;
		this._hitResizeArea = false;

		this._selectionBackgroundGradient = [ '#3465A4', '#729FCF', '#004586' ];
	},

	_initHeaderEntryStyles: function (className) {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', className, baseElem);
		this._textColor = L.DomUtil.getStyle(elem, 'color');
		this._backgroundColor = L.DomUtil.getStyle(elem, 'background-color');
		this._font = L.DomUtil.getStyle(elem, 'font');
		this._borderColor = L.DomUtil.getStyle(elem, 'border-color');
		var borderWidth = L.DomUtil.getStyle(elem, 'border-width');
		this._borderWidth = parseInt(borderWidth.slice(0, -2));
		this._cursor = L.DomUtil.getStyle(elem, 'cursor');
		L.DomUtil.remove(elem);
	},

	_initHeaderEntryHoverStyles: function (className) {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', className, baseElem);
		this._hoverColor = L.DomUtil.getStyle(elem, 'background-color');
		L.DomUtil.remove(elem);
	},

	_initHeaderEntrySelectedStyles: function (className) {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', className, baseElem);
		this._selectionTextColor = L.DomUtil.getStyle(elem, 'color');

		var selectionBackgroundGradient = [];
		var gradientColors = L.DomUtil.getStyle(elem, 'background-image');
		gradientColors = gradientColors.slice('linear-gradient('.length, -1);
		while (gradientColors) {
			var color = gradientColors.split(',', 3);
			color = color.join(','); // color = 'rgb(r, g, b)'
			selectionBackgroundGradient.push(color);
			gradientColors = gradientColors.substr(color.length); // remove last parsed color
			gradientColors = gradientColors.substr(gradientColors.indexOf('r')); // remove ', ' stuff
		}

		if (selectionBackgroundGradient.length) {
			this._selectionBackgroundGradient = selectionBackgroundGradient;
		}
		L.DomUtil.remove(elem);
	},

	_initHeaderEntryResizeStyles: function (className) {
		if (this.options.cursor) {
			this._resizeCursor = this.options.cursor;
		}
		else {
			var baseElem = document.getElementsByTagName('body')[0];
			var elem = L.DomUtil.create('div', className, baseElem);
			this._resizeCursor = L.DomUtil.getStyle(elem, 'cursor');
			L.DomUtil.remove(elem);
		}
	},

	mouseInit: function (element) {
		L.DomEvent.on(element, 'mousedown', this._onMouseDown, this);
	},

	select: function (data, index) {
		if (!data[index])
			return;
		data[index].selected = true;
		this.drawHeaderEntry(index, false);
	},

	unselect: function (data, index) {
		if (!data[index])
			return;
		data[index].selected = false;
		this.drawHeaderEntry(index, false);
	},

	clearSelection: function (data) {
		if (this._selection.start === -1 && this._selection.end === -1)
			return;
		var start = (this._selection.start === -1) ? 0 : this._selection.start;
		var end = this._selection.end + 1;
		for (var iterator = start; iterator < end; iterator++) {
			this.unselect(data, iterator);
		}

		this._selection.start = this._selection.end = -1;
		// after clearing selection, we need to select the header entry for the current cursor position,
		// since we can't be sure that the selection clearing is due to click on a cell
		// different from the one where the cursor is already placed
		this.select(data, this._current);
	},

	updateSelection: function(data, start, end) {
		if (!data)
			return;

		var x0 = 0, x1 = 0;
		var itStart = -1, itEnd = -1;
		var selected = false;
		var iterator = 0;
		for (var len = data.length; iterator < len; iterator++) {
			x0 = (iterator > 0 ? data[iterator - 1].pos : 0);
			x1 = data[iterator].pos;
			// 'start < x1' not '<=' or we get highlighted also the `start-row - 1` and `start-column - 1` headers
			if (x0 <= start && start < x1) {
				selected = true;
				itStart = iterator;
			}
			if (selected) {
				this.select(data, iterator);
			}
			if (x0 <= end && end <= x1) {
				itEnd = iterator;
				break;
			}
		}

		// if end is greater than the last fetched header position set itEnd to the max possible value
		// without this hack selecting a whole row and then a whole column (or viceversa) leads to an incorrect selection
		if (itStart !== -1 && itEnd === -1) {
			itEnd = data.length - 1;
		}

		// we need to unselect the row (column) header entry for the current cell cursor position
		// since the selection could be due to selecting a whole row (column), so the selection
		// does not start by clicking on a cell
		if (this._current !== -1 && itStart !== -1 && itEnd !== -1) {
			if (this._current < itStart || this._current > itEnd) {
				this.unselect(data, this._current);
			}
		}
		if (this._selection.start !== -1 && itStart !== -1 && itStart > this._selection.start) {
			for (iterator = this._selection.start; iterator < itStart; iterator++) {
				this.unselect(data, iterator);
			}
		}
		if (this._selection.end !== -1 && itEnd !== -1 && itEnd < this._selection.end) {
			for (iterator = itEnd + 1; iterator <= this._selection.end; iterator++) {
				this.unselect(data, iterator);
			}
		}
		this._selection.start = itStart;
		this._selection.end = itEnd;
	},

	updateCurrent: function (data, start) {
		if (!data)
			return;
		if (start < 0) {
			this.unselect(data, this._current);
			this._current = -1;
			return;
		}

		var x0 = 0, x1 = 0;
		for (var iterator = 1, len = data.length; iterator < len; iterator++) {
			x0 = (iterator > 0 ? data[iterator - 1].pos : 0);
			x1 = data[iterator].pos;
			if (x0 <= start && start < x1) {
				// when a whole row (column) is selected the cell cursor is moved to the first column (row)
				// but this action should not cause to select/unselect anything, on the contrary we end up
				// with all column (row) header entries selected but the one where the cell cursor was
				// previously placed
				if (this._selection.start === -1 && this._selection.end === -1) {
					this.unselect(data, this._current);
					this.select(data, iterator);
				}
				this._current = iterator;
				break;
			}
		}
	},

	_mouseEventToCanvasPos: function(canvas, evt) {
		var rect = canvas.getBoundingClientRect();
		return {
			x: evt.clientX - rect.left,
			y: evt.clientY - rect.top
		};
	},

	_onMouseOut: function (e) {
		if (this._mouseOverIndex) {
			this.drawHeaderEntry(this._mouseOverIndex, false);
			this._lastMouseOverIndex = this._mouseOverIndex; // used by context menu
			this._mouseOverIndex = undefined;
		}
		this._hitResizeArea = false;
		L.DomUtil.setStyle(this._headerCanvas, 'cursor', this._cursor);
	},

	_onCanvasMouseMove: function (e) {
		var target = e.target || e.srcElement;

		if (!target || this._dragging) {
			return false;
		}

		var isMouseOverResizeArea = false;
		var pos = this._getPos(this._mouseEventToCanvasPos(this._headerCanvas, e));
		pos = pos - this._position;

		var mouseOverIndex = this._mouseOverIndex;
		for (var iterator = 1; iterator < this._data.length; ++iterator) {
			var start = this._data[iterator - 1].pos;
			var end = this._data[iterator].pos;
			if (pos > start && pos <= end) {
				mouseOverIndex = iterator;
				var resizeAreaStart = Math.max(start, end - 3);
				isMouseOverResizeArea = (pos > resizeAreaStart);
				break;
			}
		}

		if (mouseOverIndex !== this._mouseOverIndex) {
			if (this._mouseOverIndex) {
				this.drawHeaderEntry(this._mouseOverIndex, false);
			}
			if (mouseOverIndex) {
				this.drawHeaderEntry(mouseOverIndex, true);
			}
		}

		if (isMouseOverResizeArea !== this._hitResizeArea) {
			if (isMouseOverResizeArea) {
				L.DomEvent.off(this._headerCanvas, 'click', this._onHeaderClick, this);
			}
			else {
				L.DomEvent.on(this._headerCanvas, 'click', this._onHeaderClick, this);
			}
			var cursor = isMouseOverResizeArea ? this._resizeCursor : this._cursor;
			L.DomUtil.setStyle(this._headerCanvas, 'cursor', cursor);
			this._hitResizeArea = isMouseOverResizeArea;
		}

		this._mouseOverIndex = mouseOverIndex;
	},

	_onMouseDown: function (e) {
		var target = e.target || e.srcElement;

		if (!target || this._dragging) {
			return false;
		}

		if (!this._hitResizeArea)
			return;

		L.DomUtil.disableImageDrag();
		L.DomUtil.disableTextSelection();

		L.DomEvent.stopPropagation(e);

		L.DomEvent.off(target, 'mousemove', this._onCanvasMouseMove, this);
		L.DomEvent.off(target, 'mouseout', this._onMouseOut, this);

		L.DomEvent.on(document, 'mousemove', this._onMouseMove, this);
		L.DomEvent.on(document, 'mouseup', this._onMouseUp, this);

		var rect = this.getHeaderEntryBoundingClientRect();
		this._start = new L.Point(rect.left, rect.top);
		this._offset = new L.Point(rect.right - e.clientX, rect.bottom - e.clientY);
		this._item = target;

		this.onDragStart(this.item, this._start, this._offset, e);
	},

	_onMouseMove: function (e) {
		this._dragging = true;
		L.DomEvent.preventDefault(e);

		this.onDragMove(this._item, this._start, this._offset, e);
	},

	_onMouseUp: function (e) {
		L.DomEvent.off(document, 'mousemove', this._onMouseMove, this);
		L.DomEvent.off(document, 'mouseup', this._onMouseUp, this);

		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		L.DomEvent.on(this._item, 'mousemove', this._onCanvasMouseMove, this);
		L.DomEvent.on(this._item, 'mouseout', this._onMouseOut, this);

		if (this._dragging) {
			this.onDragEnd(this._item, this._start, this._offset, e);
			this._clicks = 0;
		} else {
			this.onDragClick(this._item, ++this._clicks, e);
			setTimeout(L.bind(this.initialize, this), 400);
		}

		this._item = this._start = this._offset = null;
		this._dragging = false;
	},

	onDragStart: function () {},
	onDragMove: function () {},
	onDragEnd: function () {},
	onDragClick: function () {},
	getHeaderEntryBoundingClientRect: function () {},
	drawHeaderEntry: function () {},
	_getPos: function () {}
});
