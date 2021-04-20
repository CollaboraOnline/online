/* -*- js-indent-level: 8 -*- */
/*
 * L.IFrameDialog
 */

L.IFrameDialog = L.Class.extend({

	initialize: function (url, options) {
		L.setOptions(this, options);
		this._url = url;
	},

	create: function () {
		this._container = L.DomUtil.create('div', 'iframe-dialog-wrap', document.body);
		this._content = L.DomUtil.create('div', 'iframe-dialog-content', this._container);
		this._iframe = L.DomUtil.create('iframe', 'iframe-dialog-modal', this._content);
		this._iframe.src = this._url;
	},

	remove: function () {
		L.DomUtil.remove(this._container);
		this._iframe = this._content
			= this._container
			= this._urlFrame = null;
	},

	hasOpened: function () {
		var elems = document.body.querySelector('iframe-dialog-wrap');
		return elems.length > 0;
	},

});

L.iframeDialog = function (url, options) {
	return new L.IFrameDialog(url, options);
};
