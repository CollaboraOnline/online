/* -*- js-indent-level: 8 -*- */
/*
 * L.IFrameDialog
 */

L.IFrameDialog = L.Class.extend({

	options: {
		prefix: 'iframe-none',
		method: 'get'
	},

	initialize: function (url, options) {
		L.setOptions(this, options);

		this._container = L.DomUtil.create('div', this.options.prefix + '-wrap', document.body);
		this._container.style.display = 'none';
		this._content = L.DomUtil.create('div', this.options.prefix + '-content', this._container);
		this._iframe = L.DomUtil.create('iframe', this.options.prefix + '-modal', this._content);

		if (this.options.id) {
			this._iframe.id = this.options.id;
		}

		this._iframe.src = url;
	},

	remove: function () {
		L.DomUtil.remove(this._container);
		this._iframe = this._content
			= this._container
			= this._urlFrame = null;
	},

	hasLoaded: function () {
		return document.body.querySelector('.' + this.options.prefix + '-wrap');
	},

	show: function () {
		this._container.style.display = '';
	}
});

L.iframeDialog = function (url, options) {
	return new L.IFrameDialog(url, options);
};
