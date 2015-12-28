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
		this._previewTiles = [];
		var docContainer = map.options.documentContainer;
		this._partsPreviewCont = L.DomUtil.create('div', 'parts-preview', docContainer.parentElement);

		map.on('updateparts', this._updateDisabled, this);
		map.on('updatepart', this._updatePart, this);
		map.on('tilepreview', this._updatePreview, this);
		map.on('insertpage', this._insertPreview, this);
		map.on('deletepage', this._deletePreview, this);
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
					this._previewTiles.push(this._createPreview(i));
				}
				L.DomUtil.addClass(this._previewTiles[selectedPart], 'preview-img-selected');
				this._previewInitialized = true;
			}
			else
			{
				// change the border style of the selected preview.
				for (var j = 0; j < parts; j++) {
					L.DomUtil.removeClass(this._previewTiles[j], 'preview-img-selected');
				}
				L.DomUtil.addClass(this._previewTiles[selectedPart], 'preview-img-selected');
			}
		}
	},

	_createPreview: function (i) {
		var id = 'preview-tile' + i;
		var frame = L.DomUtil.create('div', 'preview-frame', this._partsPreviewCont);
		L.DomUtil.create('span', 'preview-helper', frame);
		var imgClassName = 'preview-img';
		var img = L.DomUtil.create('img', imgClassName, frame);
		img.id = id;
		L.DomEvent
			.on(img, 'click', L.DomEvent.stopPropagation)
			.on(img, 'click', L.DomEvent.stop)
			.on(img, 'click', this._setPart, this)
			.on(img, 'click', this._refocusOnMap, this);
		this._map.getPreview(i, i, 180, 180, {autoUpdate: this.options.autoUpdate});

		return img;
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
		// the scrollbar has to be re-initialized here else it doesn't work
		// probably a bug from the scrollbar
		this._previewTiles[e.id].onload = function () {
			$('.parts-preview').mCustomScrollbar({
				axis: 'y',
				theme: 'dark-thick',
				scrollInertia: 0,
				alwaysShowScrollbar: 1});
		};

		this._previewTiles[e.id].src = e.tile;
	},

	_updatePreviewIds: function () {
		// TO DO: preview-tileX prefix is unneccessary, can be removed completely
		// since we have them in this._previewTiles[]
		for (var i = 0; i < this._previewTiles.length; i++) {
			this._previewTiles[i].id = 'preview-tile' + i;
		}
		$('.parts-preview').mCustomScrollbar('update');
	},

	_insertPreview: function (e) {
		var newIndex = e.selectedPart + 1;
		var newPreview = this._createPreview(newIndex);

		// insert newPreview to newIndex position
		this._previewTiles.splice(newIndex, 0, newPreview);

		var selectedFrame = this._previewTiles[e.selectedPart].parentNode;
		var newFrame = newPreview.parentNode;

		// insert after selectedFrame
		selectedFrame.parentNode.insertBefore(newFrame, selectedFrame.nextSibling);
		this._updatePreviewIds();
	},

	_deletePreview: function (e) {
		var selectedFrame = this._previewTiles[e.selectedPart].parentNode;
		L.DomUtil.remove(selectedFrame);

		this._previewTiles.splice(e.selectedPart, 1);
		this._updatePreviewIds();
	}
});

L.control.partsPreview = function (options) {
	return new L.Control.PartsPreview(options);
};
