/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.ContextToolbar.
 */

L.Control.ContextToolbar = L.Control.extend({
	options: {
		position: 'topleft',
		item: ''
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function () {
		if (!this._container) {
			this._initLayout();
		}
		if (this.options.item === 'paste') {
			this._paste.style.display = '';
			this._cut.style.display = 'none';
			this._copy.style.display = 'none';
		}

		this._container.style.visibility = 'hidden';
		return this._container;
	},

	onRemove: function () {
		this._paste.style.display = '';
		this._cut.style.display = '';
		this._copy.style.display = '';
		this.options.item = '';
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'loleaflet-context-toolbar');

		var tagTd = 'td',
		    onUp = 'mouseup',
		    onDown = 'mousedown',
		    stopEvents = 'touchstart touchmove touchend mousedown mousemove mouseout mouseover mouseup mousewheel click scroll',
		    container = L.DomUtil.create('table', 'loleaflet-context-table', this._container),
		    tbody = L.DomUtil.create('tbody', '', container),
		    tr = L.DomUtil.create('tr', '', tbody);

		this._cut = L.DomUtil.create(tagTd, 'loleaflet-context-button loleaflet-context-cut', tr);
		L.DomEvent.on(this._cut, stopEvents,  L.DomEvent.stopPropagation)
			.on(this._cut, onDown, this.onMouseDown, this)
			.on(this._cut, onUp, this.onMouseUp, this);
		this._copy = L.DomUtil.create(tagTd, 'loleaflet-context-button loleaflet-context-copy', tr);
		L.DomEvent.on(this._copy, stopEvents,  L.DomEvent.stopPropagation)
			.on(this._copy, onDown, this.onMouseDown, this)
			.on(this._copy, onUp, this.onMouseUp, this);
		this._paste = L.DomUtil.create(tagTd, 'loleaflet-context-button loleaflet-context-paste', tr);
		L.DomEvent.on(this._paste, stopEvents,  L.DomEvent.stopPropagation)
			.on(this._paste, onDown, this.onMouseDown, this)
			.on(this._paste, onUp, this.onMouseUp, this);
	},

	onAdded: function () {
		if (this._pos) {
			var maxBounds = this._map.getPixelBounds();
			var size = L.point(this._container.clientWidth,this._container.clientHeight);
			this._pos._add(L.point(-size.x / 2, -size.y));
			var bounds = new L.Bounds(this._pos, this._pos.add(size));
			if (!maxBounds.contains(bounds)) {
				var offset = L.point(0, 0);
				if (bounds.max.x > maxBounds.max.x) {
					offset.x = size.x;
				}

				if (bounds.max.y > maxBounds.max.y) {
					offset.y = size.y;
				}
				this._pos._subtract(offset);
			}
			L.DomUtil.setPosition(this._container, this._pos);
		}
		this._container.style.visibility = '';
	},

	onMouseDown: function (e) {
		L.DomUtil.addClass(e.target || e.srcElement, 'loleaflet-context-down');
		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
	},

	onMouseUp: function (e) {
		var target = e.target || e.srcElement;

		if (L.DomUtil.hasClass(target, 'loleaflet-context-cut')) {
			this._map._socket.sendMessage('uno .uno:Cut');
		}
		else if (L.DomUtil.hasClass(target, 'loleaflet-context-copy')) {
			this._map._socket.sendMessage('uno .uno:Copy');
		}
		else if (L.DomUtil.hasClass(target, 'loleaflet-context-paste')) {
			this._map._socket.sendMessage('uno .uno:Paste');
		}

		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
		setTimeout(L.bind(this.onClick, this, target), 0);
	},

	onClick: function (e) {
		L.DomUtil.removeClass(e, 'loleaflet-context-down');
		this.remove();
	}
});

L.control.contextToolbar = function (options) {
	return new L.Control.ContextToolbar(options);
};
