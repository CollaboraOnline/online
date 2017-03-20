/*
 * L.Control.PartsPreview
 */

/* global $ map */
L.Control.PartsPreview = L.Control.extend({
	options: {
		autoUpdate: true
	},

	onAdd: function (map) {
		this._previewInitialized = false;
		this._previewTiles = [];
		this._partsPreviewCont = L.DomUtil.get('slide-sorter');

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

		if (docType === 'presentation' || docType === 'drawing') {
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
					this._previewTiles.push(this._createPreview(i, e.partNames[i]));
				}
				L.DomUtil.addClass(this._previewTiles[selectedPart], 'preview-img-selected');
				this._previewInitialized = true;
			}
			else
			{
				if (e.partNames !== undefined) {
					this._syncPreviews(e);
				}

				// change the border style of the selected preview.
				for (var j = 0; j < parts; j++) {
					L.DomUtil.removeClass(this._previewTiles[j], 'preview-img-selected');
				}
				L.DomUtil.addClass(this._previewTiles[selectedPart], 'preview-img-selected');
			}
		}
	},

	_createPreview: function (i, hashCode) {
		var frame = L.DomUtil.create('div', 'preview-frame', this._partsPreviewCont);
		L.DomUtil.create('span', 'preview-helper', frame);
		var imgClassName = 'preview-img';
		var img = L.DomUtil.create('img', imgClassName, frame);
		img.hash = hashCode;
		img.src = L.Icon.Default.imagePath + '/preview_placeholder.png';
		L.DomEvent
			.on(img, 'click', L.DomEvent.stopPropagation)
			.on(img, 'click', L.DomEvent.stop)
			.on(img, 'click', this._setPart, this)
			.on(img, 'click', this._refocusOnMap, this);
		this._map.getPreview(i, i, 180, 180, {autoUpdate: this.options.autoUpdate});

		return img;
	},

	_setPart: function (e) {
		var part = $('#slide-sorter .mCSB_container .preview-frame').index(e.target.parentNode);
		if (part !== null) {
			this._map.setPart(parseInt(part));
		}
	},

	_updatePart: function (e) {
		if (e.docType === 'presentation' && e.part >= 0) {
			this._map.getPreview(e.part, e.part, 180, 180, {autoUpdate: this.options.autoUpdate});
		}
	},

	_syncPreviews: function (e) {
		var it = 0;
		var parts = e.parts;
		if (parts !== this._previewTiles.length) {
			if (Math.abs(parts - this._previewTiles.length) === 1) {
				if (parts > this._previewTiles.length) {
					for (it = 0; it < parts; it++) {
						if (it === this._previewTiles.length) {
							this._insertPreview({selectedPart: it - 1, hashCode: e.partNames[it]});
							break;
						}
						if (this._previewTiles[it].hash !== e.partNames[it]) {
							this._insertPreview({selectedPart: it, hashCode: e.partNames[it]});
							break;
						}
					}
				}
				else {
					for (it = 0; it < this._previewTiles.length; it++) {
						if (it === e.partNames.length ||
						    this._previewTiles[it].hash !== e.partNames[it]) {
							this._deletePreview({selectedPart: it});
							break;
						}
					}
				}
			}
			else {
				// sync all, should never happen
				while (this._previewTiles.length < e.partNames.length) {
					this._insertPreview({selectedPart: this._previewTiles.length - 1,
							     hashCode: e.partNames[this._previewTiles.length]});
				}

				while (this._previewTiles.length > e.partNames.length) {
					this._deletePreview({selectedPart: this._previewTiles.length - 1});
				}

				for (it = 0; it < e.partNames.length; it++) {
					this._previewTiles[it].hash = e.partNames[it];
					this._previewTiles[it].src = L.Icon.Default.imagePath + '/preview_placeholder.png';
					this._map.getPreview(it, it, 180, 180, {autoUpdate: this.options.autoUpdate});
				}
			}
		}
		else {
			// update hash code when user click insert slide.
			for (it = 0; it < parts; it++) {
				if (this._previewTiles[it].hash !== e.partNames[it]) {
					this._previewTiles[it].hash = e.partNames[it];
				}
			}
		}
	},

	_updatePreview: function (e) {
		if (this._map.getDocType() === 'presentation' || this._map.getDocType() === 'drawing') {
			// the scrollbar has to be re-initialized here else it doesn't work
			// probably a bug from the scrollbar
			this._previewTiles[e.id].onload = function () {
				$('#slide-sorter').mCustomScrollbar({
					axis: 'y',
					theme: 'dark-thick',
					scrollInertia: 0,
					alwaysShowScrollbar: 1});
			};

			this._previewTiles[e.id].src = e.tile;
		}
	},

	_updatePreviewIds: function () {
		$('#slide-sorter').mCustomScrollbar('update');
	},

	_insertPreview: function (e) {
		if (this._map.getDocType() === 'presentation') {
			var newIndex = e.selectedPart + 1;
			var newPreview = this._createPreview(newIndex, (e.hashCode === undefined ? null : e.hashCode));

			// insert newPreview to newIndex position
			this._previewTiles.splice(newIndex, 0, newPreview);

			var selectedFrame = this._previewTiles[e.selectedPart].parentNode;
			var newFrame = newPreview.parentNode;

			// insert after selectedFrame
			selectedFrame.parentNode.insertBefore(newFrame, selectedFrame.nextSibling);
			this._updatePreviewIds();
		}
	},

	_deletePreview: function (e) {
		if (this._map.getDocType() === 'presentation') {
			var selectedFrame = this._previewTiles[e.selectedPart].parentNode;
			L.DomUtil.remove(selectedFrame);

			this._previewTiles.splice(e.selectedPart, 1);
			this._updatePreviewIds();
		}
	}
});

L.control.partsPreview = function (options) {
	return new L.Control.PartsPreview(options);
};
