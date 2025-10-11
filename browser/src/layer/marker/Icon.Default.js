/* -*- js-indent-level: 8 -*- */
/*
 * window.L.Icon.Default is the blue marker icon used by default in Leaflet.
 */

window.L.Icon.Default = window.L.Icon.extend({

	options: {
		iconSize:    [25, 41],
		iconAnchor:  [12, 41],
		popupAnchor: [1, -34],
		shadowSize:  [41, 41]
	},

	_getIconUrl: function (name) {
		var key = name + 'Url';

		if (this.options[key]) {
			return this.options[key];
		}

		var path = window.L.Icon.Default.imagePath;

		if (!path) {
			throw new Error('Couldn\'t autodetect window.L.Icon.Default.imagePath, set it manually.');
		}

		return path + '/marker-' + name + (window.L.Browser.retina && name === 'icon' ? '-2x' : '') + '.png';
	}
});

window.L.Icon.Default.imagePath = (function () {
	var scripts = document.getElementsByTagName('script'),
	    leafletRe = /[\/^]cool/;

	var i, len, src, path;
	for (i = 0, len = scripts.length; i < len; i++) {
		src = scripts[i].src;
		if (src.match(leafletRe)) {
			path = src.substring(0, src.lastIndexOf('/'));
			return (path ? path + '/' : '') + 'images';
		}
	}
}());
