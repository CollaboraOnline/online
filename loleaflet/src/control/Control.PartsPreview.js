/* -*- js-indent-level: 8 -*- */
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
		this._partsPreviewCont = L.DomUtil.get('slide-sorter');
		this._scrollY = 0;

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
			var presentationControlWrapperElem = L.DomUtil.get('presentation-controls-wrapper');
			var visible = L.DomUtil.getStyle(presentationControlWrapperElem, 'display');
			if (visible === 'none')
				return;
			if (!this._previewInitialized)
			{
				// make room for the preview
				var control = this;
				var docContainer = this._map.options.documentContainer;
				L.DomUtil.addClass(docContainer, 'parts-preview-document');
				setTimeout(L.bind(function () {
					this._map.invalidateSize();
					$('.scroll-container').mCustomScrollbar('update');
				}, this), 500);
				var previewContBB = this._partsPreviewCont.getBoundingClientRect();
				this._previewContTop = previewContBB.top;
				var bottomBound = previewContBB.bottom + previewContBB.height / 2;

				$('#slide-sorter').mCustomScrollbar({
					axis: 'y',
					theme: 'dark-thick',
					scrollInertia: 0,
					alwaysShowScrollbar: 1,
					callbacks:{
						whileScrolling: function() {
							control._onScroll(this);
						}
					}
				});
				this._scrollContainer = $('#slide-sorter .mCSB_container').get(0);

				for (var i = 0; i < parts; i++) {
					this._previewTiles.push(this._createPreview(i, e.partNames[i], bottomBound));
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

	_createPreview: function (i, hashCode, bottomBound) {
		var frame = L.DomUtil.create('div', 'preview-frame', this._scrollContainer);
		L.DomUtil.create('span', 'preview-helper', frame);

		var imgClassName = 'preview-img';
		var img = L.DomUtil.create('img', imgClassName, frame);
		img.hash = hashCode;
		img.src = L.Icon.Default.imagePath + '/preview_placeholder.png';
		img.fetched = false;
		L.DomEvent
			.on(img, 'click', L.DomEvent.stopPropagation)
			.on(img, 'click', L.DomEvent.stop)
			.on(img, 'click', this._setPart, this)
			.on(img, 'click', this._map.focus, this._map);

		var topBound = this._previewContTop;
		var previewFrameTop = 0;
		var previewFrameBottom = 0;
		if (i > 0) {
			if (!bottomBound) {
				var previewContBB = this._partsPreviewCont.getBoundingClientRect();
				bottomBound = this._previewContTop + previewContBB.height + previewContBB.height / 2;
			}
			previewFrameTop = this._previewContTop + this._previewFrameMargin + i * (this._previewFrameHeight + this._previewFrameMargin);
			previewFrameTop -= this._scrollY;
			previewFrameBottom = previewFrameTop + this._previewFrameHeight;
			L.DomUtil.setStyle(img, 'height', this._previewImgHeight + 'px');
		}

		var imgSize;
		if (i === 0 || (previewFrameTop >= topBound && previewFrameTop <= bottomBound)
			|| (previewFrameBottom >= topBound && previewFrameBottom <= bottomBound)) {
			imgSize = this._map.getPreview(i, i, 180, 180, {autoUpdate: this.options.autoUpdate});
			img.fetched = true;
			L.DomUtil.setStyle(img, 'height', '');
		}

		if (i === 0) {
			var previewImgBorder = Math.round(parseFloat(L.DomUtil.getStyle(img, 'border-top-width')));
			var previewImgMinWidth = Math.round(parseFloat(L.DomUtil.getStyle(img, 'min-width')));
			var imgHeight = imgSize.height;
			if (imgSize.width < previewImgMinWidth)
				imgHeight = Math.round(imgHeight * previewImgMinWidth / imgSize.width);
			var previewFrameBB = frame.getBoundingClientRect();
			this._previewFrameMargin = previewFrameBB.top - this._previewContTop;
			this._previewImgHeight = imgHeight;
			this._previewFrameHeight = imgHeight + 2 * previewImgBorder;
		}

		return img;
	},

	_setPart: function (e) {
		var part = $('#slide-sorter .mCSB_container .preview-frame').index(e.target.parentNode);
		if (part !== null) {
			var partId = parseInt(part);

			if (e.ctrlKey) {
				this._map.selectPart(partId, 2, false); // Toggle selection on ctrl+click.
			} else if (e.altKey) {
				console.log('alt');
			} else if (e.shiftKey) {
				console.log('shift');
			} else {
				this._map.setPart(partId);
			}
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
					this._previewTiles[it].fetched = false;
				}
				this._onScrollEnd();
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
			if (!this._previewInitialized)
				return;
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
	},

	_onScroll: function (e) {
		var scrollOffset = 0;
		if (e) {
			var prevScrollY = this._scrollY;
			this._scrollY = -e.mcs.top;
			scrollOffset = this._scrollY - prevScrollY;
		}

		var previewContBB = this._partsPreviewCont.getBoundingClientRect();
		var extra =  previewContBB.height;
		var topBound = this._previewContTop - (scrollOffset < 0 ? extra : previewContBB.height / 2);
		var bottomBound = this._previewContTop + previewContBB.height + (scrollOffset > 0 ? extra : previewContBB.height / 2);
		for (var i = 0; i < this._previewTiles.length; ++i) {
			var img = this._previewTiles[i];
			if (img && img.parentNode && !img.fetched) {
				var previewFrameBB = img.parentNode.getBoundingClientRect();
				if ((previewFrameBB.top >= topBound && previewFrameBB.top <= bottomBound)
				|| (previewFrameBB.bottom >= topBound && previewFrameBB.bottom <= bottomBound)) {
					this._map.getPreview(i, i, 180, 180, {autoUpdate: this.options.autoUpdate});
					img.fetched = true;
				}
			}
		}
	}
});

L.control.partsPreview = function (options) {
	return new L.Control.PartsPreview(options);
};
