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
		this._previewInitialized = false;
		this._previewTiles = {};

		map.on('updateparts', this._updateDisabled, this);
		map.on('tilepreview', this._updatePreview, this);
		return container;
	},

	_prevPart: function () {
		this._map.setPart('prev');
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
		var parts = e.parts;
		var currentPart = e.currentPart;
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
		if (!this._previewInitialized && parts > 1) {
			var container = L.DomUtil.get('parts-preview');
			for (var i = 0; i < parts; i++) {
				var id = 'preview-tile' + i;
				var frame = L.DomUtil.create('div', 'preview-frame', container);
				L.DomUtil.create('span', 'preview-helper', frame);
				var img = L.DomUtil.create('img', 'preview-img', frame);
				img.id = id;
				this._previewTiles[id] = img;
				L.DomEvent
					.on(img, 'click', L.DomEvent.stopPropagation)
					.on(img, 'click', L.DomEvent.stop)
					.on(img, 'click', this._setPart, this)
					.on(img, 'click', this._refocusOnMap, this);
				this._map.getPartPreview(i, i, 180, 180);
			}
			this._previewInitialized = true;
		}
	},

	_setPart: function (e) {
		var part =  e.target.id.match(/\d+/g)[0];
		if (part !== null) {
			this._map.setPart(parseInt(part));
		}
	},

	_updatePreview: function (e) {
		var id = 'preview-tile' + e.id;
		// the scrollbar has to be re-initialized here else it doesn't work
		// probably a bug from the scrollbar
		this._previewTiles[id].onload = function () {
			$('#parts-preview').mCustomScrollbar({
				axis: 'y',
				theme: 'dark-thick',
				scrollInertia: 0,
				alwaysShowScrollbar: 1});
		}

		this._previewTiles[id].src = e.tile;
	}
});

L.control.parts = function (options) {
	return new L.Control.Parts(options);
};
