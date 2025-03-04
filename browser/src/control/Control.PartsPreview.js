/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * L.Control.PartsPreview
 */

/* global _ app $ Hammer _UNO cool TileManager */
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
		this._idNum = 0;
		this._width = 0;
		this._height = 0;
	},

	onAdd: function (map) {
		this._previewInitialized = false;
		this._previewTiles = [];
		this._direction = this.options.allowOrientation ?
			(!window.mode.isDesktop() && L.DomUtil.isPortrait() ? 'x' : 'y') :
			this.options.axis;

		map.on('updateparts', this._updateDisabled, this);
		map.on('updatepart', this._updatePart, this);
		map.on('invalidateparts', this._invalidateParts, this);
		map.on('tilepreview', this._updatePreview, this);
		map.on('insertpage', this._insertPreview, this);
		map.on('deletepage', this._deletePreview, this);
		map.on('scrolllimits', this._invalidateParts, this);
		map.on('scrolltopart', this._scrollToPart, this);
		map.on('beforerequestpreview', this._beforeRequestPreview, this);

		window.addEventListener('resize', L.bind(this._resize, this));
	},

	createScrollbar: function () {
		this._partsPreviewCont.style.whiteSpace = 'nowrap';
	},

	_updateDisabled: function () {
		const selectedPart = app.map._docLayer._selectedPart;

		const docType = app.map._docLayer._docType;

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
				for (var i = 0; i < app.impress.partList.length; i++) {
					this._previewTiles.push(this._createPreview(i, app.impress.partList[i].hash));
				}
				if (!app.file.fileBasedView)
					L.DomUtil.addClass(this._previewTiles[selectedPart], 'preview-img-currentpart');
				this._onScroll(); // Load previews.
				this._previewInitialized = true;
			}
			else
			{
				this._syncPreviews();

				if (!app.file.fileBasedView) {
					// change the border style of the selected preview.
					for (let j = 0; j < app.impress.partList.length; j++) {
						L.DomUtil.removeClass(this._previewTiles[j], 'preview-img-currentpart');
						L.DomUtil.removeClass(this._previewTiles[j], 'preview-img-selectedpart');
						if (j === selectedPart)
							L.DomUtil.addClass(this._previewTiles[j], 'preview-img-currentpart');
						else if (app.impress.partList[j].selected)
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

			for (i = 0; i < app.impress.partList.length; i++) {
				L.DomUtil.removeClass(this._previewTiles[i], removePreviewImg);
				L.DomUtil.addClass(this._previewTiles[i], addPreviewImg);
				if (app.impress.isSlideHidden(i))
					L.DomUtil.addClass(this._previewTiles[i], 'hidden-slide');
				else
					L.DomUtil.removeClass(this._previewTiles[i], 'hidden-slide');
			}

			var previewFrame = $(this._partsPreviewCont).find('.preview-frame');
			previewFrame.removeClass(removePreviewFrame);
			previewFrame.addClass(addPreviewFrame);

			// re-create scrollbar with new direction
			this._direction = !window.mode.isDesktop() && !window.mode.isTablet() && L.DomUtil.isPortrait() ? 'x' : 'y';
		}
	},

	isPaddingClick: function (element, e, part) {
		var style = window.getComputedStyle(element, null);
		var nTop = parseInt(style.getPropertyValue('padding-top'));
		var nRight = parseFloat(style.getPropertyValue('padding-right'));
		var nLeft = parseFloat(style.getPropertyValue('padding-left'));
		var nBottom = parseFloat(style.getPropertyValue('padding-bottom'));
		var width = element.offsetWidth;
		var height = element.offsetHeight;
		var x = parseFloat(e.offsetX);
		var y = parseFloat(e.offsetY);

		if (part === 'top')         // Clicked on top padding?
			return !(y > nTop);
		else if (part === 'bottom') // Clicked on bottom padding?
			return !(y < height - nBottom);
		else                        // Clicked on any padding?
			return !((x > nLeft && x < width - nRight) && (y > nTop && y < height - nBottom));
	},

	_createPreview: function (i, hashCode) {
		var frameClass = 'preview-frame ' + this.options.frameClass;
		var frame = L.DomUtil.create('div', frameClass, this._partsPreviewCont);
		frame.id = 'preview-frame-part-' + this._idNum;
		this._addDnDHandlers(frame);
		L.DomUtil.create('span', 'preview-helper', frame);

		var imgClassName = 'preview-img ' + this.options.imageClass;
		var img = L.DomUtil.create('img', imgClassName, frame);
		img.setAttribute('alt', _('preview of page ') + String(i + 1));
		img.id = 'preview-img-part-' + this._idNum;
		img.hash = hashCode;
		img.src = document.querySelector('meta[name="previewSmile"]').content;
		img.fetched = false;
		if (!window.mode.isDesktop()) {
			(new Hammer(img, {recognizers: [[Hammer.Press]]}))
				.on('press', function (e) {
					if (this._map.isEditMode()) {
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
						app.dispatcher.dispatch('mobile_wizard');
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
			if (app.file.fileBasedView)
				this._map._docLayer._checkSelectedPart();
		}, this);

		var that = this;
		L.DomEvent.on(frame, 'contextmenu', function(e) {
			var isMasterView = this._map['stateChangeHandler'].getItemValue('.uno:SlideMasterPage');
			var pcw = document.getElementById('presentation-controls-wrapper');
			var $trigger = $(pcw);
			if (isMasterView === 'true') {
				$trigger.contextMenu(false);
				return;
			}

			var nPos = undefined;
			if (this.isPaddingClick(frame, e, 'top'))
				nPos = that._findClickedPart(frame) - 1;
			else if (this.isPaddingClick(frame, e, 'bottom'))
				nPos = that._findClickedPart(frame);

			$trigger.contextMenu(true);
			that._setPart(e);
			$.contextMenu({
				selector: '#'+frame.id,
				className: 'cool-font',
				items: {
					paste: {
						name: _('Paste Slide'),
						callback: function(key, options) {
							var part = that._findClickedPart(options.$trigger[0].parentNode);
							if (part !== null) {
								that._setPart(that.copiedSlide);
								that._map.duplicatePage(parseInt(part));
							}
						},
						visible: function() {
							return that.copiedSlide;
						}
					},
					newslide: {
						name: _UNO(that._map._docLayer._docType == 'presentation' ? '.uno:InsertSlide' : '.uno:InsertPage', 'presentation'),
						callback: function() { that._map.insertPage(nPos); }
					}
				}
			});
		}, this);

		L.DomEvent.on(img, 'contextmenu', function(e) {
			var isMasterView = this._map['stateChangeHandler'].getItemValue('.uno:SlideMasterPage');
			var $trigger = $('#' + img.id);
			if (isMasterView === 'true') {
				$trigger.contextMenu(false);
				return;
			}
			$trigger.contextMenu(true);
			that._setPart(e);
			$.contextMenu({
				selector: '#' + img.id,
				className: 'cool-font',
				items: {
					copy: {
						name: _('Copy'),
						callback: function() {
							that.copiedSlide = e;
						},
						visible: function() {
							return true;
						}
					},
					paste: {
						name: _('Paste'),
						callback: function(key, options) {
							var part = that._findClickedPart(options.$trigger[0].parentNode);
							if (part !== null) {
								that._setPart(that.copiedSlide);
								that._map.duplicatePage(parseInt(part));
							}
						},
						visible: function() {
							return that.copiedSlide;
						}
					},
					newslide: {
						name: _UNO(that._map._docLayer._docType == 'presentation' ? '.uno:InsertSlide' : '.uno:InsertPage', 'presentation'),
						callback: function() { that._map.insertPage(); }
					},
					duplicateslide: {
						name: _UNO(that._map._docLayer._docType == 'presentation' ? '.uno:DuplicateSlide' : '.uno:DuplicatePage', 'presentation'),
						callback: function() { that._map.duplicatePage(); }
					},
					delete: {
						name: _UNO(that._map._docLayer._docType == 'presentation' ? '.uno:DeleteSlide' : '.uno:DeletePage', 'presentation'),
						callback: function() { app.dispatcher.dispatch('deletepage'); },
						visible: function() {
							return that._map._docLayer._parts > 1;
						}
					},
					slideproperties: {
						name: _UNO(that._map._docLayer._docType == 'presentation' ? '.uno:SlideSetup' : '.uno:PageSetup', 'presentation'),
						callback: function() {
							app.socket.sendMessage('uno .uno:PageSetup');
						}
					},
					showslide: {
						name: _UNO('.uno:ShowSlide', 'presentation'),
						callback: function(key, options) {
							var part = that._findClickedPart(options.$trigger[0].parentNode);
							if (part !== null) {
								that._map.showSlide();
							}
						},
						visible: function(key, options) {
							var part = that._findClickedPart(options.$trigger[0].parentNode);
							return that._map._docLayer._docType === 'presentation' && app.impress.isSlideHidden(parseInt(part) - 1);
						}
					},
					hideslide: {
						name: _UNO('.uno:HideSlide', 'presentation'),
						callback: function(key, options) {
							var part = that._findClickedPart(options.$trigger[0].parentNode);
							if (part !== null) {
								that._map.hideSlide();
							}
						},
						visible: function(key, options) {
							var part = that._findClickedPart(options.$trigger[0].parentNode);
							return that._map._docLayer._docType === 'presentation' && !app.impress.isSlideHidden(parseInt(part) - 1);
						}
					}
				}
			});
		}, this);

		var imgSize = this._map.getPreview(i, i,
						   this.options.maxWidth,
						   this.options.maxHeight,
						   {autoUpdate: this.options.autoUpdate,
						    fetchThumbnail: false});

		L.DomUtil.setStyle(img, 'width', imgSize.width + 'px');
		L.DomUtil.setStyle(img, 'height', imgSize.height + 'px');

		this._idNum++;

		return img;
	},

	_scrollToPart: function() {
		var partNo = this._map.getCurrentPartNumber();
		// update the page back and forward buttons status
		var pagerButtonsEvent = { selectedPart: partNo, parts: this._partsPreviewCont.children.length };
		window.onUpdateParts(pagerButtonsEvent);
		//var sliderSize, nodePos, nodeOffset, nodeMargin;
		var node = this._partsPreviewCont.children[partNo];

		if (node && (!this._previewTiles[partNo] || !this._isPreviewVisible(partNo))) {
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
		var ratio = TileManager.tileSize / app.tile.size.y;
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
		var ratio = TileManager.tileSize / app.tile.size.y;
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
		if (cool.Comment.isAnyEdit()) {
			cool.CommentSection.showCommentEditingWarning();
			return;
		}

		var part = this._findClickedPart(e.target.parentNode);
		if (part !== -1) {
			var partId = parseInt(part) - 1; // The first part is just a drop-site for reordering.

			if (app.file.fileBasedView) {
				this._map.setPart(partId);
				this._scrollViewToPartPosition(part - 1);
				return;
			}

			if (e.ctrlKey) {
				this._map.selectPart(partId, 2, false); // Toggle selection on ctrl+click.
				if (this.firstSelection === undefined)
					this.firstSelection = this._map._docLayer._selectedPart;
			} else if (e.altKey) {
				window.app.console.log('alt');
			} else if (e.shiftKey) {
				if (this.firstSelection === undefined)
					this.firstSelection = this._map._docLayer._selectedPart;

				//deselect all slides
				this._map.deselectAll();

				//reselect the first original selection
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
				this._map.deselectAll();
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

	_syncPreviews: function () {
		var it = 0;

		if (app.impress.partList.length !== this._previewTiles.length) {
			if (Math.abs(app.impress.partList.length - this._previewTiles.length) === 1) {
				if (app.impress.partList.length > this._previewTiles.length) {
					for (it = 0; it < app.impress.partList.length; it++) {
						if (it === this._previewTiles.length) {
							this._insertPreview({selectedPart: it - 1, hashCode: app.impress.partList[it].hash});
							break;
						}
						if (this._previewTiles[it].hash !== app.impress.partList[it].hash) {
							this._insertPreview({selectedPart: it, hashCode: app.impress.partList[it].hash});
							break;
						}
					}
				}
				else {
					for (it = 0; it < this._previewTiles.length; it++) {
						if (it === app.impress.partList.length ||
						    this._previewTiles[it].hash !== app.impress.partList[it].hash) {
							this._deletePreview({selectedPart: it});
							break;
						}
					}
				}
			}
			else {
				// sync all, should never happen
				while (this._previewTiles.length < app.impress.partList.length) {
					this._insertPreview({selectedPart: this._previewTiles.length - 1,
							     hashCode: app.impress.partList[this._previewTiles.length].hash});
				}

				while (this._previewTiles.length > app.impress.partList.length) {
					this._deletePreview({selectedPart: this._previewTiles.length - 1});
				}

				for (it = 0; it < app.impress.partList.length; it++) {
					this._previewTiles[it].hash = app.impress.partList[it].hash;
					this._previewTiles[it].src = document.querySelector('meta[name="previewSmile"]').content;
					this._previewTiles[it].fetched = false;
				}
			}
		}
		else {
			// update hash code when user click insert slide.
			for (it = 0; it < app.impress.partList.length; it++) {
				if (this._previewTiles[it].hash !== app.impress.partList[it].hash) {
					this._previewTiles[it].hash = app.impress.partList[it].hash;
					this._map.getPreview(it, it, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate});
				}
			}
		}
	},

	_resize: function () {
		if (this._height == window.innerHeight &&
		    this._width == window.innerWidth)
			return;

		if (this._previewInitialized) {
			clearTimeout(this._resizeTimer);
			this._resizeTimer = setTimeout(L.bind(this._onScroll, this), 50);
		}

		this._height = window.innerHeight;
		this._width = window.innerWidth;
	},

	_beforeRequestPreview: function (e) {
		if (e.part !== undefined && e.part >= 0 && e.part < this._previewTiles.length &&
		   this._previewTiles[e.part].src === document.querySelector('meta[name="previewSmile"]').content)
			this._previewTiles[e.part].src = document.querySelector('meta[name="previewImg"]').content;
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
			if (this._previewTiles[e.id]) {
				this._previewTiles[e.id].src = e.tile.src;
				this._previewTiles[e.id].fetched = true;
				window.app.console.debug('PREVIEW: part fetched : ' + e.id);
			}
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

	_onScroll: function () {
		setTimeout(L.bind(function () {
			for (var i = 0; i < this._previewTiles.length; ++i) {
				if (this._isPreviewVisible(i)) {
					var img = this._previewTiles[i];
					if (img && !img.fetched) {
						this._map.getPreview(i, i, this.options.maxWidth, this.options.maxHeight, {autoUpdate: this.options.autoUpdate});
					}
				}
			}
		}, this), 0);
	},

	_isPreviewVisible: function(part) {
		var el = this._previewTiles[part];
		if (!el)
			return false;

		var elemRect = el.getBoundingClientRect();
		var viewRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);

		return (elemRect.left <= viewRect.right &&
			viewRect.left <= elemRect.right &&
			elemRect.top <= viewRect.bottom &&
			viewRect.top <= elemRect.bottom)
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
		const targetNode = (e.target.id.startsWith('preview') ? e.target : e.target.parentNode);
		var part = this.partsPreview._findClickedPart(targetNode);
		if (part !== null) {
			var partId = parseInt(part) - 1; // The first part is just a drop-site for reordering.
			if (this.partsPreview._map._docLayer && !app.impress.isSlideSelected(partId))
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

		// When dropping on a thumbnail we get an `img` tag as a target, so we need to get the
		// parent.
		// Otherwise dropping between slides doesn't work.
		// See https://github.com/CollaboraOnline/online/issues/6941
		var target = e.target.classList.contains('preview-img') ? e.target.parentNode : e.target;

		var part = this.partsPreview._findClickedPart(target);
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
	},

	_invalidateParts: function () {
		if (!this._container ||
		    !this._partsPreviewCont ||
		    !this._previewInitialized ||
		    !this._previewTiles)
			return;

		for (var part = 0; part < this._previewTiles.length; part++) {
			this._previewTiles[part].fetched = false;
			this._map.getPreview(part, part,
					     this.options.maxWidth,
					     this.options.maxHeight,
					     {autoUpdate: this.options.autoUpdate,
					      fetchThumbnail: this.options.fetchThumbnail});
		}

	},
});

L.control.partsPreview = function (container, preview, options) {
	return new L.Control.PartsPreview(container, preview, options);
};
