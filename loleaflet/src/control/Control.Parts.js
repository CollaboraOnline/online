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
		this._tabsInitialized = false;
		this._spreadsheetTabs = {};
		var docContainer = L.DomUtil.get('document-container');
		this._partsPreviewCont = L.DomUtil.create('div', 'parts-preview', docContainer.parentElement);
		this._tabsCont = L.DomUtil.create('div', 'spreadsheet-tab', docContainer.parentElement);

		map.on('updateparts', this._updateDisabled, this);
		map.on('tilepreview', this._updatePreview, this);
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
		var partNames = e.partNames;
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
		if (!this._previewInitialized && docType === 'presentation') {
			// make room for the preview
			var docContainer = L.DomUtil.get('document-container');
			L.DomUtil.setStyle(docContainer, 'left', '200px');
			setTimeout(L.bind(function () {
				this._map.invalidateSize();
				$('.scroll-container').mCustomScrollbar('update');
			}, this), 500);
			for (var i = 0; i < parts; i++) {
				var id = 'preview-tile' + i;
				var frame = L.DomUtil.create('div', 'preview-frame', this._partsPreviewCont);
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
		if (docType === 'spreadsheet') {
			if (!this._tabsInitialized) {
				// make room for the preview
				docContainer = L.DomUtil.get('document-container');
				L.DomUtil.setStyle(docContainer, 'bottom', '20px');
				setTimeout(L.bind(function () {
					this._map.invalidateSize();
					$('.scroll-container').mCustomScrollbar('update');
				}, this), 500);
				for (i = 0; i < parts; i++) {
					id = 'spreadsheet-tab' + i;
					var tab = L.DomUtil.create('li', '', this._tabsCont);
					tab.innerHTML = partNames[i];
					tab.id = id;
					L.DomEvent
						.on(tab, 'click', L.DomEvent.stopPropagation)
						.on(tab, 'click', L.DomEvent.stop)
						.on(tab, 'click', this._setPart, this)
						.on(tab, 'click', this._refocusOnMap, this);
					this._spreadsheetTabs[id] = tab;
				}
				this._tabsInitialized = true;
			}
			for (var key in this._spreadsheetTabs) {
				var part =  parseInt(key.match(/\d+/g)[0]);
				L.DomUtil.removeClass(this._spreadsheetTabs[key], 'selected');
				if (part === currentPart) {
					L.DomUtil.addClass(this._spreadsheetTabs[key], 'selected');
				}
			}
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
			$('.parts-preview').mCustomScrollbar({
				axis: 'y',
				theme: 'dark-thick',
				scrollInertia: 0,
				alwaysShowScrollbar: 1});
		};

		this._previewTiles[id].src = e.tile;
	}
});

L.control.parts = function (options) {
	return new L.Control.Parts(options);
};
