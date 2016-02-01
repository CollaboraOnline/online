/*
 * L.Cursor blinking cursor.
 */

L.Cursor = L.Layer.extend({

	options: {
		opacity: 1
	},

	initialize: function (latlng, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
	},

	onAdd: function () {
		this._initLayout();
		this.update();
	},

	onRemove: function () {
		L.DomUtil.remove(this._container);
	},

	getEvents: function () {
		var events = {viewreset: this.update};

		return events;
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng) {
		var oldLatLng = this._latlng;
		this._latlng = L.latLng(latlng);
		this.update();
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	update: function () {
		if (this._container) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}
		return this;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-cursor');
		// a black rectangle
		this._cursor = L.DomUtil.create('div', 'blinking-cursor', this._container);

		L.DomEvent
			.disableClickPropagation(this._cursor)
			.disableScrollPropagation(this._container);

		if (this._container) {
			this.getPane().appendChild(this._container);
		}
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._container, pos);

		this._zIndex = pos.y + this.options.zIndexOffset;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	_updateOpacity: function () {
		var opacity = this.options.opacity;
		L.DomUtil.setOpacity(this._container, opacity);
	},

	setSize: function (size) {
		this._cursor.style.height = size.y + 'px';
		this._container.style.top = '-' + (this._container.clientHeight - size.y - 2) / 2 + 'px';
	}
});

L.cursor = function (latlng, options) {
	return new L.Cursor(latlng, options);
};

L.Cursor.imagePath = (function () {
	var scripts = document.getElementsByTagName('script'),
		leafletRe = /[\/^]leaflet[\-\._]?([\w\-\._]*)\.js\??/;

	var i, len, src, path;

	for (i = 0, len = scripts.length; i < len; i++) {
		src = scripts[i].src;

		if (src.match(leafletRe)) {
			path = src.split(leafletRe)[0];
			return (path ? path + '/' : '') + 'cursors';
		}
	}
}());

L.Cursor.getCustomCursor = function( cursorName ) {
	var customCursor,
		isCustomCursor = true,
		top = 0,
		left = 0;

	if ( cursorName === 'fill' ) {
		top = 16; left = 7;
	} else {
		isCustomCursor = false;
	}

	if (isCustomCursor) {
		customCursor = L.Browser.ie ? // IE10 does not like item with left/top position in the url list
			'url(' + L.Cursor.imagePath + '/' + cursorName + '.cur), default' :
			'url(' + L.Cursor.imagePath + '/' + cursorName + '.png) ' + left + ' ' + top + ', default';
	}
	return customCursor
};
