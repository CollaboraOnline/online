/* -*- js-indent-level: 8 -*- */
/*
 * L.IFrameDialog
 */

L.IFrameDialog = L.Class.extend({

	options: {
		prefix: 'iframe-none',
		method: 'get'
	},

	initialize: function (url, params, element, options) {
		var content, form;

		this._loading = false;
		L.setOptions(this, options);

		this._container = L.DomUtil.create('div', this.options.prefix + '-wrap');
		this._container.style.display = 'none';

		content = L.DomUtil.create('div', this.options.prefix + '-content', this._container);
		form = L.DomUtil.create('form', '', content);

		this.fillParams(url, params, form);

		this._iframe = L.DomUtil.create('iframe', this.options.prefix + '-modal', content);
		this._iframe.name = form.target;

		if (this.options.id) {
			this._iframe.id = this.options.id;
		}

		if (element) {
			document.body.insertBefore(this._container, element);
		} else {
			document.body.appendChild(this._container);
		}

		form.submit();
		this._iframe.addEventListener('load', L.bind(this.onLoad, this));
	},

	fillParams: function (url, params, form) {
		var input, keys;
		form.action = url;
		form.target = this.options.prefix + '-form';
		form.method = this.options.method;

		for (var item in params) {
			keys = Object.keys(params[item]);
			if (keys.length > 0) {
				input = L.DomUtil.create('input', '', form);
				input.type = 'hidden';
				input.name = String(keys[0]);
				input.value = String(params[item][keys[0]]);
			}
		}
	},

	onLoad: function () {
		var msg = this.options.prefix + '-load';
		var that = this;
		this._loading = true;
		setTimeout(function () {
			if (!that.isVisible()) {
				window.postMessage(msg);
			}
		}, 500);
	},

	remove: function () {
		L.DomEvent.off(this._iframe, 'load', this.onLoad, this);
		L.DomUtil.remove(this._container);
		this._container = this._iframe = null;
	},

	hasLoaded: function () {
		return this.queryContainer() && this._loading;
	},

	queryContainer: function () {
		return document.body.querySelector('.' + this.options.prefix + '-wrap');
	},

	isVisible: function () {
		var elem = this.queryContainer();
		return elem && elem.style.display !== 'none';
	},

	show: function () {
		this._container.style.display = '';
	}
});

L.iframeDialog = function (url, params, element, options) {
	return new L.IFrameDialog(url, params, element, options);
};
