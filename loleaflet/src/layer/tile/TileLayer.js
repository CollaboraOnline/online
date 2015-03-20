/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

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
	},

	_initDocument: function () {
		if (!this._map.socket) {
			console.log('Socket initialization error');
			return;
		}
		if (this.options.doc) {
			this._map.socket.send('load ' + this.options.doc);
		}
		this._update();
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

		tile.src = 'http://i387.photobucket.com/albums/oo316/barkse90/Cartman-Cop-head-256x256.png';

		return tile;
	},

	_onMessage: function (evt) {
		if (typeof(evt.data) === 'string') {
			var info = this._getTileInfo(evt.data);
			if (info.width && info.height) {
				var docPixelLimits = new L.Point(info.height / this._tileHeightTwips,
												 info.width / this._tileWidthTwips);
				docPixelLimits = docPixelLimits.multiplyBy(this._tileSize);

				var topLeft = this._map.unproject([0, 0]);
				var bottomRight = this._map.unproject([docPixelLimits.y, docPixelLimits.x]);
				var maxBounds = new L.LatLngBounds(topLeft, bottomRight);
                this._map.setMaxBounds(maxBounds);
			}
		}
		else if (typeof(evt.data) === 'object') {
			var bytes = new Uint8Array(evt.data);
			var index = 0;
			// search for the first newline which marks the end of the message
			while (index < bytes.length && bytes[index] !== 10) {
				index++;
			}
			var textMsgBytes = bytes.subarray(0, index + 1);
			var info = this._getTileInfo(String.fromCharCode.apply(null, textMsgBytes));
			var coords = this._twipsToCoords(new L.Point(info.x, info.y));
			coords.z = this._map.getZoom();
			var data = bytes.subarray(index + 1);
			var done = L.bind(this._tileReady, this, coords);

			var tile = document.createElement('img');
			tile.onload = L.bind(this._tileOnLoad, this, done, tile);
			tile.onerror = L.bind(this._tileOnError, this, done, tile);
			tile.alt = '';
			tile.src = 'data:image/png;base64,' + window.btoa(String.fromCharCode.apply(null, data));
			this._handleTile(tile, coords);
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
		var info = new Object();
		for (var i = 0; i < tokens.length; i++) {
			if (tokens[i].substring(0,9) === 'tileposx=')
				info.x = parseInt(tokens[i].substring(9));
			if (tokens[i].substring(0,9) === 'tileposy=')
				info.y = parseInt(tokens[i].substring(9));
			if (tokens[i].substring(0,10) === 'tilewidth=')
				info.tilewidth = parseInt(tokens[i].substring(10));
			if (tokens[i].substring(0,11) === 'tileheight=')
				info.tileheight = parseInt(tokens[i].substring(11));
			if (tokens[i].substring(0,6) === 'width=')
				info.width = parseInt(tokens[i].substring(6));
			if (tokens[i].substring(0,7) === 'height=')
				info.height = parseInt(tokens[i].substring(7));
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
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};
