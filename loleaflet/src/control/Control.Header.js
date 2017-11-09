/*
* Control.Header
*/

L.Control.Header = L.Control.extend({
	options: {
		cursor: 'col-resize'
	},

	initialize: function () {
		this.converter = null;

		this._headerCanvas = null;
		this._clicks = 0;
		this._current = -1;
		this._selection = {start: -1, end: -1};
		this._mouseOverEntry = null;
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

	select: function (entry) {
		this.drawHeaderEntry(entry, /*isOver=*/false, /*isHighlighted=*/true);
	},

	unselect: function (entry) {
		this.drawHeaderEntry(entry, /*isOver=*/false, /*isHighlighted=*/false);
	},

	isHighlighted: function (index) {
		if (this._selection.start === -1 && this._selection.end === -1) {
			return index === this._current;
		}
		return (this._selection.start <= index && index <= this._selection.end);
	},

	clearSelection: function (data) {
		if (this._selection.start === -1 && this._selection.end === -1)
			return;
		var start = (this._selection.start < 1) ? 1 : this._selection.start;
		var end = this._selection.end + 1;

		var entry = data.getAt(start);

		while (entry && entry.index < end) {
			this.unselect(entry);
			entry = data.getNext(start);
		}

		this._selection.start = this._selection.end = -1;
		// after clearing selection, we need to select the header entry for the current cursor position,
		// since we can't be sure that the selection clearing is due to click on a cell
		// different from the one where the cursor is already placed
		this.select(data.get(this._current));
	},

	updateSelection: function(data, start, end) {
		if (!data || data.isEmpty())
			return;

		var x0 = 0, x1 = 0;
		var itStart = -1, itEnd = -1;
		var selected = false;

		// if the start selection position is above/on the left of the first header entry,
		// but the end selection position is below/on the right of it
		// then we set the start selected entry to the first header entry.
		var entry = data.getFirst();
		if (entry) {
			x0 = entry.pos - entry.size;
			if (start < x0 && end > x0) {
				selected = true;
				itStart = 1;
			}
		}

		while (entry) {
			x0 = entry.pos - entry.size;
			x1 = entry.pos;
			if (x0 <= start && start < x1) {
				selected = true;
				itStart = entry.index;
			}
			if (selected) {
				this.select(entry);
			}
			if (x0 <= end && end <= x1) {
				itEnd = entry.index;
				break;
			}
			entry = data.getNext();
		}

		// if end is greater than the last fetched header position set itEnd to the max possible value
		// without this hack selecting a whole row and then a whole column (or viceversa) leads to an incorrect selection
		if (itStart !== -1 && itEnd === -1) {
			itEnd = data.getLength() - 1;
		}

		// we need to unselect the row (column) header entry for the current cell cursor position
		// since the selection could be due to selecting a whole row (column), so the selection
		// does not start by clicking on a cell
		if (this._current !== -1 && itStart !== -1 && itEnd !== -1) {
			if (this._current < itStart || this._current > itEnd) {
				this.unselect(data.get(this._current));
			}
		}

		if (this._selection.start !== -1 && itStart !== -1 && itStart > this._selection.start) {
			entry = data.getAt(this._selection.start);
			while (entry && entry.index < itStart) {
				this.unselect(entry);
				entry = data.getNext();
			}
		}
		if (this._selection.end !== -1 && itEnd !== -1 && itEnd < this._selection.end) {
			entry = data.getAt(itEnd + 1);
			while (entry && entry.index <= this._selection.end) {
				this.unselect(entry);
				entry = data.getNext();
			}
		}
		this._selection.start = itStart;
		this._selection.end = itEnd;
	},

	updateCurrent: function (data, start) {
		if (!data || data.isEmpty())
			return;

		if (start < 0) {
			this.unselect(data.get(this._current));
			this._current = -1;
			return;
		}

		var x0 = 0, x1 = 0;
		var entry = data.getFirst();
		while (entry) {
			x0 = entry.pos - entry.size;
			x1 = entry.pos;
			if (x0 <= start && start < x1) {
				// when a whole row (column) is selected the cell cursor is moved to the first column (row)
				// but this action should not cause to select/unselect anything, on the contrary we end up
				// with all column (row) header entries selected but the one where the cell cursor was
				// previously placed
				if (this._selection.start === -1 && this._selection.end === -1) {
					this.unselect(data.get(this._current));
					this.select(entry);
				}
				this._current = entry.index;
				break;
			}
			entry = data.getNext();
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
		if (this._mouseOverEntry) {
			this.drawHeaderEntry(this._mouseOverEntry, false);
			this._lastMouseOverIndex = this._mouseOverEntry.index; // used by context menu
			this._mouseOverEntry = null;
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

		var mouseOverIndex = this._mouseOverEntry ? this._mouseOverEntry.index : undefined;
		var entry = this._data.getFirst();
		while (entry) {
			var start = entry.pos - entry.size;
			var end = entry.pos;
			if (pos > start && pos <= end) {
				mouseOverIndex = entry.index;
				var resizeAreaStart = Math.max(start, end - 3);
				isMouseOverResizeArea = (pos > resizeAreaStart);
				break;
			}
			entry = this._data.getNext();
		}

		if (mouseOverIndex && (!this._mouseOverEntry || mouseOverIndex !== this._mouseOverEntry.index)) {
			this.drawHeaderEntry(this._mouseOverEntry, false);
			this.drawHeaderEntry(entry, true);
			this._mouseOverEntry = entry;
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

	_twipsToPixels: function (twips) {
		if (!this.converter)
			return 0;
		var point = new L.Point(twips, twips);
		return Math.round(this._getPos(this.converter(point)));
	},

	onDragStart: function () {},
	onDragMove: function () {},
	onDragEnd: function () {},
	onDragClick: function () {},
	getHeaderEntryBoundingClientRect: function () {},
	drawHeaderEntry: function () {},
	_getPos: function () {}
});

(function () {

	L.Control.Header.DataImpl = L.Class.extend({
		initialize: function () {
			this.converter = null;

			this._currentIndex = undefined;
			this._currentRange = undefined;
			this._dataMap = {};
			this._indexes = [];
			this._endIndex = -1;
			this._skipZeroSize = true;
		},

		_get: function (index, setCurrentIndex) {
			if (index < 1 || index > this._endIndex)
				return null;

			var range = this._getFirstIndexLessOrEqual(index);
			if (range !== undefined) {
				if (setCurrentIndex) {
					this._currentRange = range;
					this._currentIndex = index;
				}
				return this._computeEntry(this._indexes[range], index);
			}
		},

		get: function (index) {
			return this._get(index, false);
		},

		getAt: function (index) {
			return this._get(index, true);
		},

		getFirst: function () {
			this._currentRange = 0;
			this._currentIndex = this._indexes[this._currentRange];
			return this.getNext();
		},

		getNext: function () {
			if (this._currentIndex === undefined || this._currentRange === undefined)
				return null; // you need to call getFirst on initial step

			this._currentIndex += 1;
			if (this._currentIndex >= this._endIndex) {
				// we iterated over all entries, reset everything
				this._currentIndex = undefined;
				this._currentRange = undefined;
				this._skipZeroSize = false;
				return null;
			}

			if (this._indexes[this._currentRange+1] === this._currentIndex) {
				// new range
				this._currentRange += 1;

				if (this._skipZeroSize) {
					var index, i, len = this._indexes.length;
					for (i = this._currentRange; i < len; ++i) {
						index = this._indexes[i];
						if (this._dataMap[index].size > 0) {
							break;
						}
					}
					this._currentRange = i;
					this._currentIndex = index;
				}
			}

			var startIndex = this._indexes[this._currentRange];
			return this._computeEntry(startIndex, this._currentIndex);
		},

		pushBack: function (index, value) {
			if (index <= this._endIndex)
				return;
			this._dataMap[index] = value;
			this._indexes.push(index);
			this._endIndex = index;
		},

		isZeroSize: function (index) {
			if (!(index > 0 && index < this._endIndex)) {
				return true;
			}

			var range = this._getFirstIndexLessOrEqual(index);
			return this._dataMap[this._indexes[range]].size === 0;
		},

		getLength: function () {
			return this._endIndex;
		},

		isEmpty: function () {
			return 	this._indexes.length === 0;
		},

		_binaryIndexOf: function (collection, searchElement) {
			var minIndex = 0;
			var maxIndex = collection.length - 1;
			var currentIndex;
			var currentElement;

			while (minIndex <= maxIndex) {
				currentIndex = (minIndex + maxIndex) / 2 | 0;
				currentElement = collection[currentIndex];

				if (currentElement < searchElement) {
					minIndex = currentIndex + 1;
				}
				else if (currentElement > searchElement) {
					maxIndex = currentIndex - 1;
				}
				else {
					return currentIndex;
				}
			}

			if (currentIndex > maxIndex)
				return currentIndex - 1;
			if (currentIndex < minIndex)
				return currentIndex;
		},

		_getFirstIndexLessOrEqual: function (index) {
			return this._binaryIndexOf(this._indexes, index);
		},

		_twipsToPixels: function (twips) {
			if (!this.converter)
				return 0;

			return this.converter(twips);
		},

		_computeEntry: function (startIndex, index) {
			var entry = this._dataMap[startIndex];
			var pos = entry.pos + (index - startIndex) * entry.size;
			pos = this._twipsToPixels(pos);
			var size = this._twipsToPixels(entry.size);
			return {index: index, pos: pos, size: size};
		}

	});

})();