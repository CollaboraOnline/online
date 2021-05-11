/* -*- js-indent-level: 8 -*- */
/*
 * L.IFrameDialog
 */

L.IFrameDialog = L.Class.extend({

	initialize: function (url, options) {
		L.setOptions(this, options);

		this._container = L.DomUtil.create('div', 'iframe-dialog-wrap', document.body);
		this._container.style.display = 'none';
		this._content = L.DomUtil.create('div', 'iframe-dialog-content', this._container);
		this._iframe = L.DomUtil.create('iframe', 'iframe-dialog-modal', this._content);
		this._iframe.id = 'iframe-feedback';

		console.debug('Getting co-bg-color: ');
		var cssVar = getComputedStyle(document.documentElement).getPropertyValue('--co-primary-element');
		console.debug(cssVar);
		cssVar = cssVar.replace(/\s/g, '');
		url += '?co-primary-element='+cssVar;
		this._iframe.src = url;
	},

	remove: function () {
		L.DomUtil.remove(this._container);
		this._iframe = this._content
			= this._container
			= this._urlFrame = null;
	},

	hasLoaded: function () {
		return document.body.querySelectors('.iframe-dialog-wrap');
	},

	show: function () {
		this._container.style.display = '';
	}
});

L.iframeDialog = function (url, options) {
	return new L.IFrameDialog(url, options);
};
