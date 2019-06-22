/* -*- js-indent-level: 8 -*- */
/*
 * L.Clipboard is used to abstract our storage and management of
 * local & remote clipboard data.
 */
/* global $ _ Uint8ClampedArray Uint8Array */
// Implement String::startsWith which is non-portable (Firefox only, it seems)
// See http://stackoverflow.com/questions/646628/how-to-check-if-a-string-startswith-another-string#4579228

// Store and handle clipboard content and download interactions in one place.
L.Clipboard = {
	initialize: function(map) {
		this._map = map;
		this._content = '';
	},

	stripHTML: function(html) { // grim.
		var tmp = document.createElement('div');
		tmp.innerHTML = html;
		return tmp.textContent || tmp.innerText || '';
	},

	clipboardSet: function(event, text) {
		if (event.clipboardData) { // Standard
			event.clipboardData.setData('text/html', text);
		}
		else if (window.clipboardData) { // IE 11 - poor clipboard API
			window.clipboardData.setData('Text', this.stripHTML(text));
		}
	},
});

L.clipboard = function(map) {
	return new L.Clipboard(map);
};
