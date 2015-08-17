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
		map.on('pagenumberchanged', this._updateDisabledText, this);
		return container;
	},

	_prevPart: function () {
		if (this._docType === 'text' && this._currentPage > 0) {
			this._map.goToPage(this._currentPage - 1);
		}
		else {
			this._map.setPart('prev');
		}
	},

	_nextPart: function () {
		if (this._docType === 'text' && this._currentPage < this._pages - 1) {
			this._map.goToPage(this._currentPage + 1);
		}
		else {
			this._map.setPart('next');
		}
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
		var parts = e.parts;
		var currentPart = e.currentPart;
		var docType = e.docType;
		if (docType === 'text') {
			return;
		}
		if (currentPart === 0) {
			L.DomUtil.addClass(this._prevPartButton, className);
		} else {
			L.DomUtil.removeClass(this._prevPartButton, className);
		}
		if (currentPart === parts - 1) {
			L.DomUtil.addClass(this._nextPartButton, className);
		} else {
			L.DomUtil.removeClass(this._nextPartButton, className);
		}
	},

	_updateDisabledText: function (e) {
		if (e) {
			this._currentPage = e.currentPage;
			this._pages = e.pages;
			this._docType = e.docType;
		}
		var className = 'leaflet-disabled';
		if (this._currentPage === 0) {
			L.DomUtil.addClass(this._prevPartButton, className);
		} else {
			L.DomUtil.removeClass(this._prevPartButton, className);
		}
		if (this._currentPage === this._pages - 1) {
			L.DomUtil.addClass(this._nextPartButton, className);
		} else {
			L.DomUtil.removeClass(this._nextPartButton, className);
		}
	}
});

L.control.parts = function (options) {
	return new L.Control.Parts(options);
};
