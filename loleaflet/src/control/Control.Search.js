/*
 * L.Control.Search is used for searching text in the document
 */

L.Control.Search = L.Control.extend({
	options: {
		position: 'topleft',
		searchTitle: 'Search document',
		prevText: '&#x25B2',
		prevTitle: 'Previous',
		nextText: '&#x25BC',
		nextTitle: 'Next',
		cancelText: '&#x2716',
		cancelTitle: 'Cancel'
	},

	onAdd: function (map) {
		var searchName = 'leaflet-control-search',
		    container = L.DomUtil.create('div', searchName + ' leaflet-bar'),
		    options = this.options;

		this._searchBar = this._createSearchBar(options.searchTitle,
				searchName + '-bar', container, this._searchStart);
		this._prevButton  = this._createButton(options.prevText, options.prevTitle,
				searchName + '-prev', container, this._searchPrev);
		this._nextButton = this._createButton(options.nextText, options.nextTitle,
				searchName + '-next', container, this._searchNext);
		this._cancelButton = this._createButton(options.cancelText, options.cancelTitle,
				searchName + '-cancel', container, this._cancel);

		this._disabled = true;
		this._updateDisabled();
		map.on('clearnotfound search', this._searchResultFound, this);

		return container;
	},

	onRemove: function (map) {
		map.on('clearnotfound search', this._searchResultFound, this);
	},

	_searchStart: function (e) {
		if (e.keyCode === 13) {
			this._map.search(this._searchBar.value);
			this._disabled = false;
			this._updateDisabled();
			this._refocusOnMap();
		}
		else {
			this._map._docLayer.sendMessage('requestloksession');
		}
	},

	_searchResultFound: function (e) {
		if (e.type === 'clearnotfound') {
			L.DomUtil.removeClass(this._searchBar, 'search-not-found');
		}
		else if (e.type === 'search' && e.count === 0) {
			L.DomUtil.addClass(this._searchBar, 'search-not-found');
			setTimeout(L.bind(this._map.fire, this._map, 'clearnotfound'), 500);
		}
	},

	_searchPrev: function () {
		this._map.search(this._searchBar.value, true);
		this._refocusOnMap();
	},

	_searchNext: function () {
		this._map.search(this._searchBar.value);
		this._refocusOnMap();
	},

	_cancel: function () {
		L.DomUtil.setStyle(this._cancelButton, 'display', 'none');
		this._map.fire('clearselection');
		this._disabled = true;
		this._updateDisabled();
		this._refocusOnMap();
	},

	_createSearchBar: function(title, className, container, fn) {
		var bar = L.DomUtil.create('input', className, container);
		bar.type = 'text';
		bar.title = title;

		L.DomEvent
			.on(bar, 'click', L.DomEvent.stop)
			.on(bar, 'click', fn, this)
			.on(bar, 'keyup', L.DomEvent.stop)
			.on(bar, 'keyup', fn, this);

		return bar;
	},

	_createButton: function (text, title, className, container, fn) {
		// TODO create it as it is done for zoom, css knowledge required
		var button = L.DomUtil.create('button', className, container);
		button.innerHTML = text;
		button.title = title;

		L.DomEvent
		    .on(button, 'mousedown dblclick', L.DomEvent.stopPropagation)
		    .on(button, 'click', L.DomEvent.stop)
		    .on(button, 'click', fn, this)
		    .on(button, 'click', this._refocusOnMap, this);

		return button;
	},

	_updateDisabled: function () {
		this._prevButton.disabled = this._disabled;
		this._nextButton.disabled = this._disabled;
		if (this._disabled) {
			L.DomUtil.setStyle(this._cancelButton, 'display', 'none');
		}
		else {
			L.DomUtil.setStyle(this._cancelButton, 'display', 'inline-block');
		}
	}
});

L.control.search = function (options) {
	return new L.Control.Search(options);
};
