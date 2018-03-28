/*
 * L.Cursor blinking cursor.
 */

L.Cursor = L.Layer.extend({

	options: {
		opacity: 1,
		zIndex: 1000
	},

	initialize: function (latlng, size, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this._size = L.point(size);
		this._initLayout();
	},

	onAdd: function (map) {
		this._map = map;

		if (!this._container) {
			this._initLayout();
		}

		this.update();
		this.getPane().appendChild(this._container);

		if (this._textArea && !this._map._textArea) {
			this._map._textArea = this._textArea;

			L.DomEvent['off'](this._textArea, 'copy cut paste keydown keypress keyup compositionstart compositionupdate compositionend textInput', this._map._handleDOMEvent, this._map);
			L.DomEvent['on'](this._textArea, 'copy cut paste keydown keypress keyup compositionstart compositionupdate compositionend textInput', this._map._handleDOMEvent, this._map);

			this._textArea.focus();
		}
	},

	onRemove: function () {
		if (this._container) {
			this.getPane().removeChild(this._container);
		}
	},

	getEvents: function () {
		var events = {viewreset: this.update};

		return events;
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng, size) {
		var oldLatLng = this._latlng;
		this._latlng = L.latLng(latlng);
		this._size = L.point(size);
		this.update();
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	update: function () {
		if (this._container && this._map) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setSize();
			this._setPos(pos);
		}
		return this;
	},

	setOpacity: function (opacity) {
		if (this._container) {
			L.DomUtil.setOpacity(this._cursor, opacity);
		}
	},

	show: function() {
		L.DomUtil.setStyle(this._container, 'visibility', 'visible');
		if (this._textArea)
			this._textArea.focus();
	},

	hide: function() {
		L.DomUtil.setStyle(this._container, 'visibility', 'hidden');
	},

	showCursorHeader: function() {
		if (this._cursorHeader) {
			L.DomUtil.setStyle(this._cursorHeader, 'visibility', 'visible');

			clearTimeout(this._blinkTimeout);
			this._blinkTimeout = setTimeout(L.bind(function() {
				L.DomUtil.setStyle(this._cursorHeader, 'visibility', 'hidden');
			}, this), this.options.headerTimeout);
		}
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-cursor-container');
		if (this.options.header) {
			this._cursorHeader = L.DomUtil.create('div', 'leaflet-cursor-header', this._container);

			this._cursorHeader.innerHTML = this.options.headerName;

			clearTimeout(this._blinkTimeout);
			this._blinkTimeout = setTimeout(L.bind(function() {
				L.DomUtil.setStyle(this._cursorHeader, 'visibility', 'hidden');
			}, this), this.options.headerTimeout);
		}
		this._cursor = L.DomUtil.create('div', 'leaflet-cursor', this._container);
		if (this.options.blink) {
			L.DomUtil.addClass(this._cursor, 'blinking-cursor');
		}

		if (this.options.color) {
			L.DomUtil.setStyle(this._cursorHeader, 'background', this.options.color);
			L.DomUtil.setStyle(this._cursor, 'background', this.options.color);
		}

		L.DomEvent
			.disableClickPropagation(this._cursor)
			.disableScrollPropagation(this._container);

		if (this.options.clipboard) {
			var textAreaContainer = L.DomUtil.create('div', 'clipboard-container', this._container);
			textAreaContainer.id = 'doc-clipboard-container';
			this._textArea = L.DomUtil.create('input', 'clipboard', textAreaContainer);
			this._textArea.setAttribute('type', 'text');
			this._textArea.setAttribute('autocorrect', 'off');
			this._textArea.setAttribute('autocapitalize', 'off');
			this._textArea.setAttribute('autocomplete', 'off');
			this._textArea.setAttribute('spellcheck', 'false');
		}
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._container, pos);
		this._container.style.zIndex = this.options.zIndex;
	},

	_setSize: function () {
		this._cursor.style.height = this._size.y + 'px';
		this._container.style.top = '-' + (this._container.clientHeight - this._size.y - 2) / 2 + 'px';
	}
});

L.cursor = function (latlng, size, options) {
	return new L.Cursor(latlng, size, options);
};

L.Cursor.getCursorURL = function (localPath) {
	var scripts = document.getElementsByTagName('script'),
	    leafletRe = /[\/^]leaflet[\-\._]?([\w\-\._]*)\.js\??/;

	var i, len, src, path;

	for (i = 0, len = scripts.length; i < len; i++) {
		src = scripts[i].src;

		if (src.match(leafletRe)) {
			path = src.split(leafletRe)[0];
			return (path ? path + '/' : '') + localPath;
		}
	}
};

L.Cursor.hotSpot = {
	fill: {x: 7, y: 16}
};

L.Cursor.customCursors = [
	'fill'
];

L.Cursor.isCustomCursor = function (cursorName) {
	return (L.Cursor.customCursors.indexOf(cursorName) !== -1);
};

L.Cursor.getCustomCursor = function (cursorName) {
	var customCursor;

	if (L.Cursor.isCustomCursor(cursorName)) {
		var cursorHotSpot = L.Cursor.hotSpot[cursorName] || {x: 0, y: 0};
		customCursor = L.Browser.ie ? // IE10 does not like item with left/top position in the url list
			'url(' + L.Cursor.imagePath + '/' + cursorName + '.cur), default' :
			'url(' + L.Cursor.imagePath + '/' + cursorName + '.png) ' + cursorHotSpot.x + ' ' + cursorHotSpot.y + ', default';
	}
	return customCursor;
};
