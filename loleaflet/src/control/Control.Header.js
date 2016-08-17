/*
* Control.Header
*/

L.Control.Header = L.Control.extend({
	options: {
		cursor: 'col-resize'
	},

	initialize: function () {
		this._clicks = 0;
	},

	mouseInit: function (element) {
		L.DomEvent.on(element, 'mousedown', this._onMouseDown, this);
	},

	_onMouseDown: function (e) {
		var target = e.target || e.srcElement;

		if (!target || this._dragging) {
			return false;
		}

		L.DomUtil.disableImageDrag();
		L.DomUtil.disableTextSelection();

		L.DomEvent.stopPropagation(e);
		L.DomEvent.on(document, 'mousemove', this._onMouseMove, this)
		L.DomEvent.on(document, 'mouseup', this._onMouseUp, this);

		var rect = target.parentNode.getBoundingClientRect();
		this._start = new L.Point(rect.left, rect.top);
		this._offset = new L.Point(rect.right - e.clientX, rect.bottom - e.clientY);
		this._item = target;

		this.onDragStart(this.item, this._start, this._offset, e);
	},

	_onMouseMove: function (e) {
		this._dragging = true;

		var target = e.target || e.srcElement;
		if ((L.DomUtil.hasClass(target, 'spreadsheet-header-column-text') ||
		     L.DomUtil.hasClass(target, 'spreadsheet-header-row-text')) &&
		    target.style.cursor != this.options.cursor) {
			this._cursor = target.style.cursor;
			this._target = target;
			target.style.cursor = this.options.cursor;
		}

		L.DomEvent.preventDefault(e);

		this.onDragMove(this._item, this._start, this._offset, e);
	},

	_onMouseUp: function (e) {
		if (this._target) {
			this._target.style.cursor = this._oldCursor;
		}

		L.DomEvent.off(document, 'mousemove', this._onMouseMove, this);
		L.DomEvent.off(document, 'mouseup', this._onMouseUp, this);

		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		if (this._dragging) {
			this.onDragEnd(this._item, this._start, this._offset, e);
			this._clicks = 0;
		} else {
			this.onDragClick(this._item, ++this._clicks, e);
			setTimeout(L.bind(this.initialize, this), 200);
		}

		this._target = this._cursor = this._item = this._start = this._offset = null;
		this._dragging = false;
	},

	onDragStart: function () {},
	onDragMove: function () {},
	onDragEnd: function () {},
	onDragClick: function () {}
});
