/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.ContextToolbar.
 */

L.Control.ContextToolbar = L.Control.extend({
	options: {
		position: 'topleft'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function () {
		if (!this._container) {
			this._initLayout();
		}
		if (this._pos) {
			var maxBounds = this._map.getPixelBounds();
			var size = new L.Point(this._container.clientWidth,this._container.clientHeight);
			var bounds = new L.Bounds(this._pos, this._pos.add(size));
			if (!maxBounds.contains(bounds)) {
				this._pos._subtract(new L.Point(bounds.max.x - maxBounds.max.x, bounds.max.y - maxBounds.max.y));
			}
			L.DomUtil.setPosition(this._container, this._pos);
		}
		return this._container;
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

		var cut = L.DomUtil.create(tagTd, 'loleaflet-context-button loleaflet-context-cut', tr);
		L.DomEvent.on(cut, stopEvents,  L.DomEvent.stopPropagation)
			.on(cut, onDown, this.onMouseDown, this)
			.on(cut, onUp, this.onMouseUp, this);
		var copy = L.DomUtil.create(tagTd, 'loleaflet-context-button loleaflet-context-copy', tr);
		L.DomEvent.on(copy, stopEvents,  L.DomEvent.stopPropagation)
			.on(copy, onDown, this.onMouseDown, this)
			.on(copy, onUp, this.onMouseUp, this);
		var paste = L.DomUtil.create(tagTd, 'loleaflet-context-button loleaflet-context-paste', tr);
		L.DomEvent.on(paste, stopEvents,  L.DomEvent.stopPropagation)
			.on(paste, onDown, this.onMouseDown, this)
			.on(paste, onUp, this.onMouseUp, this);
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
