/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.PartsPreview
 */

/* global $ Hammer w2ui */
L.Control.PartsPreview = L.Control.extend({
	options: {
		fetchThumbnail: true,
		autoUpdate: true,
		maxWidth: L.Browser.mobile ? 60 : 180,
		maxHeight: L.Browser.mobile ? 60 : 180
	},
	partsFocused: false,

	initialize: function (container, preview, options) {
		L.setOptions(this, options);

		if (!container) {
			container = L.DomUtil.get('presentation-controls-wrapper');
		}

		if (!preview) {
			preview = L.DomUtil.get('slide-sorter');
		}

		this._container = container;
		this._partsPreviewCont = preview;
	},

	onAdd: function (map) {
		this._previewInitialized = false;
		this._previewTiles = [];
		this._direction = window.mode.isMobile() && L.DomUtil.isPortrait() ? 'x' : 'y';
		this._scrollY = 0;

		map.on('updateparts', this._updateDisabled, this);
		map.on('updatepart', this._updatePart, this);
		map.on('tilepreview', this._updatePreview, this);
		map.on('insertpage', this._insertPreview, this);
		map.on('deletepage', this._deletePreview, this);
	},

	createScrollbar: function (axis) {
		var control = this;
		if (axis) {
			this._direction = axis;
		}

		$(this._partsPreviewCont).mCustomScrollbar({
			axis: this._direction,
			theme: 'dark-thick',
			scrollInertia: 0,
			alwaysShowScrollbar: 1,
			callbacks:{
				whileScrolling: function() {
					control._onScroll(this);
				}
			}
		});
	},

	_updateDisabled: function (e) {
		var parts = e.parts;
		var selectedPart = e.selectedPart;
		var selectedParts = e.selectedParts;
		var docType = e.docType;
		if (docType === 'text' || isNaN(parts)) {
			return;
		}

		if (docType === 'presentation' || docType === 'drawing') {
			var presentationControlWrapperElem = this._container;
			var visible = L.DomUtil.getStyle(presentationControlWrapperElem, 'display');
			if (visible === 'none')
				return;
			if (!this._previewInitialized)
			{
				// make room for the preview
				var docContainer = this._map.options.documentContainer;
				if (!L.DomUtil.hasClass(docContainer, 'parts-preview-document')) {
					L.DomUtil.addClass(docContainer, 'parts-preview-document');
					setTimeout(L.bind(function () {
						this._map.invalidateSize();
						$('.scroll-container').mCustomScrollbar('update');
					}, this), 500);
				}
				var previewContBB = this._partsPreviewCont.getBoundingClientRect();
				var bottomBound;

				this.createScrollbar();

				if (this._direction === 'x') {
					this._previewContTop = previewContBB.left;
					bottomBound = previewContBB.right + previewContBB.width / 2;
				} else {
					this._previewContTop = previewContBB.top;
					bottomBound = previewContBB.bottom + previewContBB.height / 2;
				}

				this._map.on('click', function() {
					this.partsFocused = false;
				}, this);

				this._map.on('keydown', function(e) {
					if (this.partsFocused === true) {
						switch (e.originalEvent.keyCode) {
						case 38:
							this._setPart('prev');
							break;
						case 40:
							this._setPart('next');
							break;
						}
					}
				}, this);

				this._scrollContainer = $(this._partsPreviewCont).find('.mCSB_container').get(0);

				// Add a special frame just as a drop-site for reordering.
				var frame = L.DomUtil.create('div', 'preview-frame', this._scrollContainer);
				this._addDnDHandlers(frame);
				frame.setAttribute('draggable', false);

				if (!window.mode.isMobile()) {
					L.DomUtil.setStyle(frame, 'height', '20px');
					L.DomUtil.setStyle(frame, 'margin', '0em');
				}

				// Create the preview parts
				for (var i = 0; i < parts; i++) {
					this._previewTiles.push(this._createPreview(i, e.partNames[i], bottomBound));
				}
				L.DomUtil.addClass(this._previewTiles[selectedPart], 'preview-img-currentpart');
				this._previewInitialized = true;
			}
			else
			{
				if (e.partNames !== undefined) {
					this._syncPreviews(e);
				}

				// change the border style of the selected preview.
				for (var j = 0; j < parts; j++) {
					L.DomUtil.removeClass(this._previewTiles[j], 'preview-img-currentpart');
					L.DomUtil.removeClass(this._previewTiles[j], 'preview-img-selectedpart');
					if (j === selectedPart)
						L.DomUtil.addClass(this._previewTiles[j], 'preview-img-currentpart');
					else if (selectedParts.indexOf(j) >= 0)
						L.DomUtil.addClass(this._previewTiles[j], 'preview-img-selectedpart');
				}
			}

			// update portrait / landscape
			var removePreviewImg = 'preview-img-portrait';
			var addPreviewImg = 'preview-img-landscape';
			var removePreviewFrame = 'preview-frame-portrait';
			var addPreviewFrame = 'preview-frame-landscape';
			if (L.DomUtil.isPortrait()) {
				removePreviewImg = 'preview-img-landscape';
				addPreviewImg = 'preview-img-portrait';
				removePreviewFrame = 'preview-frame-landscape';
				addPreviewFrame = 'preview-frame-portrait';
			}

			for (i = 0; i < parts; i++) {
				L.DomUtil.removeClass(this._previewTiles[i], removePreviewImg);
				L.DomUtil.addClass(this._previewTiles[i], addPreviewImg);
			}

			var previewFrame = $(this._partsPreviewCont).find('.preview-frame');
			previewFrame.removeClass(removePreviewFrame);
			previewFrame.addClass(addPreviewFrame);
		}
	},

	_createPreview: function (i, hashCode, bottomBound) {
		var frame = L.DomUtil.create('div', 'preview-frame', this._scrollContainer);
		this._addDnDHandlers(frame);
		L.DomUtil.create('span', 'preview-helper', frame);

		var imgClassName = 'preview-img';
		var img = L.DomUtil.create('img', imgClassName, frame);
		img.hash = hashCode;
		img.src = L.Icon.Default.imagePath + '/preview_placeholder.png';
		img.fetched = false;
		if (L.Browser.mobile) {
			(new Hammer(img, {recognizers: [[Hammer.Press]]}))
			.on('press', L.bind(function () {
				if (this._map._permission === 'edit') {
					setTimeout(function () {
						w2ui['actionbar'].click('mobile_wizard');
					}, 0);
				}
			}, this));
		}
		L.DomEvent.on(img, 'click', function (e) {
			L.DomEvent.stopPropagation(e);
			L.DomEvent.stop(e);
			this._setPart(e);
			this._map.focus();
			this.partsFocused = true;
			document.activeElement.blur();
		}, this);

		var topBound = this._previewContTop;
		var previewFrameTop = 0;
		var previewFrameBottom = 0;
		if (i > 0) {
			if (!bottomBound) {
				var previewContBB = this._partsPreviewCont.getBoundingClientRect();
				if (this._direction === 'x') {
					bottomBound = this._previewContTop + previewContBB.width + previewContBB.width / 2;
				} else {
					bottomBound = this._previewContTop + previewContBB.height + previewContBB.height / 2;
				}
			}
			previewFrameTop = this._previewContTop + this._previewFrameMargin + i * (this._previewFrameHeight + this._previewFrameMargin);
			previewFrameTop -= this._scrollY;
			previewFrameBottom = previewFrameTop + this._previewFrameHeight;

			if (this._direction === 'x') {
				L.DomUtil.setStyle(img, 'width', this._previewImgWidth + 'px');
			} else {
				L.DomUtil.setStyle(img, 'height', this._previewImgHeight + 'px');
			}
		}

		var imgSize;
		if (i === 0 || (previewFrameTop >= topBound && previewFrameTop <= bottomBound)
			|| (previewFrameBottom >= topBound && previewFrameBottom <= bottomBound)) {
			imgSize = this.options.fetchThumbnail ?
				this._map.getPreview(i, i, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate}) :
				{ width: this.options.maxWidth, height: this.options.maxHeight };
			img.fetched = true;

			if (this._direction === 'x') {
				L.DomUtil.setStyle(img, 'width', '');
			} else {
				L.DomUtil.setStyle(img, 'height', '');
			}
		}

		if (i === 0) {
			var previewImgBorder = Math.round(parseFloat(L.DomUtil.getStyle(img, 'border-top-width')));
			var previewImgMinWidth = Math.round(parseFloat(L.DomUtil.getStyle(img, 'min-width')));
			var imgHeight = imgSize.height;
			var imgWidth = imgSize.width;
			if (imgSize.width < previewImgMinWidth)
				imgHeight = Math.round(imgHeight * previewImgMinWidth / imgSize.width);
			var previewFrameBB = frame.getBoundingClientRect();
			if (this._direction === 'x') {
				this._previewFrameMargin = previewFrameBB.left - this._previewContTop;
				this._previewImgHeight = imgWidth;
				this._previewFrameHeight = imgWidth + 2 * previewImgBorder;
			} else {
				this._previewFrameMargin = previewFrameBB.top - this._previewContTop;
				this._previewImgHeight = imgHeight;
				this._previewFrameHeight = imgHeight + 2 * previewImgBorder;
			}
		}

		return img;
	},

	_setPart: function (e) {
		//helper function to check if the view is in the scrollview visible area
		function isVisible(el) {
			var elemRect = el.getBoundingClientRect();
			var elemTop = elemRect.top;
			var elemBottom = elemRect.bottom;
			var elemLeft = elemRect.left;
			var elemRight = elemRect.right;
			var isVisible = this._direction === 'x' ?
				(elemLeft >= 0) && (elemRight <= window.innerWidth) :
				(elemTop >= 0) && (elemBottom <= window.innerHeight);
			return isVisible;
		}
		if (e === 'prev' || e === 'next') {
			this._map.setPart(e);
			var nodePos;
			var node = $(this._partsPreviewCont).find('.mCSB_container .preview-frame')[this._map.getCurrentPartNumber()];
			if (!isVisible(node)) {
				if (e === 'prev') {
					setTimeout(function () {
						$(this._partsPreviewCont).mCustomScrollbar('scrollTo', node);
					}, 50);
				} else if (this._direction === 'x') {
					var nodeWidth = $(node).width();
					var sliderWidth = $(this._partsPreviewCont).width();
					nodePos = $(node).position().left;
					setTimeout(function () {
						$(this._partsPreviewCont).mCustomScrollbar('scrollTo', nodePos-(sliderWidth-nodeWidth-nodeWidth/2));
					}, 50);
				} else {
					var nodeHeight = $(node).height();
					var sliderHeight= $(this._partsPreviewCont).height();
					nodePos = $(node).position().top;
					setTimeout(function () {
						$(this._partsPreviewCont).mCustomScrollbar('scrollTo', nodePos-(sliderHeight-nodeHeight-nodeHeight/2));
					}, 50);
				}
			}
			return;
		}
		var part = $(this._partsPreviewCont).find('.mCSB_container .preview-frame').index(e.target.parentNode);
		if (part !== null) {
			var partId = parseInt(part) - 1; // The first part is just a drop-site for reordering.

			if (e.ctrlKey) {
				this._map.selectPart(partId, 2, false); // Toggle selection on ctrl+click.
			} else if (e.altKey) {
				console.log('alt');
			} else if (e.shiftKey) {
				console.log('shift');
			} else {
				this._map.setPart(partId);
				this._map.selectPart(partId, 1, false); // And select.
			}
		}
	},

	_updatePart: function (e) {
		if (e.docType === 'presentation' && e.part >= 0) {
			this._map.getPreview(e.part, e.part, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate});
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
					this._map.getPreview(it, it, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate});
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
		$(this._partsPreviewCont).mCustomScrollbar('update');
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
		setTimeout(L.bind(function (e) {
			var scrollOffset = 0;
			if (e) {
				var prevScrollY = this._scrollY;
				this._scrollY = this._direction === 'x' ? -e.mcs.left : -e.mcs.top;
				scrollOffset = this._scrollY - prevScrollY;
			}

			var previewContBB = this._partsPreviewCont.getBoundingClientRect();
			var extra =  this._direction === 'x' ? previewContBB.width : previewContBB.height;
			var topBound = this._previewContTop - (scrollOffset < 0 ? extra : extra / 2);
			var bottomBound = this._previewContTop + extra + (scrollOffset > 0 ? extra : extra / 2);
			for (var i = 0; i < this._previewTiles.length; ++i) {
				var img = this._previewTiles[i];
				if (img && img.parentNode && !img.fetched) {
					var previewFrameBB = img.parentNode.getBoundingClientRect();
					if (this._direction === 'x') {
						if ((previewFrameBB.left >= topBound && previewFrameBB.left <= bottomBound)
						|| (previewFrameBB.right >= topBound && previewFrameBB.right <= bottomBound)) {
							this._map.getPreview(i, i, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate});
							img.fetched = true;
						}
					} else if ((previewFrameBB.top >= topBound && previewFrameBB.top <= bottomBound)
						|| (previewFrameBB.bottom >= topBound && previewFrameBB.bottom <= bottomBound)) {
						this._map.getPreview(i, i, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate});
						img.fetched = true;
					}
				}
			}
		}, this, e), 0);
	},

	_addDnDHandlers: function (elem) {
		if (elem) {
			elem.setAttribute('draggable', true);
			elem.addEventListener('dragstart', this._handleDragStart, false);
			elem.addEventListener('dragenter', this._handleDragEnter, false);
			elem.addEventListener('dragover', this._handleDragOver, false);
			elem.addEventListener('dragleave', this._handleDragLeave, false);
			elem.addEventListener('drop', this._handleDrop, false);
			elem.addEventListener('dragend', this._handleDragEnd, false);
			elem.partsPreview = this;
		}
	},

	_handleDragStart: function (e) {
		// To avoid having to add a new message to move an arbitrary part, let's select the
		// slide that is being dragged.
		var part = $(this.partsPreview._partsPreviewCont).find('.mCSB_container .preview-frame').index(e.target.parentNode);
		if (part !== null) {
			var partId = parseInt(part) - 1; // The first part is just a drop-site for reordering.
			this.partsPreview._map.setPart(partId);
			this.partsPreview._map.selectPart(partId, 1, false); // And select.
		}
		// By default we move when dragging, but can
		// support duplication with ctrl in the future.
		e.dataTransfer.effectAllowed = 'move';
	},

	_handleDragOver: function (e) {
		if (e.preventDefault) {
			e.preventDefault();
		}

		// By default we move when dragging, but can
		// support duplication with ctrl in the future.
		e.dataTransfer.dropEffect = 'move';

		this.classList.add('preview-img-dropsite');
		return false;
	},

	_handleDragEnter: function () {
	},

	_handleDragLeave: function () {
		this.classList.remove('preview-img-dropsite');
	},

	_handleDrop: function (e) {
		if (e.stopPropagation) {
			e.stopPropagation();
		}

		var part = $(this.partsPreview._partsPreviewCont).find('.mCSB_container .preview-frame').index(e.target.parentNode);
		if (part !== null) {
			var partId = parseInt(part) - 1; // First frame is a drop-site for reordering.
			if (partId < 0)
				partId = -1; // First item is -1.
			this.partsPreview._map._socket.sendMessage('moveselectedclientparts position=' + partId);
			// Update previews, after a second, since we only get the dragged one invalidated.
			var that = this.partsPreview;
			setTimeout(function () {
				for (var i = 0; i < that._previewTiles.length; ++i) {
					that._map.getPreview(i, this.options.maxWidth, this.options.maxHeight, {autoUpdate: that.options.autoUpdate, broadcast: true});
				}
			}, 1000);
		}

		this.classList.remove('preview-img-dropsite');
		return false;
	},

	_handleDragEnd: function () {
		this.classList.remove('preview-img-dropsite');
	}

});

L.control.partsPreview = function (container, preview, options) {
	return new L.Control.PartsPreview(container, preview, options);
};
