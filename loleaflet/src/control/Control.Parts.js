/*
 * L.Control.Zoom is used for the default zoom buttons on the map.
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

		this._parts = options.parts;
		this._currentPart = options.currentPart;
		this._updateDisabled();
		map.on('setpart', this._updateDisabled, this);

		return container;
	},

	_prevPart: function () {
		this._map.fire('prevpart');
		if (this._currentPart > 0) {
			this._currentPart -= 1;
		}
		this._updateDisabled();
	},

	_nextPart: function () {
		this._map.fire('nextpart');
		if (this._currentPart < this._parts - 1) {
			this._currentPart += 1;
		}
		this._updateDisabled();
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
		if (e) {
			this._currentPart = e.currentPart;
		}
		var className = 'leaflet-disabled';
		if (this._currentPart === 0) {
			L.DomUtil.addClass(this._prevPartButton, className);
		} else {
			L.DomUtil.removeClass(this._prevPartButton, className);
		}
		if (this._currentPart === this._parts - 1) {
			L.DomUtil.addClass(this._nextPartButton, className);
		} else {
			L.DomUtil.removeClass(this._nextPartButton, className);
		}
	}
});

L.Map.mergeOptions({
	partsControl: false
});

L.control.parts = function (options) {
	return new L.Control.Parts(options);
};
