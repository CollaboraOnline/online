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
		this._searchCmd = {
			'SearchItem.SearchString': {
				'type': 'string',
				'value': ''
			},
			'SearchItem.Backward': {
				'type': 'boolean',
				'value': false
			}
		};

		this._disabled = true;
		this._updateDisabled();
		map.on('clearnotfound searchnotfound', this._searchResultFound, this);

		return container;
	},

	onRemove: function (map) {
		map.on('clearnotfound searchnotfound', this._searchResultFound, this);
	},

	_searchStart: function (e) {
		this._map.fire('clearselection');
		var viewTopLeftpx = this._map.project(this._map.getBounds().getNorthWest());
		var docBoundsTopLeft = this._map.project(this._map.options.maxBounds.getNorthWest());
		var topLeft = this._map.unproject(new L.Point(
				Math.max(viewTopLeftpx.x, docBoundsTopLeft.x),
				Math.max(viewTopLeftpx.y, docBoundsTopLeft.y)));
		var topLeftTwips = this._map._docLayer._latLngToTwips(topLeft);

		if (e.keyCode === 13 && this._searchBar.value !== '') {
			this._disabled = false;
			this._updateDisabled();
			this._searchCmd['SearchItem.SearchString'].value = this._searchBar.value;
			this._searchCmd['SearchItem.Backward'].value = false;
			this._searchCmd['SearchItem.SearchStartPointX'] = {};
			this._searchCmd['SearchItem.SearchStartPointX'].type = 'long';
			this._searchCmd['SearchItem.SearchStartPointX'].value = topLeftTwips.x;
			this._searchCmd['SearchItem.SearchStartPointY'] = {};
			this._searchCmd['SearchItem.SearchStartPointY'].type = 'long';
			this._searchCmd['SearchItem.SearchStartPointY'].value = topLeftTwips.y;
			this._map.socket.send('uno .uno:ExecuteSearch ' + JSON.stringify(this._searchCmd));
			delete this._searchCmd['SearchItem.SearchStartPointX'];
			delete this._searchCmd['SearchItem.SearchStartPointY'];
			this._refocusOnMap();
		}
	},

	_searchResultFound: function (e) {
		if (e.type === 'clearnotfound') {
			L.DomUtil.removeClass(this._searchBar, 'search-not-found');
		}
		else if (e.type === 'searchnotfound') {
			L.DomUtil.addClass(this._searchBar, 'search-not-found');
			setTimeout(L.bind(this._map.fire, this._map, 'clearnotfound'), 500);
		}
	},

	_searchPrev: function () {
		this._searchCmd['SearchItem.Backward'].value = true;
		this._searchCmd['SearchItem.SearchString'].value = this._searchBar.value;
		this._map.socket.send('uno .uno:ExecuteSearch ' + JSON.stringify(this._searchCmd));
		this._refocusOnMap();
	},

	_searchNext: function () {
		this._searchCmd['SearchItem.Backward'].value = false;
		this._searchCmd['SearchItem.SearchString'].value = this._searchBar.value;
		this._map.socket.send('uno .uno:ExecuteSearch ' + JSON.stringify(this._searchCmd));
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

L.Map.mergeOptions({
	searchControl: true
});

L.Map.addInitHook(function () {
	this.searchControl = new L.Control.Search();
	this.addControl(this.searchControl);
});

L.control.search = function (options) {
	return new L.Control.Search(options);
};
