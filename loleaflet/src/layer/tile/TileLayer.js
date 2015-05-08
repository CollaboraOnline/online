/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

// Implement String::startsWith which is non-portable (Firefox only, it seems)
// See http://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string#4579228

if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.slice(0, str.length) == str;
  };
}

L.TileLayer = L.GridLayer.extend({

	options: {
		maxZoom: 18,

		subdomains: 'abc',
		errorTileUrl: '',
		zoomOffset: 0,

		maxNativeZoom: null, // Number
		tms: false,
		zoomReverse: false,
		detectRetina: false,
		crossOrigin: false
	},

	initialize: function (url, options) {

		this._url = url;

		options = L.setOptions(this, options);

		// detecting retina displays, adjusting tileSize and zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {

			options.tileSize = Math.floor(options.tileSize / 2);
			options.zoomOffset++;

			options.minZoom = Math.max(0, options.minZoom);
			options.maxZoom--;
		}

		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}

		// for https://github.com/Leaflet/Leaflet/issues/137
		if (!L.Browser.android) {
			this.on('tileunload', this._onTileRemove);
		}
		this._documentInfo = '';
	},

	_initDocument: function () {
		if (!this._map.socket) {
			console.log('Socket initialization error');
			return;
		}
		if (this.options.doc) {
			this._map.socket.send('load url=' + this.options.doc);
			this._map.socket.send('status');
		}
		this._map._scrollContainer.onscroll = L.bind(this._onScroll, this);
		this._map.on('zoomend', this._updateScrollOffset, this);
		this._map.on('searchprev searchnext', this._search, this);
		this._map.on('clearselection', this._clearSelections, this);
		this._map.on('mousedown mouseup mouseover mouseout mousemove',
				this._onMouseEvent, this);
	},

	setUrl: function (url, noRedraw) {
		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	},

	createTile: function (coords, done) {
		var tile = document.createElement('img');

		tile.onload = L.bind(this._tileOnLoad, this, done, tile);
		tile.onerror = L.bind(this._tileOnError, this, done, tile);

		if (this.options.crossOrigin) {
			tile.crossOrigin = '';
		}

		/*
		 Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
		 http://www.w3.org/TR/WCAG20-TECHS/H67
		*/
		tile.alt = '';

		tile.src = '';

		return tile;
	},

	_onMessage: function (evt) {
		var bytes, index, textMsg;

		if (typeof (evt.data) === 'string') {
			textMsg = evt.data;
		}
		else if (typeof (evt.data) === 'object') {
			bytes = new Uint8Array(evt.data);
			index = 0;
			// search for the first newline which marks the end of the message
			while (index < bytes.length && bytes[index] !== 10) {
				index++;
			}
			textMsg = String.fromCharCode.apply(null, bytes.subarray(0, index + 1));
		}

		if (textMsg.startsWith('status')) {
			var info = this._getTileInfo(textMsg);
			if (info.width && info.height && this._documentInfo !== textMsg) {
				this._docWidthTwips = info.width;
				this._docHeightTwips = info.height;
				this._updateMaxBounds();
				this._documentInfo = evt.data;
				this._update();
			}
		}
		else if (textMsg.startsWith('tile')) {
			var info = this._getTileInfo(textMsg);
			var coords = this._twipsToCoords(new L.Point(info.x, info.y));
			coords.z = info.zoom;
			var data = bytes.subarray(index + 1);

			var key = this._tileCoordsToKey(coords);
			var tile = this._tiles[key];
			if (tile) {
				tile.el.src = 'data:image/png;base64,' + window.btoa(String.fromCharCode.apply(null, data));
			}
		}
		else if (textMsg.startsWith('search')) {
			// TODO update protocol
			this._clearSelections();
			this._searchIndex = 0;
			this._searchResults = [];
		}
	},

	_tileOnLoad: function (done, tile) {
		done(null, tile);
	},

	_tileOnError: function (done, tile, e) {
		var errorUrl = this.options.errorTileUrl;
		if (errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	},

	_getTileSize: function () {
		var map = this._map,
		    options = this.options,
		    zoom = this._tileZoom + options.zoomOffset,
		    zoomN = options.maxNativeZoom;

		// increase tile size when overscaling
		return zoomN !== null && zoom > zoomN ?
				Math.round(options.tileSize / map.getZoomScale(zoomN, zoom)) :
				options.tileSize;
	},

	_getTileInfo: function (msg) {
		var tokens = msg.split(' ');
		var info = {};
		for (var i = 0; i < tokens.length; i++) {
			if (tokens[i].substring(0, 9) === 'tileposx=') {
				info.x = parseInt(tokens[i].substring(9));
			}
			if (tokens[i].substring(0, 9) === 'tileposy=') {
				info.y = parseInt(tokens[i].substring(9));
			}
			if (tokens[i].substring(0, 10) === 'tilewidth=') {
				info.tileWidth = parseInt(tokens[i].substring(10));
			}
			if (tokens[i].substring(0, 11) === 'tileheight=') {
				info.tileHeight = parseInt(tokens[i].substring(11));
			}
			if (tokens[i].substring(0, 6) === 'width=') {
				info.width = parseInt(tokens[i].substring(6));
			}
			if (tokens[i].substring(0, 7) === 'height=') {
				info.height = parseInt(tokens[i].substring(7));
			}
		}
		if (info.tileWidth && info.tileHeight) {
			var scale = info.tileWidth / this.options.tileWidthTwips;
			// scale = 1.2 ^ (10 - zoom)
			// zoom = 10 -log(scale) / log(1.2)
			info.zoom = Math.round(10 - Math.log(scale) / Math.log(1.2));
		}
		return info;
	},

	_onTileRemove: function (e) {
		e.tile.onload = null;
	},

	_getZoomForUrl: function () {

		var options = this.options,
		    zoom = this._tileZoom;

		if (options.zoomReverse) {
			zoom = options.maxZoom - zoom;
		}

		zoom += options.zoomOffset;

		return options.maxNativeZoom ? Math.min(zoom, options.maxNativeZoom) : zoom;
	},

	_getSubdomain: function (tilePoint) {
		var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
		return this.options.subdomains[index];
	},

	// stops loading all tiles in the background layer
	_abortLoading: function () {
		var i, tile;
		for (i in this._tiles) {
			tile = this._tiles[i].el;

			tile.onload = L.Util.falseFn;
			tile.onerror = L.Util.falseFn;

			if (!tile.complete) {
				tile.src = L.Util.emptyImageUrl;
				L.DomUtil.remove(tile);
			}
		}
	},

	_search: function (e) {
		if (e.type === 'searchprev') {
			if (this._searchIndex > 0) {
				this._searchIndex -= 1;
				// scrollTo searchResults[searchIndex]
				if (this._searchIndex === 0) {
					this._map.fire('disablesearchprev');
				}
			}
			this._map.fire('enablesearchnext');
		}
		else if (e.type === 'searchnext') {
			if (this._searchIndex < this._searchResults.length - 1) {
				this._searchIndex += 1;
				// scrollTo searchResults[searchIndex]
				if (this._searchIndex === this._searchResults.length - 1) {
					this._map.fire('disablesearchnext');
				}
			}
			this._map.fire('enablesearchprev');
		}
	},

	_clearSelections: function () {
		this._selections.clearLayers();
		this._searchResults = [];
		this._searchIndex = 0;
	},

	_onMouseEvent: function (e) {
		if (e.type === 'mousedown') {
			this._selecting = true;
			this._clearSelections();
			//this._map.socket.send('selecttext type=reset x=0 y=0');
			var selectionStart = this._latLngToTwips(e.latlng);
			//this._map.socket.send('selecttext type=start ' +
			//		'x=' + selectionStart.x + ' ' +
			//		'y=' + selectionStart.y);
		}
		else if (e.type === 'mouseup') {
			this._selecting = false;
		}
		else if (e.type === 'mousemove' && this._selecting) {
			var selectionEnd = this._latLngToTwips(e.latlng);
			//this._map.socket.send('selecttext type=end ' +
			//		'x=' + selectionEnd.x + ' ' +
			//		'y=' + selectionEnd.y);
		}
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
