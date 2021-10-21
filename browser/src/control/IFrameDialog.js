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
		var content, form, iframe;

		L.setOptions(this, options);

		this._container = L.DomUtil.create('div', this.options.prefix + '-wrap');
		this._container.style.display = 'none';

		content = L.DomUtil.create('div', this.options.prefix + '-content', this._container);
		form = L.DomUtil.create('form', '', content);

		this.fillParams(url, params, form);

		iframe = L.DomUtil.create('iframe', this.options.prefix + '-modal', content);
		iframe.name = form.target;

		if (this.options.id) {
			iframe.id = this.options.id;
		}

		if (element) {
			document.body.insertBefore(this._container, element);
		} else {
			document.body.appendChild(this._container);
		}

		form.submit();
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

	remove: function () {
		L.DomUtil.remove(this._container);
		this._container = null;
	},

	hasLoaded: function () {
		return this.queryContainer();
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
