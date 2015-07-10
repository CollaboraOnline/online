/*
 * L.Control.Parts is used to switch parts
 */

L.Control.Parts = L.Control.extend({
	options: {
		position: 'topleft',
		prevPartText: '&#x25B2',
		prevPartTitle: 'Previous part',
		nextPartText: '&#x25BC',
		nextPartTitle: 'Next part'
	},

	onAdd: function (map) {
		var partName = 'leaflet-control-part',
		    container = L.DomUtil.create('div', partName + ' leaflet-bar'),
		    options = this.options;

		this._prevPartButton  = this._createButton(options.prevPartText, options.prevPartTitle,
		        partName + '-prev',  container, this._prevPart);
		this._nextPartButton = this._createButton(options.nextPartText, options.nextPartTitle,
		        partName + '-next', container, this._nextPart);

		map.on('updateparts', this._updateDisabled, this);
		return container;
	},

	_prevPart: function () {
		this._map.setPart('previous');
	},

	_nextPart: function () {
		this._map.setPart('next');
	},

	_createButton: function (html, title, className, container, fn) {
		var link = L.DomUtil.create('a', className, container);
		link.innerHTML = html;
		link.href = '#';
		link.title = title;

		L.DomEvent
		    .on(link, 'mousedown dblclick', L.DomEvent.stopPropagation)
		    .on(link, 'click', L.DomEvent.stop)
		    .on(link, 'click', fn, this)
		    .on(link, 'click', this._refocusOnMap, this);

		return link;
	},

	_updateDisabled: function (e) {
		var className = 'leaflet-disabled';
		if (e.currentPart === 0) {
			L.DomUtil.addClass(this._prevPartButton, className);
		} else {
			L.DomUtil.removeClass(this._prevPartButton, className);
		}
		if (e.currentPart === e.parts - 1) {
			L.DomUtil.addClass(this._nextPartButton, className);
		} else {
			L.DomUtil.removeClass(this._nextPartButton, className);
		}
	}
});

L.Map.mergeOptions({
	partsControl: true
});

L.Map.addInitHook(function () {
	this.partsControl = new L.Control.Parts();
	this.addControl(this.partsControl);
});


L.control.parts = function (options) {
	return new L.Control.Parts(options);
};
