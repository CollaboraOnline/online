/* -*- js-indent-level: 8 -*- */
/*
* Control.Header
*
* Abstract class, basis for ColumnHeader and RowHeader controls.
* Used only in spreadsheets, implements the row/column headers.
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
		this._font = {
			_hdr: this,
			_baseFontSize: fontSize,
			_fontSizeRate: rate,
			_fontFamily: fontFamily,
			getFont: function() {
				// Limit zoomScale to 115%. At 120% the row ids at the bottom eat all
				// horizontal margins and it looks ugly. Beyond 120% the row ids get
				// clipped out visibly.
				var zoomScale = this._hdr.getHeaderZoomScale(
					/* lowerBound */ 0.5, /* upperBound */ 1.15);

				return Math.floor(this._baseFontSize * zoomScale) +
					'px/' +
					this._fontSizeRate +
					' ' +
					this._fontFamily;
			}
		};
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

	clearSelection: function () {
		if (this._selection.start === -1 && this._selection.end === -1)
			return;
		var start = (this._selection.start < 1) ? 1 : this._selection.start;
		var end = this._selection.end + 1;

		for (var i=start; i<end; i++) {
			if (i === this._current) {
				// after clearing selection, we need to select the header entry for the current cursor position,
				// since we can't be sure that the selection clearing is due to click on a cell
				// different from the one where the cursor is already placed
				this.select(this._tickMap.getGap(i), true);
			} else {
				this.unselect(this._tickMap.getGap(i));
			}
		}

		this._selection.start = this._selection.end = -1;
	},

	// Sets the internal this._selection values accordingly, unselects the previous set of rows/cols and
	// selects the new set of rows/cols.
	// Start and end are given in pixels absolute to the document
	updateSelection: function(start, end) {
		if (!this._tickMap)
			return;

		var x0 = 0, x1 = 0;
		var itStart = -1, itEnd = -1;

		// if the start selection position is above/on the left of the first header entry,
		// but the end selection position is below/on the right of it
		// then we set the start selected entry to the first header entry.
		var entry = this._tickMap.getGap(this._tickMap.getMinTickIdx() + 1);
		if (entry) {
			x0 = entry.pos - entry.size;
			if (start < x0 && end > x0) {
				itStart = 1;
			}
		}

		this._tickMap.forEachGap((function(entry) {
			x0 = entry.start;
			x1 = entry.pos;
			if (start < x1 && end > x0) {
				this.select(entry, false);
				if (itStart === -1) {
					itStart = entry.index;
				}
			} else {
				this.unselect(entry);
				if (itStart !== -1 && itEnd === -1) {
					itEnd = entry.index - 1;
				}
			}
		}).bind(this));

		// if end is greater than the last fetched header position set itEnd to the max possible value
		// without this hack selecting a whole row and then a whole column (or viceversa) leads to an incorrect selection
		if (itStart !== -1 && itEnd === -1) {
			itEnd = this._tickMap.getMaxTickIdx() - 1;
		}

		this._selection.start = itStart;
		this._selection.end = itEnd;
	},


	// Called whenever the cell cursor is in a cell corresponding to the cursorPos-th
	// column/row.
	updateCurrent: function (cursorPos, slim) {
		if (!this._tickMap) {return;}

		if (cursorPos < 0) {
			this.unselect(this._tickMap.getGap(this._current));
			this._current = -1;
			return;
		}

		var prevEntry = cursorPos > 0 ? this._tickMap.getGap(cursorPos - 1) : null;
		var zeroSizeEntry = slim && prevEntry && prevEntry.size === 0;

		var entry = this._tickMap.getGap(cursorPos);
		if (this._selection.start === -1 && this._selection.end === -1) {
			// when a whole row (column) is selected the cell cursor is moved to the first column (row)
			// but this action should not cause to select/unselect anything, on the contrary we end up
			// with all column (row) header entries selected but the one where the cell cursor was
			// previously placed
			this.unselect(this._tickMap.getGap(this._current));
			// no selection when the cell cursor is slim
			if (entry && !zeroSizeEntry)
				this.select(entry, true);
		}
		this._current = entry && !zeroSizeEntry ? entry.index : -1;
	},

	_onPan: function (event) {
		if (event.pointerType !== 'touch' || !this._map.isPermissionEdit())
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
		if (!this._tickMap)
			return false;

		var position = this._getParallelPos(point);
		position = position - this._position;

		var that = this;
		var result = null;
		this._tickMap.forEachGap(function(gap) {
			if (position >= gap.start && position < gap.end) {
				var resizeAreaStart = Math.max(gap.start, gap.end - 3);
				if (that.isHeaderSelected(gap.index)) {
					resizeAreaStart = gap.end - that._resizeHandleSize;
				}
				var isMouseOverResizeArea = (position > resizeAreaStart);
				result = {entry: gap, hit: isMouseOverResizeArea};
				return true;
			}
		});
		return result;
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

		var entry = undefined;
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
			this._lastMouseOverIndex = this._mouseOverEntry.index; // used by context menu
		}

		// cypress mobile emulation sometimes triggers resizing unintentionally.
		if (L.Browser.cypressTest)
			return false;

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
//			console.log('Header._setCanvasSizeImpl: _canvasWidth' + this._canvasWidth);
		}
		else if (property === 'height') {
			canvas.height = value * scale;
			if (!isCorner)
				this._canvasHeight = value;
//			console.log('Header._setCanvasSizeImpl: _canvasHeight' + this._canvasHeight);
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
			var startPos = parseInt(groupData.startPos) / this._map._docLayer._tilePixelScale;
			var endPos = parseInt(groupData.endPos) / this._map._docLayer._tilePixelScale;
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

	getHeaderZoomScale : function(lowerBound, upperBound) {
		if (typeof lowerBound === 'undefined' || lowerBound < 0)
			lowerBound = 0.5;
		if (typeof upperBound === 'undefined' || upperBound < 0)
			upperBound = 2.0;
		if (lowerBound > upperBound) {
			lowerBound = 0.5;
			upperBound = 2.0;
		}
		var zoomScale = this._map.getZoomScale(this._map.getZoom(),
			this._map.options.defaultZoom);
		return Math.min(Math.max(zoomScale, lowerBound), upperBound);
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

L.Control.Header.rowHeaderWidth = undefined;
L.Control.Header.colHeaderHeight = undefined;

/*
 * GapTickMap is a data structure for handling the dimensions of each
 * column/row in the column/row header.
 *
 * A "tick" is the position of the boundary between two cols/rows, a "gap" is
 * the space between two ticks - the position and width/height of a col/row.
 *
 * Data about ticks is 0-indexed: the first tick (top of row 1 / left of column A) is 0.
 *
 * Data about gaps is 1-indexed: The 1st gap (row 1 / column A) is 1, and spans
 * from tick 0 to tick 1.
 *
 * A GapTickMap is fed data coming from a 'viewrowcolumnheaders' UNO message.
 * That contains the position of some of the ticks. The rest of the tick positions
 * is extrapolated as follows:
 * - The first two ticks are assumed to be consecutive. This sets the size of
 *   the first gap.
 * - If the position of n-th tick is not explicit, then its position is the (n-1)-th tick plus
 *   the size of the last known gap.
 * - When a new tick position is defined, it resets the size of the last known gap
 *
 * All inputs received are given in tile pixels, and stored as such.
 * outputs are returned in CSS pixels.
 *
 * **NB.** CSS pixels are scaled (down) from the tile pixels by the a factor
 * from TileLayer - 2x for retina, 1x for non-retina.
 *
 * **NB.** twip to pixel mapping is made non-obvious by the need to ensure that
 * there are no cumulative rounding errors from TWIP heights to pixels. We have to
 * match the core here, so we just use pixels.
 */
L.Control.Header.GapTickMap = L.Class.extend({

	initialize: function (map, ticks) {

		var gapSize;
		this._ticks = [];

		// Sanitize input
		var knownTicks = [];
		for (var i in ticks) {
			// The field in the input data struct is called "text" but it's the
			// column/row index, as a string.
			// Idem for "size": it's the tick position in pixels, as a string
			knownTicks[ parseInt(ticks[i].text) ] = parseInt(ticks[i].size);
		}

		// This *assumes* the input is ordered - i.e. tick indexes only grow
		this._minTickIdx = parseInt(ticks[0].text);
		this._maxTickIdx = knownTicks.length - 1;
		this._startOffset = parseInt(ticks[0].size);
		this._tilePixelScale = map._docLayer._tilePixelScale;

		for (var idx=this._minTickIdx; idx <= this._maxTickIdx; idx++) {

			if (idx in knownTicks) {
				this._ticks[idx] = knownTicks[idx];
				gapSize = this._ticks[idx] - this._ticks[idx - 1];
			} else {
				if (isNaN(gapSize) || gapSize < 0) {
					// This should never happen, unless data from the UNO message
					// is not in strictly increasing order, or the first two ticks
					// are not consecutive.
					throw new Error('Malformed data for column/row sizes.');
				}
				this._ticks[idx] = this._ticks[idx - 1] + gapSize;
			}
		}
	},

	// Gets the position of the i-th tick (or `undefined` if the index falls outside).
	getTick: function getTick(i) {
		// to get CSS pixels we need to adjust for DPI scale
		// since we render at full native pixel resolution &
		// account in those units.
		return this._ticks[i] / this._tilePixelScale;
	},

	getStartOffset: function() {
		return this._startOffset / this._tilePixelScale;
	},

	getMinTickIdx: function() {
		return this._minTickIdx;
	},
	getMaxTickIdx: function() {
		return this._maxTickIdx;
	},

	// Gets the start and size of the i-th gap.
	// returns an Object of the form {index: i, pos: start, size: width/height },
	// or `undefined` if the index falls outside.
	getGap: function getGap(i) {
		var start = this.getTick(i-1);
		var end = this.getTick(i);

		if (start === undefined || end === undefined || isNaN(start) || isNaN(end)) {
			return undefined;
		}

		return {
			index: i,
			start: start,
			end: end,
			size: end - start,
			pos: end,
		};
	},

	// Returns true when the i-th gap has zero size.
	isZeroSize: function isZeroSize(i) {
		return this.getGap(i).size === 0;
	},

	// Runs the given callback function for each tick
	// The callback function receives two parameters: the tick index and the
	// (interpolated) tick position
	forEachTick: function forEachTick(callback) {
		for (var idx=this._minTickIdx; idx <= this._maxTickIdx; idx++) {
			if (callback(idx, this.getTick(idx)))
				break;
		}
	},

	// Runs the given callback function for each gap
	// The callback receives one parameter, in the same format as the return value
	// of getGap()
	forEachGap: function forEachGap(callback) {
		for (var idx=this._minTickIdx; idx < this._maxTickIdx; idx++) {
			if (callback(this.getGap(idx+1)))
				break;
		}
	},

});
