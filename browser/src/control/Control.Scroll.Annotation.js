/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.ScrollAnnotation
 */
/* global _ */
L.Control.ScrollAnnotation = L.Control.extend({
	options: {
		position: 'topright',
		arrowUp: '0x25b2',
		arrowUpTitle: _('Scroll up annotations'),
		arrowDown: '0x25bc',
		arrowDownTitle: _('Scroll down annotations')
	},

	onAdd: function (map) {
		var scrollName = 'leaflet-control-scroll',
		    container = L.DomUtil.create('div', 'cool-bar');

		this._map = map;

		this._buttonUp  = this._createButton(
		        this.options.arrowUp, this.options.arrowUpTitle,
		        scrollName + '-up',  container, this._onScrollUp,  this);
		this._buttonDown = this._createButton(
		        this.options.arrowDown, this.options.arrowDownTitle,
		        scrollName + '-down', container, this._onScrollDown, this);

		return container;
	},

	_onScrollUp: function () {
		this._map.fire('AnnotationScrollUp');
	},

	_onScrollDown: function () {
		this._map.fire('AnnotationScrollDown');
	},

	_createButton: function (html, title, className, container, fn, context) {
		var link = L.DomUtil.create('a', className, container);
		link.innerHTML = String.fromCharCode(html);
		link.href = '#';
		link.title = title;

		var stop = L.DomEvent.stopPropagation;

		L.DomEvent
		    .on(link, 'click', stop)
		    .on(link, 'mousedown', stop)
		    .on(link, 'dblclick', stop)
		    .on(link, 'click', L.DomEvent.preventDefault)
		    .on(link, 'click', fn, context);

		return link;
	}
});

L.control.scrollannotation = function (options) {
	return new L.Control.ScrollAnnotation(options);
};
