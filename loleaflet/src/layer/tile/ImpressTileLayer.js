/* -*- js-indent-level: 8 -*- */
/*
 * Impress tile layer is used to display a presentation document
 */

/* global $ L isAnyVexDialogActive */

L.ImpressTileLayer = L.CanvasTileLayer.extend({

	initialize: function (url, options) {
		L.TileLayer.prototype.initialize.call(this, url, options);
		this._preview = L.control.partsPreview();
		this._partHashes = null;
		if (window.mode.isMobile()) {
			this._addButton = L.control.mobileSlide();
			L.DomUtil.addClass(L.DomUtil.get('mobile-edit-button'), 'impress');
		}
	},

	newAnnotation: function (comment) {
		this._annotationManager.newAnnotation(comment);
	},

	beforeAdd: function (map) {
		this._map = map;
		map.addControl(this._preview);
		map.on('updateparts', this.onUpdateParts, this);
		map.on('updatepermission', this.onUpdatePermission, this);
		map.on('resize', this.onResize, this);

		this._annotationManager = L.annotationManagerImpress(map);
		map.uiManager.initializeSpecializedUI(this._docType);
		if (window.mode.isMobile()) {

			L.Control.MobileWizard.mergeOptions({maxHeight: '55%'});
			var mobileWizard = L.DomUtil.get('mobile-wizard');
			//var mobileWizardContent = L.DomUtil.get('mobile-wizard-content');
			var container = L.DomUtil.createWithId('div', 'mobile-wizard-header', mobileWizard);
			var preview = L.DomUtil.createWithId('div', 'mobile-slide-sorter', container);
			L.DomUtil.toBack(container);
			map.addControl(L.control.partsPreview(container, preview, {
				fetchThumbnail: false,
				allowOrientation: false,
				axis: 'x',
				imageClass: 'preview-img-portrait',
				frameClass: 'preview-frame-portrait'
			}));
			//L.DomUtil.addClass(mobileWizardContent, 'with-slide-sorter-above');
		}
	},

	getAnnotation: function (id) {
		return this._annotationManager.getAnnotation(id);
	},

	hideAnnotations: function (part) {
		return this._annotationManager.hideAnnotation(part);
	},

	hasAnnotations: function (part) {
		return this._annotationManager.hasAnnotations(part);
	},

	updateDocBounds: function (count, extraSize) {
		return this._annotationManager.updateDocBounds(count, extraSize);
	},

	onResize: function () {
		if (window.mode.isDesktop()) {
			this._map.setView(this._map.getCenter(), this._map.getZoom(), {reset: true});
		}

		L.DomUtil.updateElementsOrientation(['presentation-controls-wrapper', 'document-container', 'slide-sorter']);

		// update parts
		var visible = L.DomUtil.getStyle(L.DomUtil.get('presentation-controls-wrapper'), 'display');
		if (visible !== 'none') {
			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				selectedParts: this._selectedParts,
				parts: this._parts,
				docType: this._docType,
				partNames: this._partHashes
			});
		}
	},

	onRemove: function () {
		clearTimeout(this._previewInvalidator);
	},

	onAnnotationCancel: function () {
		this._annotationManager.onAnnotationCancel();
	},

	onAnnotationModify: function (annotation) {
		this._annotationManager.onAnnotationModify(annotation);
	},

	onAnnotationReply: function (annotation) {
		this._annotationManager.onAnnotationReply(annotation);
	},

	onAnnotationRemove: function (id) {
		this._annotationManager.onAnnotationRemove(id);
	},

	_openMobileWizard: function(data) {
		L.TileLayer.prototype._openMobileWizard.call(this, data);
		$('mobile-slide-sorter').mCustomScrollbar('update');
	},

	onUpdateParts: function () {
		if (isAnyVexDialogActive()) // Need this check else vex loses focus
			return;
		if (typeof this._prevSelectedPart === 'number') {
			this._annotationManager.onPartChange(this._prevSelectedPart);
		}
	},

	onUpdatePermission: function (e) {
		if (window.mode.isMobile()) {
			if (e.perm === 'edit') {
				this._addButton.addTo(this._map);
			} else {
				this._addButton.remove();
			}
		}
	},

	clearAnnotations: function () {
		this._annotationManager.clearAnnotations();
	},

	layoutAnnotations: function () {
		this._annotationManager.layoutAnnotations();
	},

	unselectAnnotations: function () {
		this._annotationManager.unselectAnnotations();
	},

	removeAnnotation: function (id) {
		this._annotationManager.removeAnnotation(id);
	},

	_onCommandValuesMsg: function (textMsg) {
		try {
			var values = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
		} catch (e) {
			// One such case is 'commandvalues: ' for draw documents in response to .uno:AcceptTrackedChanges
			values = null;
		}

		if (!values) {
			return;
		}

		if (values.comments) {
			this._annotationManager.addCommentsFromCommandValues(values.comments);
		} else {
			L.TileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('comment:')) {
			var object = JSON.parse(textMsg.substring('comment:'.length + 1));
			if (object.comment.author in this._map._viewInfoByUserName) {
				object.comment.avatar = this._map._viewInfoByUserName[object.comment.author].userextrainfo.avatar;
			}
			this._annotationManager.processCommentMessage(object.comment);
		} else {
			L.TileLayer.prototype._onMessage.call(this, textMsg, img);
		}
	},

	_onInvalidateTilesMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.x === undefined || command.y === undefined || command.part === undefined) {
			var strTwips = textMsg.match(/\d+/g);
			command.x = parseInt(strTwips[0]);
			command.y = parseInt(strTwips[1]);
			command.width = parseInt(strTwips[2]);
			command.height = parseInt(strTwips[3]);
			command.part = this._selectedPart;
		}
		var topLeftTwips = new L.Point(command.x, command.y);
		var offset = new L.Point(command.width, command.height);
		var bottomRightTwips = topLeftTwips.add(offset);
		if (this._debug) {
			this._debugAddInvalidationRectangle(topLeftTwips, bottomRightTwips, textMsg);
		}
		var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);
		var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
		var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
		var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);
		var needsNewTiles = false;
		for (var key in this._tiles) {
			var coords = this._tiles[key].coords;
			var tileTopLeft = this._coordsToTwips(coords);
			var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
			var bounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
			if (coords.part === command.part && invalidBounds.intersects(bounds)) {
				if (this._tiles[key]._invalidCount) {
					this._tiles[key]._invalidCount += 1;
				}
				else {
					this._tiles[key]._invalidCount = 1;
				}
				if (visibleArea.intersects(bounds)) {
					needsNewTiles = true;
					if (this._debug) {
						this._debugAddInvalidationData(this._tiles[key]);
					}
				}
				else {
					// tile outside of the visible area, just remove it
					this._removeTile(key);
				}
			}
		}

		if (needsNewTiles && command.part === this._selectedPart && this._debug)
		{
			this._debugAddInvalidationMessage(textMsg);
		}

		for (key in this._tileCache) {
			// compute the rectangle that each tile covers in the document based
			// on the zoom level
			coords = this._keyToTileCoords(key);
			if (coords.part !== command.part) {
				continue;
			}
			var scale = this._map.getZoomScale(coords.z);
			topLeftTwips = new L.Point(
				this.options.tileWidthTwips / scale * coords.x,
				this.options.tileHeightTwips / scale * coords.y);
			bottomRightTwips = topLeftTwips.add(new L.Point(
				this.options.tileWidthTwips / scale,
				this.options.tileHeightTwips / scale));
			bounds = new L.Bounds(topLeftTwips, bottomRightTwips);
			if (invalidBounds.intersects(bounds)) {
				delete this._tileCache[key];
			}
		}
		if (command.part === this._selectedPart &&
			command.part !== this._lastValidPart) {
			this._map.fire('updatepart', {part: this._lastValidPart, docType: this._docType});
			this._lastValidPart = command.part;
			this._map.fire('updatepart', {part: command.part, docType: this._docType});
		}

		var preview = this._map._docPreviews[command.part];
		if (preview) {
			preview.invalid = true;
		}
		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart) {
			this._map.setPart(part, true);
			this._map.fire('setpart', {selectedPart: this._selectedPart});
		}
	},

	_onStatusMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		// Since we have two status commands, remove them so we store and compare payloads only.
		textMsg = textMsg.replace('status: ', '');
		textMsg = textMsg.replace('statusupdate: ', '');
		if (command.width && command.height && this._documentInfo !== textMsg) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			if (this._docType === 'drawing') {
				L.DomUtil.addClass(L.DomUtil.get('presentation-controls-wrapper'), 'drawing');
			}
			this._updateMaxBounds(true);
			this._documentInfo = textMsg;
			this._parts = command.parts;
			this._viewId = parseInt(command.viewid);
			this._selectedPart = command.selectedPart;
			this._selectedParts = command.selectedParts || [command.selectedPart];
			this._resetPreFetching(true);
			this._update();
			var partMatch = textMsg.match(/[^\r\n]+/g);
			// only get the last matches
			this._partHashes = partMatch.slice(partMatch.length - this._parts);
			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				selectedParts: this._selectedParts,
				parts: this._parts,
				docType: this._docType,
				partNames: this._partHashes
			});
		}
	},

	_updateMaxBounds: function (sizeChanged, options) {
		var extraSize = options ? options.extraSize : null;
		if (!extraSize) {
			extraSize = this._annotationManager.allocateExtraSize();
		}
		L.GridLayer.prototype._updateMaxBounds.call(this, sizeChanged, {panInside: false, extraSize: extraSize});
	},

	_createCommentStructure: function (menuStructure) {
		var rootComment;
		var annotations = this._annotationManager._annotations[this._partHashes[this._selectedPart]];

		for (var i in annotations) {
			rootComment = {
				id: 'comment' + annotations[i]._data.id,
				enable: true,
				data: annotations[i]._data,
				type: 'rootcomment',
				text: annotations[i]._data.text,
				annotation: annotations[i],
				children: []
			};
			menuStructure['children'].push(rootComment);
		}
	},

	_addHighlightSelectedWizardComment: function(annotation) {
		if (this.lastWizardCommentHighlight) {
			this.lastWizardCommentHighlight.removeClass('impress-comment-highlight');
		}
		this.lastWizardCommentHighlight = $(this._map._layers[annotation._annotationMarker._leaflet_id]._icon);
		this.lastWizardCommentHighlight.addClass('impress-comment-highlight');
	},

	_removeHighlightSelectedWizardComment: function() {
		if (this.lastWizardCommentHighlight)
			this.lastWizardCommentHighlight.removeClass('impress-comment-highlight');
	}
});
