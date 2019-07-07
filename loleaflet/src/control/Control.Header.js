/* -*- js-indent-level: 8 -*- */
/*
* Control.Header
*/
/* global L Hammer */

L.Control.Header = L.Control.extend({
	options: {
		cursor: 'col-resize'
	},

	initialize: function () {
		this._isColumn = undefined;

		this.converter = null;

		this._canvas = null;
		this._canvasWidth = 0;
		this._canvasHeight = 0;
		this._clicks = 0;
		this._current = -1;
		this._resizeHandleSize = 15;
		this._selection = {start: -1, end: -1};
		this._mouseOverEntry = null;
		this._lastMouseOverIndex = undefined;
		this._hitResizeArea = false;
		this._overHeaderArea = false;
		this._hammer = null;

		this._selectionBackgroundGradient = [ '#3465A4', '#729FCF', '#004586' ];

		this._groups = null;

		// group control styles
		this._groupHeadSize = 12;
		this._levelSpacing = 1;

		// set up corner header
		var cornerHeader = L.DomUtil.get('spreadsheet-header-corner-container');
		if (cornerHeader) {
			this._cornerHeaderContainer = cornerHeader;
			this._cornerCanvas = L.DomUtil.get('spreadsheet-header-corner');
			L.DomEvent.on(this._cornerHeaderContainer, 'touchstart',
				function (e) {
					if (e && e.touches.length > 1) {
						L.DomEvent.preventDefault(e);
					}
				},
				this);

		}
		else {
			var rowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
			this._cornerHeaderContainer = L.DomUtil.createWithId('div', 'spreadsheet-header-corner-container', rowColumnFrame);
			this._cornerCanvas = L.DomUtil.createWithId('canvas', 'spreadsheet-header-corner', this._cornerHeaderContainer);
			this._setCornerCanvasWidth();
			this._setCornerCanvasHeight();
		}
		this._cornerCanvasContext = this._cornerCanvas.getContext('2d');
		this._cornerCanvasContext.clearRect(0, 0, this._cornerCanvas.width, this._cornerCanvas.height);
	},

	_initHeaderEntryStyles: function (className) {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', className, baseElem);
		this._textColor = L.DomUtil.getStyle(elem, 'color');
		this._backgroundColor = L.DomUtil.getStyle(elem, 'background-color');
		var fontFamily = L.DomUtil.getStyle(elem, 'font-family');
		var fontSize = parseInt(L.DomUtil.getStyle(elem, 'font-size'));
		var fontHeight = parseInt(L.DomUtil.getStyle(elem, 'line-height'));
		var rate = fontHeight / fontSize;
		this._font = fontSize + 'px/' + rate + ' ' + fontFamily;
		this._borderColor = L.DomUtil.getStyle(elem, 'border-top-color');
		var borderWidth = L.DomUtil.getStyle(elem, 'border-top-width');
		this._borderWidth = Math.round(parseFloat(borderWidth));
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
		var self = this;
		if (this._hammer == null) {
			this._hammer = new Hammer(element);
			this._hammer.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
			this._hammer.on('panstart panmove panend', function (event) {
				self._onPan(event);
			});
		}
		L.DomEvent.on(element, 'mousedown', this._onMouseDown, this);
	},

	select: function (entry, isCurrent) {
		this.drawHeaderEntry(entry, /*isOver=*/false, /*isHighlighted=*/true, isCurrent);
	},

	unselect: function (entry) {
		this.drawHeaderEntry(entry, /*isOver=*/false, /*isHighlighted=*/false, false);
	},

	isHeaderSelected: function (index) {
		return index === this._current;
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
		this.select(data.get(this._current), true);
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
				this.select(entry, false);
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

	updateCurrent: function (data, cursorPos, slim) {
		if (!data || data.isEmpty())
			return;

		if (cursorPos < 0) {
			this.unselect(data.get(this._current));
			this._current = -1;
			return;
		}

		var prevEntry = cursorPos > 0 ? data.get(cursorPos - 1) : null;
		var zeroSizeEntry = slim && prevEntry && prevEntry.size === 0;

		var entry = data.get(cursorPos);
		if (this._selection.start === -1 && this._selection.end === -1) {
			// when a whole row (column) is selected the cell cursor is moved to the first column (row)
			// but this action should not cause to select/unselect anything, on the contrary we end up
			// with all column (row) header entries selected but the one where the cell cursor was
			// previously placed
			this.unselect(data.get(this._current));
			// no selection when the cell cursor is slim
			if (entry && !zeroSizeEntry)
				this.select(entry, true);
		}
		this._current = entry && !zeroSizeEntry ? entry.index : -1;
	},

	_onPan: function (event) {
		if (event.pointerType != 'touch')
			return;

		if (event.type == 'panstart')
			this._onPanStart(event);
		else if (event.type == 'panmove') {
			this._onPanMove(event);
		}
		else if (event.type == 'panend') {
			this._onPanEnd(event);
		}
	},

	_entryAtPoint: function(point) {
		var position = this._getParallelPos(point);
		position = position - this._position;

		var eachEntry = this._data.getFirst();
		while (eachEntry) {
			var start = eachEntry.pos - eachEntry.size;
			var end = eachEntry.pos;
			if (position > start && position <= end) {
				var resizeAreaStart = Math.max(start, end - 3);
				if (this.isHeaderSelected(eachEntry.index)) {
					resizeAreaStart = end - this._resizeHandleSize;
				}
				var isMouseOverResizeArea = (position > resizeAreaStart);
				return {entry: eachEntry, hit: isMouseOverResizeArea};
			}
			eachEntry = this._data.getNext();
		}
		return null;
	},

	_onPanStart: function (event) {
		if (this._hitOutline(event))
			return;

		var target = event.target || event.srcElement;
		if (!target)
			return false;

		var result = this._entryAtPoint(this._hammerEventToCanvasPos(this._canvas, event));
		if (!result)
			return false;

		this._mouseOverEntry = result.entry;
		var rectangle = this.getHeaderEntryBoundingClientRect(result.entry.index);
		if (!rectangle)
			return;

		L.DomUtil.disableImageDrag();
		L.DomUtil.disableTextSelection();

		this._start = new L.Point(rectangle.left, rectangle.top);
		this._offset = new L.Point(rectangle.right - event.center.x, rectangle.bottom - event.center.y);
		this._item = target;
		this.onDragStart(this._item, this._start, this._offset, {clientX: event.center.x, clientY: event.center.y});
	},

	_onPanMove: function (event) {
		this.onDragMove(this._item, this._start, this._offset, {clientX: event.center.x, clientY: event.center.y});
	},

	_onPanEnd: function (event) {
		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		this.onDragEnd(this._item, this._start, this._offset, {clientX: event.center.x, clientY: event.center.y});

		this._mouseOverEntry = null;
		this._item = this._start = this._offset = null;
		this._dragging = false;
	},

	_mouseEventToCanvasPos: function(canvas, evt) {
		var rect = canvas.getBoundingClientRect();
		return {
			x: evt.clientX - rect.left,
			y: evt.clientY - rect.top
		};
	},

	_hammerEventToCanvasPos: function(canvas, event) {
		var rect = canvas.getBoundingClientRect();
		return {
			x: event.center.x - rect.left,
			y: event.center.y - rect.top
		};
	},

	_onMouseOut: function (e) {
		if (this._hitOutline(e))
			return;

		this._onHeaderMouseOut(e);
	},

	_onHeaderMouseOut: function () {
		if (!this._overHeaderArea)
			return;
		this._overHeaderArea = false;

		if (this._mouseOverEntry) {
			var mouseOverIsCurrent = (this._mouseOverEntry.index == this._current);
			this.drawHeaderEntry(this._mouseOverEntry, /*isOver: */ false, null, mouseOverIsCurrent);
			this._lastMouseOverIndex = this._mouseOverEntry.index + this._startHeaderIndex; // used by context menu
			this._mouseOverEntry = null;
		}
		this._hitResizeArea = false;
		L.DomEvent.on(this._canvas, 'click', this._onClick, this);
		L.DomUtil.setStyle(this._canvas, 'cursor', 'default');
	},

	_onMouseMove: function (e) {
		if (this._hitOutline(e)) {
			this._onHeaderMouseOut(e);
			return false;
		}
		if (!this._overHeaderArea) {
			L.DomUtil.setStyle(this._canvas, 'cursor', this._cursor);
			this._overHeaderArea = true;
		}

		var mouseOverIndex = this._mouseOverEntry ? this._mouseOverEntry.index : null;
		var isMouseOverResizeArea = false;
		var result = this._entryAtPoint(this._mouseEventToCanvasPos(this._canvas, e));

		var entry = this._data.getFirst();
		if (result) {
			isMouseOverResizeArea = result.hit;
			mouseOverIndex = result.entry.index;
			entry = result.entry;
		}

		if (mouseOverIndex && (!this._mouseOverEntry || mouseOverIndex !== this._mouseOverEntry.index)) {
			var mouseOverIsCurrent = false;
			if (this._mouseOverEntry != null) {
				mouseOverIsCurrent = (this._mouseOverEntry.index == this._current);
			}
			this.drawHeaderEntry(this._mouseOverEntry, false, null, mouseOverIsCurrent);
			this.drawHeaderEntry(entry, true, null, entry.index == this._current);
			this._mouseOverEntry = entry;
		}

		if (isMouseOverResizeArea !== this._hitResizeArea) {
			if (isMouseOverResizeArea) {
				L.DomEvent.off(this._canvas, 'click', this._onClick, this);
			}
			else {
				L.DomEvent.on(this._canvas, 'click', this._onClick, this);
			}
			var cursor = isMouseOverResizeArea ? this._resizeCursor : this._cursor;
			L.DomUtil.setStyle(this._canvas, 'cursor', cursor);
			this._hitResizeArea = isMouseOverResizeArea;
		}
	},


	_onOutlineMouseEvent: function (e, eventHandler) {
		// check if the group controls area has been hit
		if (!this._hitOutline(e))
			return false;

		var pos = this._mouseEventToCanvasPos(this._canvas, e);
		var level = this._getGroupLevel(this._getOrthogonalPos(pos));
		if (level < 0 || level >= this._groups.length)
			return true;

		// when 2 collapsed group controls overlaps completely,
		// clicking on the control should expand the lower/rightmost group
		var groups = this._groups[level];
		var indexes = Object.keys(groups);
		var len = indexes.length;
		for (var i = len - 1; i >= 0; --i) {
			e.group = groups[indexes[i]];
			if (eventHandler.call(this, e))
				break;
		}

		return true;
	},

	_onGroupControlClick: function (e) {
		var group = e.group;
		if (!group)
			return false;

		var pos = this._getParallelPos(this._mouseEventToCanvasPos(this._canvas, e));
		pos = pos - this._position;
		if (group.startPos < pos && pos < group.startPos + this._groupHeadSize) {
			this._updateOutlineState(/*isColumnOutline: */ this._isColumn, group);
			return true;
		}
		return false;
	},

	_onDoubleClick: function (e) {
		this._onOutlineMouseEvent(e, this._onGroupControlDoubleClick);
	},

	_onGroupControlDoubleClick: function (e) {
		var group = e.group;
		if (!group && !group.hidden)
			return false;

		var pos = this._getParallelPos(this._mouseEventToCanvasPos(this._canvas, e));
		pos = pos - this._position;
		if (group.startPos + this._groupHeadSize < pos && pos < group.endPos) {
			this._updateOutlineState(/*isColumnOutline: */ this._isColumn, group);
			return true;
		}
		return false;
	},

	_updateOutlineState: function (column, group) {
		if (!group)
			return;

		var type = column ? 'column' : 'row';
		var state = group.hidden ? 'visible' : 'hidden'; // we have to send the new state
		var payload = 'outlinestate type='+ type + ' level=' + group.level + ' index=' + group.index + ' state=' + state;
		this._map._socket.sendMessage(payload);
	},

	_onMouseDown: function (e) {
		if (this._hitOutline(e))
			return;

		var target = e.target || e.srcElement;
		if (!target || this._dragging) {
			return false;
		}

		if (!this._hitResizeArea)
			return;

		var rect = this.getHeaderEntryBoundingClientRect();
		if (!rect)
			return;

		L.DomUtil.disableImageDrag();
		L.DomUtil.disableTextSelection();

		L.DomEvent.stopPropagation(e);

		// disable normal mouse events
		L.DomEvent.off(target, 'mousemove', this._onMouseMove, this);
		L.DomEvent.off(target, 'mouseout', this._onMouseOut, this);
		// enable mouse events used on dragging
		L.DomEvent.on(document, 'mousemove', this._onMouseMoveForDragging, this);
		L.DomEvent.on(document, 'mouseup', this._onMouseUp, this);


		this._start = new L.Point(rect.left, rect.top);
		this._offset = new L.Point(rect.right - e.clientX, rect.bottom - e.clientY);
		this._item = target;

		this.onDragStart(this._item, this._start, this._offset, e);
	},

	_onMouseMoveForDragging: function (e) {
		this._dragging = true;
		L.DomEvent.preventDefault(e);

		this.onDragMove(this._item, this._start, this._offset, e);
	},

	_resetClickCount: function () {
		this._clicks = 0;
	},

	_onMouseUp: function (e) {
		// disable mouse events used on dragging
		L.DomEvent.off(document, 'mousemove', this._onMouseMoveForDragging, this);
		L.DomEvent.off(document, 'mouseup', this._onMouseUp, this);

		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();
		// enable normal mouse events
		L.DomEvent.on(this._item, 'mousemove', this._onMouseMove, this);
		L.DomEvent.on(this._item, 'mouseout', this._onMouseOut, this);

		if (this._dragging) {
			this.onDragEnd(this._item, this._start, this._offset, e);
			this._clicks = 0;
		} else {
			this.onDragClick(this._item, ++this._clicks, e);
			setTimeout(L.bind(this._resetClickCount, this), 400);
		}

		this._item = this._start = this._offset = null;
		this._dragging = false;
	},

	_twipsToPixels: function (twips) {
		if (!this.converter)
			return 0;
		var point = new L.Point(twips, twips);
		return Math.round(this._getParallelPos(this.converter(point)));
	},

	_setCanvasSizeImpl: function (container, canvas, property, value, isCorner) {
		if (!value) {
			value = parseInt(L.DomUtil.getStyle(container, property));
		}
		else {
			L.DomUtil.setStyle(container, property, value + 'px');
		}

		var scale = L.getDpiScaleFactor();
		if (property === 'width') {
			canvas.width = value * scale;
			if (!isCorner)
				this._canvasWidth = value;
			console.log('Header._setCanvasSizeImpl: _canvasWidth' + this._canvasWidth);
		}
		else if (property === 'height') {
			canvas.height = value * scale;
			if (!isCorner)
				this._canvasHeight = value;
		}
	},

	_setCanvasWidth: function (width) {
		this._setCanvasSizeImpl(this._headerContainer, this._canvas, 'width', width, /*isCorner: */ false);
	},

	_setCanvasHeight: function (height) {
		this._setCanvasSizeImpl(this._headerContainer, this._canvas, 'height', height, /*isCorner: */ false);
	},

	_setCornerCanvasWidth: function (width) {
		this._setCanvasSizeImpl(this._cornerHeaderContainer, this._cornerCanvas, 'width', width, /*isCorner: */ true);
	},

	_setCornerCanvasHeight: function (height) {
		this._setCanvasSizeImpl(this._cornerHeaderContainer, this._cornerCanvas, 'height', height, /*isCorner: */ true);
	},

	_hitOutline: function (e) {
		var pos = this._mouseEventToCanvasPos(this._canvas, e);
		return this._getOrthogonalPos(pos) <= this.getOutlineWidth();
	},

	_getGroupLevel: function (pos) {
		var levels = this._groups.length;
		var size = this._levelSpacing + this._groupHeadSize;

		var level = (pos + 1) / size | 0;
		var relPos = pos % size;

		if (level <= levels && relPos > this._levelSpacing) {
			return level;
		}
		else {
			return -1;
		}
	},

	_computeOutlineWidth: function () {
		return this._levelSpacing + (this._groupHeadSize + this._levelSpacing) * (this._groups.length + 1);
	},

	getOutlineWidth: function () {
		if (this._isColumn)
			return this._canvasHeight - this._borderWidth - this._headerHeight;
		else
			return this._canvasWidth - this._borderWidth - this._headerWidth;
	},

	_collectGroupsData: function(groups) {
		var level, groupEntry;

		var lastGroupIndex = new Array(groups.length);
		var firstChildGroupIndex = new Array(groups.length);
		var lastLevel = -1;
		for (var i = 0; i < groups.length; ++i) {
			// a new group start
			var groupData = groups[i];
			level = parseInt(groupData.level) - 1;
			if (!this._groups[level]) {
				this._groups[level] = {};
			}
			var startPos = this._twipsToPixels(parseInt(groupData.startPos));
			var endPos = this._twipsToPixels(parseInt(groupData.endPos));
			var isHidden = !!parseInt(groupData.hidden);
			if (isHidden || startPos === endPos) {
				startPos -= this._groupHeadSize / 2;
				endPos = startPos + this._groupHeadSize;
			}
			else {
				var moved = false;
				// if the first child is collapsed the parent head has to be top-aligned with the child
				if (level < lastLevel && firstChildGroupIndex[lastLevel] !== undefined) {
					var childGroupEntry = this._groups[lastLevel][firstChildGroupIndex[lastLevel]];
					if (childGroupEntry.hidden) {
						if (startPos > childGroupEntry.startPos && startPos < childGroupEntry.endPos) {
							startPos = childGroupEntry.startPos;
							moved = true;
						}
					}
				}
				// if 2 groups belonging to the same level are contiguous and the first group is collapsed,
				// the second one has to be shifted as much as possible in order to avoiding overlapping.
				if (!moved && lastGroupIndex[level] !== undefined) {
					var prevGroupEntry = this._groups[level][lastGroupIndex[level]];
					if (prevGroupEntry.hidden) {
						if (startPos > prevGroupEntry.startPos && startPos < prevGroupEntry.endPos) {
							startPos = prevGroupEntry.endPos;
						}
					}
				}
			}
			groupEntry = {
				level: level,
				index: groupData.index,
				startPos: startPos,
				endPos: endPos,
				hidden: isHidden
			};
			this._groups[level][groupData.index] = groupEntry;
			lastGroupIndex[level] = groupData.index;
			if (level > lastLevel) {
				firstChildGroupIndex[level] = groupData.index;
				lastLevel = level;
			}
			else if (level === lastLevel) {
				firstChildGroupIndex[level + 1] = undefined;
			}
		}
	},

	drawCornerHeader: function() {
		var ctx = this._cornerCanvasContext;

		if (!this._groups)
			return;

		ctx.save();
		var scale = L.getDpiScaleFactor();
		ctx.scale(scale, scale);

		ctx.fillStyle = this._borderColor;
		if (this._isColumn) {
			var startY = this._cornerCanvas.height / scale - (L.Control.Header.colHeaderHeight + this._borderWidth);
			if (startY > 0)
				ctx.fillRect(0, startY, this._cornerCanvas.width, this._borderWidth);
		}
		else {
			var startX = this._cornerCanvas.width / scale - (L.Control.Header.rowHeaderWidth + this._borderWidth);
			if (startX > 0)
				ctx.fillRect(startX, 0, this._borderWidth, this._cornerCanvas.height);
		}
		ctx.restore();

		var levels = this._groups.length + 1;
		for (var i = 0; i < levels; ++i) {
			this.drawLevelHeader(i);
		}
	},

	drawOutline: function() {
		if (this._groups) {
			for (var itLevel = 0; itLevel < this._groups.length; ++itLevel) {
				for (var groupIndex in this._groups[itLevel]) {
					if (this._groups[itLevel].hasOwnProperty(groupIndex))
						this.drawGroupControl(this._groups[itLevel][groupIndex]);
				}
			}
		}
	},

	onDragStart: function () {},
	onDragMove: function () {},
	onDragEnd: function () {},
	onDragClick: function () {},
	getHeaderEntryBoundingClientRect: function () {},
	drawHeaderEntry: function () {},
	drawGroupControl: function () {},
	_getParallelPos: function () {},
	_getOrthogonalPos: function () {}

});

(function () {
	L.Control.Header.rowHeaderWidth = undefined;
	L.Control.Header.colHeaderHeight = undefined;

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
			if (this._currentIndex > this._endIndex) {
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
					if (i < len) {
						this._currentRange = i;
						this._currentIndex = index;
					}
					else {
						// we iterated over all entries, reset everything
						this._currentIndex = undefined;
						this._currentRange = undefined;
						this._skipZeroSize = false;
						return null;
					}
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
