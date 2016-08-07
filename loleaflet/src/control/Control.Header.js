/*
* Control.Header
*/

L.Control.Header = L.Control.extend({
	options: {
		cursor: 'col-resize'
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

		var rectangle = target.parentNode.getBoundingClientRect();
		this._item = target;
		this._start = new L.Point(rectangle.left, rectangle.top);
		this._end = new L.Point(e.clientX, e.clientY);

		this.onDragStart(this.item, this._start, this._end);
	},

	_onMouseMove: function (e) {
		this._end = new L.Point(e.clientX, e.clientY);
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

		this.onDragMove(this._item, this._start, this._end);
	},

	_onMouseUp: function (e) {
		this._end = new L.Point(e.clientX, e.clientY);

		if (this._target) {
			this._target.style.cursor = this._oldCursor;
		}

		L.DomEvent.off(document, 'mousemove', this._onMouseMove, this);
		L.DomEvent.off(document, 'mouseup', this._onMouseUp, this);

		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		this.onDragEnd(this._item, this._start, this._end);
		this._target = this._cursor = this._item = this._start = this._end = null;
		this._dragging = false;
	},

	onDragStart: function () {},
	onDragMove: function () {},
	onDragEnd: function () {}
});
