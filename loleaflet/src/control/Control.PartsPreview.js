/*
 * L.Control.PartsPreview
 */

/* global $ */
L.Control.PartsPreview = L.Control.extend({
	options: {
		autoUpdate: true
	},

	onAdd: function (map) {
		this._previewInitialized = false;
		this._previewTiles = {};
		var docContainer = map.options.documentContainer;
		this._partsPreviewCont = L.DomUtil.create('div', 'parts-preview', docContainer.parentElement);

		map.on('updateparts', this._updateDisabled, this);
		map.on('updatepart', this._updatePart, this);
		map.on('tilepreview', this._updatePreview, this);
		return document.createElement('div');
	},

	_updateDisabled: function (e) {
		var parts = e.parts;
		var selectedPart = e.selectedPart;
		var docType = e.docType;
		if (docType === 'text') {
			return;
		}

		if (docType === 'presentation') {
			if (!this._previewInitialized)
			{
				// make room for the preview
				var docContainer = this._map.options.documentContainer;
				L.DomUtil.addClass(docContainer, 'parts-preview-document');
				setTimeout(L.bind(function () {
					this._map.invalidateSize();
					$('.scroll-container').mCustomScrollbar('update');
				}, this), 500);
				for (var i = 0; i < parts; i++) {
					var id = 'preview-tile' + i;
					var frame = L.DomUtil.create('div', 'preview-frame', this._partsPreviewCont);
					L.DomUtil.create('span', 'preview-helper', frame);
					var imgClassName = 'preview-img';
					if (i == 0) {
						imgClassName += ' preview-img-selected';
					}
					var img = L.DomUtil.create('img', imgClassName, frame);
					img.id = id;
					this._previewTiles[id] = img;
					L.DomEvent
						.on(img, 'click', L.DomEvent.stopPropagation)
						.on(img, 'click', L.DomEvent.stop)
						.on(img, 'click', this._setPart, this)
						.on(img, 'click', this._refocusOnMap, this);
					this._map.getPreview(i, i, 180, 180, {autoUpdate: this.options.autoUpdate});
				}
				this._previewInitialized = true;
			}
			else
			{
				// change the border style of the selected preview.
				for (var i = 0; i < parts; i++) {
					var img = L.DomUtil.get('preview-tile' + i);
					L.DomUtil.removeClass(img, 'preview-img-selected');
				}
				var img = L.DomUtil.get('preview-tile' + selectedPart);
				L.DomUtil.addClass(img, 'preview-img-selected');
			}
		}
	},

	_setPart: function (e) {
		var part =  e.target.id.match(/\d+/g)[0];
		if (part !== null) {
			this._map.setPart(parseInt(part));
		}
	},

	_updatePart: function (e) {
		if (e.docType === 'presentation') {
			this._map.getPreview(e.part, e.part, 180, 180, {autoUpdate: this.options.autoUpdate});
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
