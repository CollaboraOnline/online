/* -*- js-indent-level: 8 -*- */
/*
 * L.IDialog
 */

L.IDialog = L.Class.extend({
	statics: {
		container: {},

		open: function (options) {
			var container, content;

			container = L.DomUtil.create('div', options.prefix + '-wrap');
			content = L.DomUtil.create('div', options.prefix + '-content', container);
			content.innerHTML = L.IDialog.innerHtml(options.message);
			document.body.appendChild(container);
			L.IDialog.container = container;
		},

		innerHtml: function (string) {
			if (typeof string === 'undefined')
				return '';

			var elem = L.DomUtil.create('div', '');
			elem.appendChild(document.createTextNode(string));
			return elem.innerHTML;
		},

		isVisible: function () {
			return L.IDialog.container && L.IDialog.container.parentNode == document.body;
		}
	}
});

