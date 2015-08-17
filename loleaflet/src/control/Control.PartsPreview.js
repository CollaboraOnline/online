/*
 * L.Control.PartsPreview
 */

L.Control.PartsPreview = L.Control.extend({
	onAdd: function (map) {
		this._previewInitialized = false;
		this._previewTiles = {};
		var docContainer = L.DomUtil.get('document-container');
		this._partsPreviewCont = L.DomUtil.create('div', 'parts-preview', docContainer.parentElement);

		map.on('updateparts', this._updateDisabled, this);
		map.on('tilepreview', this._updatePreview, this);
		return document.createElement('div');
	},

	_updateDisabled: function (e) {
		var parts = e.parts;
		var docType = e.docType;
		if (docType === 'text') {
			return;
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

L.control.partsPreview = function (options) {
	return new L.Control.PartsPreview(options);
};
