/* -*- js-indent-level: 8 -*- */
/*
 * L.IDialog
 */

L.IDialog = L.Class.extend({
	options: {
		prefix: 'idialog'
	},

	show: function (options) {
		var container, content;

		container = L.DomUtil.create('div', this.options.prefix + '-wrap');
		content = L.DomUtil.create('div', this.options.prefix + '-content', container);
		content.innerHTML = this.innerHtml(options.message);
		document.body.appendChild(container);
	},

	innerHtml: function (string) {
		if (typeof string === 'undefined')
			return '';

		var elem = L.DomUtil.create('div', '');
		elem.appendChild(document.createTextNode(string));
		return elem.innerHTML;
	},

	isVisible: function () {
		var elem = document.body.querySelector('.' + this.options.prefix + '-wrap');
		return elem && elem.style.display !== 'none';
	}
});

L.iDialog = function (options) {
	return new L.IDialog(options);
};

