/*
* Control.Header
*/

L.Control.Header = L.Control.extend({
	options: {
		cursor: 'col-resize'
	},

	initialize: function () {
		this._clicks = 0;
		this._current = -1;
		this._selection = {start: -1, end: -1};
	},

	mouseInit: function (element) {
		L.DomEvent.on(element, 'mousedown', this._onMouseDown, this);
	},

	select: function (item) {
		if (item && !L.DomUtil.hasClass(item, 'spreadsheet-header-selected')) {
			L.DomUtil.addClass(item, 'spreadsheet-header-selected');
		}
	},

	unselect: function (item) {
		if (item && L.DomUtil.hasClass(item, 'spreadsheet-header-selected')) {
			L.DomUtil.removeClass(item, 'spreadsheet-header-selected');
		}
	},

	clearSelection: function (element) {
		if (this._selection.start === -1 && this._selection.end === -1)
			return;
		var childs = element.children;
		var start = (this._selection.start === -1) ? 0 : this._selection.start;
		var end = this._selection.end + 1;
		for (var iterator = start; iterator < end; iterator++) {
			this.unselect(childs[iterator]);
		}

		this._selection.start = this._selection.end = -1;
		// after clearing selection, we need to select the header entry for the current cursor position,
		// since we can't be sure that the selection clearing is due to click on a cell
		// different from the one where the cursor is already placed
		this.select(childs[this._current]);
	},

	updateSelection: function(element, start, end) {
		var childs = element.children;
		var x0 = 0, x1 = 0;
		var itStart = -1, itEnd = -1;
		var selected = false;
		var iterator = 0;
		for (var len = childs.length; iterator < len; iterator++) {
			x0 = (iterator > 0 ? childs[iterator - 1].size : 0);
			x1 = childs[iterator].size;
			// 'start < x1' not '<=' or we get highlighted also the `start-row - 1` and `start-column - 1` headers
			if (x0 <= start && start < x1) {
				selected = true;
				itStart = iterator;
			}
			if (selected) {
				this.select(childs[iterator]);
			}
			if (x0 <= end && end <= x1) {
				itEnd = iterator;
				break;
			}
		}

		// if end is greater than the last fetched header position set itEnd to the max possible value
		// without this hack selecting a whole row and then a whole column (or viceversa) leads to an incorrect selection
		if (itStart !== -1 && itEnd === -1) {
			itEnd = childs.length - 1;
		}

		// we need to unselect the row (column) header entry for the current cell cursor position
		// since the selection could be due to selecting a whole row (column), so the selection
		// does not start by clicking on a cell
		if (this._current !== -1 && itStart !== -1 && itEnd !== -1) {
			if (this._current < itStart || this._current > itEnd) {
				this.unselect(childs[this._current]);
			}
		}
		if (this._selection.start !== -1 && itStart !== -1 && itStart > this._selection.start) {
			for (iterator = this._selection.start; iterator < itStart; iterator++) {
				this.unselect(childs[iterator]);
			}
		}
		if (this._selection.end !== -1 && itEnd !== -1 && itEnd < this._selection.end) {
			for (iterator = itEnd + 1; iterator <= this._selection.end; iterator++) {
				this.unselect(childs[iterator]);
			}
		}
		this._selection.start = itStart;
		this._selection.end = itEnd;
	},

	updateCurrent: function (element, start) {
		var childs = element.children;
		if (start < 0) {
			this.unselect(childs[this._current]);
			this._current = -1;
			return;
		}

		var x0 = 0, x1 = 0;
		for (var iterator = 0, len = childs.length; iterator < len; iterator++) {
			x0 = (iterator > 0 ? childs[iterator - 1].size : 0);
			x1 = childs[iterator].size;
			if (x0 <= start && start <= x1) {
				// when a whole row (column) is selected the cell cursor is moved to the first column (row)
				// but this action should not cause to select/unselect anything, on the contrary we end up
				// with all column (row) header entries selected but the one where the cell cursor was
				// previously placed
				if (this._selection.start === -1 && this._selection.end === -1) {
					this.unselect(childs[this._current]);
					this.select(childs[iterator]);
				}
				this._current = iterator;
				break;
			}
		}
	},

	_onMouseDown: function (e) {
		var target = e.target || e.srcElement;

		if (!target || this._dragging) {
			return false;
		}

		L.DomUtil.disableImageDrag();
		L.DomUtil.disableTextSelection();

		L.DomEvent.stopPropagation(e);
		L.DomEvent.on(document, 'mousemove', this._onMouseMove, this);
		L.DomEvent.on(document, 'mouseup', this._onMouseUp, this);

		var rect = target.parentNode.getBoundingClientRect();
		this._start = new L.Point(rect.left, rect.top);
		this._offset = new L.Point(rect.right - e.clientX, rect.bottom - e.clientY);
		this._item = target;

		this.onDragStart(this.item, this._start, this._offset, e);
	},

	_onMouseMove: function (e) {
		this._dragging = true;
		L.DomEvent.preventDefault(e);

		var target = e.target || e.srcElement;
		if (target.style.cursor !== this.options.cursor &&
		   (L.DomUtil.hasClass(target, 'spreadsheet-header-column-text') ||
		    L.DomUtil.hasClass(target, 'spreadsheet-header-row-text'))) {
			target.style.cursor = this.options.cursor;
		}

		this.onDragMove(this._item, this._start, this._offset, e);
	},

	_onMouseUp: function (e) {
		L.DomEvent.off(document, 'mousemove', this._onMouseMove, this);
		L.DomEvent.off(document, 'mouseup', this._onMouseUp, this);

		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

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
	onDragClick: function () {}
});
