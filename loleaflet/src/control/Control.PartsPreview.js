/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.PartsPreview
 */

/* global app $ Hammer w2ui */
L.Control.PartsPreview = L.Control.extend({
	options: {
		fetchThumbnail: true,
		autoUpdate: true,
		imageClass: '',
		frameClass: '',
		axis: '',
		allowOrientation: true,
		maxWidth: window.mode.isDesktop() ? 180: (window.mode.isTablet() ? 120: 60),
		maxHeight: window.mode.isDesktop() ? 180: (window.mode.isTablet() ? 120: 60)
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
		this._partsPreviewCont.onscroll = this._onScroll.bind(this);
	},

	onAdd: function (map) {
		this._previewInitialized = false;
		this._previewTiles = [];
		this._direction = this.options.allowOrientation ?
			(!window.mode.isDesktop() && L.DomUtil.isPortrait() ? 'x' : 'y') :
			this.options.axis;
		this._scrollY = 0;
		// Hack for access this function outside of this class
		map.isPreviewVisible = L.bind(this._isPreviewVisible, this);

		map.on('updateparts', this._updateDisabled, this);
		map.on('updatepart', this._updatePart, this);
		map.on('tilepreview', this._updatePreview, this);
		map.on('insertpage', this._insertPreview, this);
		map.on('deletepage', this._deletePreview, this);
		map.on('scrolllimits', this._updateAllPreview, this);
		map.on('scrolltopart', this._scrollToPart, this);
	},

	createScrollbar: function () {
		this._partsPreviewCont.style.whiteSpace = 'nowrap';
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
			if (!this._previewInitialized)
			{
				// make room for the preview
				var docContainer = this._map.options.documentContainer;
				if (!L.DomUtil.hasClass(docContainer, 'parts-preview-document')) {
					L.DomUtil.addClass(docContainer, 'parts-preview-document');
					setTimeout(L.bind(function () {
						this._map.invalidateSize();
					}, this), 500);
				}

				var bottomBound = this._getBottomBound();

				// Add a special frame just as a drop-site for reordering.
				var frameClass = 'preview-frame ' + this.options.frameClass;
				var frame = L.DomUtil.create('div', frameClass, this._partsPreviewCont);
				this._addDnDHandlers(frame);
				frame.setAttribute('draggable', false);
				frame.setAttribute('id', 'first-drop-site');

				if (window.mode.isDesktop()) {
					L.DomUtil.setStyle(frame, 'height', '20px');
					L.DomUtil.setStyle(frame, 'margin', '0em');
				}

				// Create the preview parts
				for (var i = 0; i < parts; i++) {
					this._previewTiles.push(this._createPreview(i, e.partNames[i], bottomBound));
				}
				if (!app.file.fileBasedView)
					L.DomUtil.addClass(this._previewTiles[selectedPart], 'preview-img-currentpart');
				this._onScroll(); // Load previews.
				this._previewInitialized = true;
			}
			else
			{
				if (e.partNames !== undefined) {
					this._syncPreviews(e);
				}

				if (!app.file.fileBasedView) {
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
			}

			if (!this.options.allowOrientation) {
				return;
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

			// re-create scrollbar with new direction
			this._direction = !window.mode.isDesktop() && !window.mode.isTablet() && L.DomUtil.isPortrait() ? 'x' : 'y';

			// Hide portrait view's previews when layout view is used.
			if (this._direction === 'x' && window.mode.isMobile()) {
				document.getElementById('mobile-slide-sorter').style.display = 'block';
			}
			else if (this._direction === 'y' && window.mode.isMobile()) {
				document.getElementById('mobile-slide-sorter').style.display = 'none';
			}
		}
	},

	_updateAllPreview: function () {
		if (this._previewTiles.length === 0) {
			return;
		}

		var bottomBound = this._getBottomBound();
		for (var prev = 0; prev < this._previewTiles.length; prev++) {
			this._layoutPreview(prev, this._previewTiles[prev], bottomBound);
		}
	},

	_createPreview: function (i, hashCode, bottomBound) {
		var frameClass = 'preview-frame ' + this.options.frameClass;
		var frame = L.DomUtil.create('div', frameClass, this._partsPreviewCont);
		frame.id = 'preview-frame-part-' + i;
		this._addDnDHandlers(frame);
		L.DomUtil.create('span', 'preview-helper', frame);

		var imgClassName = 'preview-img ' + this.options.imageClass;
		var img = L.DomUtil.create('img', imgClassName, frame);
		img.hash = hashCode;
		img.src = 'images/preview_placeholder.png';
		img.fetched = false;
		if (!window.mode.isDesktop()) {
			(new Hammer(img, {recognizers: [[Hammer.Press]]}))
				.on('press', function (e) {
					if (this._map.isPermissionEdit()) {
						this._addDnDTouchHandlers(e);
					}
				}.bind(this));
		}
		L.DomEvent.on(img, 'click', function (e) {
			L.DomEvent.stopPropagation(e);
			L.DomEvent.stop(e);
			var part = this._findClickedPart(e.target.parentNode);
			if (part !== null)
				var partId = parseInt(part) - 1; // The first part is just a drop-site for reordering.
			if (!window.mode.isDesktop() && partId === this._map._docLayer._selectedPart && !app.file.fileBasedView) {
				// if mobile or tab then second tap will open the mobile wizard
				if (this._map._permission === 'edit') {
					// Remove selection to get the slide properties in mobile wizard.
					app.socket.sendMessage('resetselection');
					setTimeout(function () {
						w2ui['actionbar'].click('mobile_wizard');
					}, 0);
				}
			} else {
				this._setPart(e);
				this._map.focus();
				this.partsFocused = true;
				if (!window.mode.isDesktop()) {
					// needed so on-screen keyboard doesn't pop up when switching slides,
					// but would cause PgUp/Down to not work on desktop in slide sorter
					document.activeElement.blur();
				}
			}
		}, this);

		this._layoutPreview(i, img, bottomBound);

		return img;
	},

	_getBottomBound: function () {
		var previewContBB = this._partsPreviewCont.getBoundingClientRect();
		var bottomBound;

		// is not visible yet, assume map bounds
		if (previewContBB.right === 0 && previewContBB.bottom === 0) {
			previewContBB = this._map._container.getBoundingClientRect();
		}

		if (this._direction === 'x') {
			this._previewContTop = previewContBB.left;
			bottomBound = previewContBB.right + previewContBB.width / 2;
		} else {
			this._previewContTop = previewContBB.top;
			bottomBound = previewContBB.bottom + previewContBB.height / 2;
		}

		return bottomBound;
	},

	_layoutPreview: function (i, img, bottomBound) {
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
		}

		var imgSize;
		if (i === 0 || (previewFrameTop >= topBound && previewFrameTop <= bottomBound)
			|| (previewFrameBottom >= topBound && previewFrameBottom <= bottomBound)) {
			imgSize = this._map.getPreview(i, i, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate, fetchThumbnail: this.options.fetchThumbnail});
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
			if (imgSize.width < previewImgMinWidth && window.mode.isDesktop())
				imgHeight = Math.round(imgHeight * previewImgMinWidth / imgSize.width);
			var previewFrameBB = img.parentElement.getBoundingClientRect();
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
	},

	_scrollToPart: function() {
		var partNo = this._map.getCurrentPartNumber();
		// update the page back and forward buttons status
		var pagerButtonsEvent = { selectedPart: partNo, parts: this._partsPreviewCont.children.length };
		window.onUpdateParts(pagerButtonsEvent);
		//var sliderSize, nodePos, nodeOffset, nodeMargin;
		var node = this._partsPreviewCont.children[partNo];

		if (node && (!this._previewTiles[partNo] || !this._isPreviewVisible(partNo, false))) {
			var nodePos = this._direction === 'x' ? $(node).position().left : $(node).position().top;
			var scrollDirection = window.mode.isDesktop() || window.mode.isTablet() ? 'scrollTop': (L.DomUtil.isPortrait() ? 'scrollLeft': 'scrollTop');
			var that = this;
			if (this._map._partsDirection < 0) {
				setTimeout(function() {
					that._partsPreviewCont[scrollDirection] += nodePos;
				}, 50);
			} else {
				setTimeout(function() {
					that._partsPreviewCont[scrollDirection] += nodePos;
				}, 50);
			}
		}
	},

	// We will use this function because IE doesn't support "Array.from" feature.
	_findClickedPart: function (element) {
		for (var i = 0; i < this._partsPreviewCont.children.length; i++) {
			if (this._partsPreviewCont.children[i] === element) {
				return i;
			}
		}
		return -1;
	},

	// This is used with fileBasedView.
	_scrollViewToPartPosition: function (partNumber, fromBottom) {
		if (this._map._docLayer && this._map._docLayer._isZooming)
			return;
		var ratio = this._map._docLayer._tileSize / this._map._docLayer._tileHeightTwips;
		var partHeightPixels = Math.round((this._map._docLayer._partHeightTwips + this._map._docLayer._spaceBetweenParts) * ratio);
		var scrollTop = partHeightPixels * partNumber;
		var viewHeight = app.sectionContainer.getViewSize()[1];

		if (viewHeight > partHeightPixels && partNumber > 0)
			scrollTop -= Math.round((viewHeight - partHeightPixels) * 0.5);

		// scroll to the bottom of the selected part/page instead of its top px
		if (fromBottom)
			scrollTop += partHeightPixels - viewHeight;
		scrollTop = Math.round(scrollTop / app.dpiScale);
		app.sectionContainer.getSectionWithName(L.CSections.Scroll.name).onScrollTo({x: 0, y: scrollTop});
	},

	_scrollViewByDirection: function(buttonType) {
		if (this._map._docLayer && this._map._docLayer._isZooming)
			return;
		var ratio = this._map._docLayer._tileSize / this._map._docLayer._tileHeightTwips;
		var partHeightPixels = Math.round((this._map._docLayer._partHeightTwips + this._map._docLayer._spaceBetweenParts) * ratio);
		var scroll = Math.floor(partHeightPixels / app.dpiScale);
		var viewHeight = Math.floor(app.sectionContainer.getViewSize()[1]);
		var viewHeightScaled = Math.round(Math.floor(viewHeight) / app.dpiScale);
		var scrollBySize = Math.floor(viewHeightScaled * 0.75);
		var topPx = (app.sectionContainer.getSectionWithName(L.CSections.Scroll.name).containerObject.getDocumentTopLeft()[1] / app.dpiScale);
		if (buttonType === 'prev') {
			if (this._map.getCurrentPartNumber() == 0) {
				if (topPx - scrollBySize <= 0) {
					this._scrollViewToPartPosition(0);
					return;
				}
			}
		} else if (buttonType === 'next') {
			if (this._map._docLayer._parts == this._map.getCurrentPartNumber() + 1) {
				scroll *= this._map.getCurrentPartNumber();
				var veryEnd = scroll + (Math.floor(partHeightPixels / app.dpiScale) - viewHeightScaled);
				if (topPx + viewHeightScaled >= veryEnd) {
					this._scrollViewToPartPosition(this._map.getCurrentPartNumber(), true);
					return;
				}
			}
		}
		app.sectionContainer.getSectionWithName(L.CSections.Scroll.name).onScrollBy({x: 0, y: buttonType === 'prev' ? -scrollBySize : scrollBySize});
	},

	_setPart: function (e) {
		var part = this._findClickedPart(e.target.parentNode);
		if (part !== null) {
			if (app.file.fileBasedView) {
				this._scrollViewToPartPosition(part - 1);
				return;
			}

			var partId = parseInt(part) - 1; // The first part is just a drop-site for reordering.

			if (e.ctrlKey) {
				this._map.selectPart(partId, 2, false); // Toggle selection on ctrl+click.
				if (this.firstSelection === undefined)
					this.firstSelection = this._map._docLayer._selectedPart;
			} else if (e.altKey) {
				console.log('alt');
			} else if (e.shiftKey) {
				if (this.firstSelection === undefined)
					this.firstSelection = this._map._docLayer._selectedPart;

				//deselect all slide
				this._map.deselectAll();

				//reselect the first origianl selection
				this._map.setPart(this.firstSelection);
				this._map.selectPart(this.firstSelection, 1, false);

				if (this.firstSelection < partId) {
					for (var id = this.firstSelection + 1; id <= partId; ++id) {
						this._map.selectPart(id, 2, false);
					}
				} else if (this.firstSelection > partId) {
					for (id = this.firstSelection - 1; id >= partId; --id) {
						this._map.selectPart(id, 2, false);
					}
				}
			} else {
				this._map.setPart(partId);
				this._map.selectPart(partId, 1, false); // And select.
				this.firstSelection = partId;
			}
		}
	},

	_updatePart: function (e) {
		if ((e.docType === 'presentation' || e.docType === 'drawing') && e.part >= 0) {
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
					this._previewTiles[it].src = 'images/preview_placeholder.png';
					this._previewTiles[it].fetched = false;
				}
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
		if (this._map.isPresentationOrDrawing()) {
			this._map._previewRequestsOnFly--;
			if (this._map._previewRequestsOnFly < 0) {
				this._map._previewRequestsOnFly = 0;
				this._map._timeToEmptyQueue = new Date();
			}
			this._map._processPreviewQueue();
			if (!this._previewInitialized)
				return;
			if (this._previewTiles[e.id])
				this._previewTiles[e.id].src = e.tile.src;
		}
	},

	_insertPreview: function (e) {
		if (this._map.isPresentationOrDrawing()) {
			var newIndex = e.selectedPart + 1;
			var newPreview = this._createPreview(newIndex, (e.hashCode === undefined ? null : e.hashCode));

			// insert newPreview to newIndex position
			this._previewTiles.splice(newIndex, 0, newPreview);

			var selectedFrame = this._previewTiles[e.selectedPart].parentNode;
			var newFrame = newPreview.parentNode;

			// insert after selectedFrame
			selectedFrame.parentNode.insertBefore(newFrame, selectedFrame.nextSibling);
		}
	},

	_deletePreview: function (e) {
		if (this._map.isPresentationOrDrawing()) {
			var selectedFrame = this._previewTiles[e.selectedPart].parentNode;
			L.DomUtil.remove(selectedFrame);

			this._previewTiles.splice(e.selectedPart, 1);
		}
	},

	_showMasterSlides: function() {
		for (var i = this._map._docLayer._masterPageCount; i < this._previewTiles.length; ++i) {
			$(this._previewTiles[i]).hide();
		}
	},

	_hideMasterSlides: function() {
		for (var i = this._map._docLayer._masterPageCount; i < this._previewTiles.length; ++i) {
			$(this._previewTiles[i]).show();
		}
	},

	_onScroll: function (e) {
		setTimeout(L.bind(function (e) {
			var scrollOffset = 0;
			if (e) {
				var prevScrollY = this._scrollY;
				var rectangle = e.target.getBoundingClientRect();
				this._scrollY = this._direction === 'x' ? -rectangle.left : -rectangle.top;
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
							img.fetched = true;
							this._map.getPreview(i, i, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate});
						}
					} else if ((previewFrameBB.top >= topBound && previewFrameBB.top <= bottomBound)
						|| (previewFrameBB.bottom >= topBound && previewFrameBB.bottom <= bottomBound)) {
						img.fetched = true;
						this._map.getPreview(i, i, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate});
					}
				}
			}
		}, this, e), 0);
	},

	_isPreviewVisible: function(part, isFetching) {
		isFetching = isFetching || false;
		var el = this._previewTiles[part];
		if (!el)
			return true;
		var elemRect = el.getBoundingClientRect();
		var elemTop = elemRect.top;
		var elemBottom = elemRect.bottom;
		var elemLeft = elemRect.left;
		var elemRight = elemRect.right;
		var isVisible = false;
		// dont skip the ones that are near visible or will be visible soon while scrolling.
		if (isFetching)
			isVisible = this._direction === 'x' ?
				(0 - window.innerWidth / 3 <= elemLeft) && (elemRight <= window.innerWidth + window.innerWidth / 3) :
				(0 - window.innerHeight / 3 <= elemTop) && (elemBottom <= window.innerHeight +  window.innerHeight / 3);
		else
			// this is for setPart function, should be completely visible for scrollto
			isVisible = this._direction === 'x' ?
				(elemLeft >= 0) && (elemRight <= window.innerWidth) :
				(elemTop >= 0) && (elemBottom <= window.innerHeight);

		if (!isVisible && isFetching)
			// mark as false, this will be canceled
			el.fetched = false;
		return isVisible;
	},

	_addDnDHandlers: function (elem) {
		if (app.file.fileBasedView) // No drag & drop for pdf files and the like.
			return;

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

	_addDnDTouchHandlers: function (e) {
		$(e.target).bind('touchmove', this._handleTouchMove.bind(this));
		$(e.target).bind('touchcancel', this._handleTouchCancel.bind(this));
		$(e.target).bind('touchend', this._handleTouchEnd.bind(this));

		// To avoid having to add a new message to move an arbitrary part, let's select the
		// slide that is being dragged.
		var part = this._findClickedPart(e.target.parentNode);
		if (part !== null) {
			var partId = parseInt(part) - 1; // The first part is just a drop-site for reordering.
			this._map.setPart(partId);
			this._map.selectPart(partId, 1, false); // And select.
		}
		this.draggedSlide = L.DomUtil.create('img', '', document.body);
		this.draggedSlide.setAttribute('src', e.target.currentSrc);
		$(this.draggedSlide).css('position', 'absolute');
		$(this.draggedSlide).css('height', e.target.height);
		$(this.draggedSlide).css('width', e.target.width);
		$(this.draggedSlide).css('left', e.center.x - (e.target.width/2));
		$(this.draggedSlide).css('top', e.center.y - e.target.height);
		$(this.draggedSlide).css('z-index', '10');
		$(this.draggedSlide).css('opacity', '75%');
		$(this.draggedSlide).css('pointer-events', 'none');
		$('.preview-img').css('pointer-events', 'none');

		this.currentNode = null;
		this.previousNode = null;
	},

	_removeDnDTouchHandlers: function (e) {
		$(e.target).unbind('touchmove');
		$(e.target).unbind('touchcancel');
		$(e.target).unbind('touchend');
		$('.preview-img').css('pointer-events', '');
	},

	_handleTouchMove: function (e) {
		if (e.preventDefault) {
			e.preventDefault();
		}

		this.currentNode = document.elementFromPoint(e.originalEvent.touches[0].clientX, e.originalEvent.touches[0].clientY);

		if (this.currentNode !== this.previousNode && this.previousNode !== null) {
			$('.preview-frame').removeClass('preview-img-dropsite');
		}

		if (this.currentNode.draggable || this.currentNode.id === 'first-drop-site') {
			this.currentNode.classList.add('preview-img-dropsite');
		}

		this.previousNode = this.currentNode;

		$(this.draggedSlide).css('left', e.originalEvent.touches[0].clientX - (e.target.width/2));
		$(this.draggedSlide).css('top', e.originalEvent.touches[0].clientY - e.target.height);
		return false;
	},

	_handleTouchCancel: function(e) {
		$('.preview-frame').removeClass('preview-img-dropsite');
		$(this.draggedSlide).remove();
		this._removeDnDTouchHandlers(e);
	},

	_handleTouchEnd: function (e) {
		if (e.stopPropagation) {
			e.stopPropagation();
		}
		if (this.currentNode) {
			var part = this._findClickedPart(this.currentNode);
			if (part !== null) {
				var partId = parseInt(part) - 1; // First frame is a drop-site for reordering.
				if (partId < 0)
					partId = -1; // First item is -1.
				app.socket.sendMessage('moveselectedclientparts position=' + partId);
			}
		}
		$('.preview-frame').removeClass('preview-img-dropsite');
		$(this.draggedSlide).remove();
		this._removeDnDTouchHandlers(e);
		return false;
	},

	_handleDragStart: function (e) {
		// To avoid having to add a new message to move an arbitrary part, let's select the
		// slide that is being dragged.
		var part = this.partsPreview._findClickedPart(e.target.parentNode);
		if (part !== null) {
			var partId = parseInt(part) - 1; // The first part is just a drop-site for reordering.
			if (this.partsPreview._map._docLayer && !this.partsPreview._map._docLayer._selectedParts.indexOf(partId) >= 0)
			{
				this.partsPreview._map.setPart(partId);
				this.partsPreview._map.selectPart(partId, 1, false); // And select.
			}
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

		var part = this.partsPreview._findClickedPart(e.target.parentNode);
		if (part !== null) {
			var partId = parseInt(part) - 1; // First frame is a drop-site for reordering.
			if (partId < 0)
				partId = -1; // First item is -1.
			app.socket.sendMessage('moveselectedclientparts position=' + partId);
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
