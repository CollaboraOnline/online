/* -*- js-indent-level: 8 -*- */
/*
 *  L.AnnotationManagerImpress
 */

/* global L */

L.AnnotationManagerImpress = L.AnnotationManagerBase.extend({
	options: {
		marginX: 40,
		marginY: 10,
		offset: 5,
		extraSize: L.point(290, 0),
		popupOffset: 10,
		showInline: false
	},
	_initializeSpecific: function () {
		this._map.on('zoomend', this._onAnnotationZoom, this);
		this._map.on('AnnotationSelect', this._onAnnotationSelect, this);
		this._map.on('AnnotationCancel', this.onAnnotationCancel, this);
		this._map.on('AnnotationClick', this.onAnnotationClick, this);
		this._map.on('AnnotationSave', this.onAnnotationSave, this);
		this._map.on('AnnotationScrollUp', this.onAnnotationScrollUp, this);
		this._map.on('AnnotationScrollDown', this.onAnnotationScrollDown, this);
		this._map.on('AnnotationReply', this.onReplyClick, this);

		this._annotations = {};
		this._topAnnotation = [];
		this._topAnnotation[this.getSelectedPart()] = 0;
		this._selectedAnnotation = undefined;
		this._selectedForPopup = null;
		this._selectionLine = L.polyline([], {color: 'darkblue', weight: 1.2});
		this._draft = null;
	},
	getPartHashes: function() {
		return this._doclayer._partHashes;
	},
	getPartHash: function(part) {
		return this.getPartHashes()[part];
	},
	getSelectedPart: function() {
		return this._doclayer._selectedPart;
	},
	getSelectedPartHash: function() {
		var part = this.getSelectedPart();
		return this.getPartHash(part);
	},
	getAnnotation: function (id) {
		var annotations = this._annotations[this.getSelectedPartHash()];
		for (var index in annotations) {
			if (annotations[index]._data.id === id) {
				return annotations[index];
			}
		}
		return null;
	},
	newAnnotation: function (comment) {
		if (this._draft) {
			return;
		}
		this.onAnnotationCancel();

		if (window.mode.isMobile() || window.mode.isTablet()) {
			this._doclayer.newAnnotationVex(comment, this.onAnnotationSave);
		}
		else {
			this._draft = L.annotation(L.latLng(0, 0), comment, {noMenu: true}).addTo(this._map);
			this._draft.edit();
			var mapCenter = this._map.latLngToLayerPoint(this._map.getCenter());
			var bounds = this._draft.getBounds();
			var topLeft = mapCenter.subtract(L.point(bounds.max.x - bounds.min.x, (bounds.max.y - bounds.min.y)/2));
			this._draft.setLatLng(this._map.layerPointToLatLng(topLeft));
			this.layoutAnnotations();
			this._draft.focus();
		}
	},
	hideAnnotations: function (part) {
		this._selectedAnnotation = undefined;
		var annotations = this._annotations[this.getPartHash(part)];
		for (var index in annotations) {
			annotations[index].hide();
		}
	},
	hasAnnotations: function (part) {
		var annotations = this._annotations[this.getPartHash(part)];
		return annotations && annotations.length > 0;
	},
	updateDocBounds: function (count, extraSize) {
		var annotations = this._annotations[this.getSelectedPartHash()];
		if (annotations && annotations.length === count) {
			this._map._docLayer._updateMaxBounds(true, extraSize);
		}
	},
	unselectAnnotations: function() {
		this.onAnnotationCancel();
	},
	_onAnnotationZoom: function () {
		this.onAnnotationCancel();
	},
	_onAnnotationSelect: function (event) {
		this._selectedForPopup = event.annotation;
		this._map.focus();
		this.layoutAnnotations();
	},
	onAnnotationCancel: function () {
		if (this._draft) {
			this._map.removeLayer(this._draft);
			this._draft = null;
		}
		this._selectedAnnotation = undefined;
		if (this._selectedForPopup) {
			this._map.removeLayer(this._selectionLine);
			this._selectedForPopup = null;
		}
		this._map.focus();
		this.layoutAnnotations();
	},
	onAnnotationModify: function (annotation) {
		this.onAnnotationCancel();
		this._selectedAnnotation = annotation._data.id;
		if (window.mode.isMobile() || window.mode.isTablet()) {
			this._doclayer.newAnnotationVex(annotation, this.onAnnotationSave, /* isMod */ true);
		}
		else {
			annotation.edit();
			this.scrollUntilAnnotationIsVisible(annotation);
			annotation.focus();
		}
	},
	onAnnotationReply: function (annotation) {
		this.onAnnotationCancel();
		this._selectedAnnotation = annotation._data.id;
		if (window.mode.isMobile() || window.mode.isTablet()) {
			var avatar = undefined;
			var author = this._map.getViewName(this._map._docLayer._viewId);
			if (author in this._map._viewInfoByUserName) {
				avatar = this._map._viewInfoByUserName[author].userextrainfo.avatar;
			}
			var replyAnnotation = {
				text: '',
				textrange: '',
				author: author,
				dateTime: new Date().toDateString(),
				id: annotation._data.id,
				avatar: avatar,
				parent: annotation._data.parent
			};
			this._doclayer.newAnnotationVex(replyAnnotation, annotation._onReplyClick,/* isMod */ false, '');
		} else {
			annotation.reply();
			this.scrollUntilAnnotationIsVisible(annotation);
			annotation.focus();
		}
	},
	onReplyClick: function (e) {
		var comment = {
			Id: {
				type: 'string',
				value: e.annotation._data.id
			},
			Text: {
				type: 'string',
				value: e.annotation._data.reply
			}
		};
		this._map.sendUnoCommand('.uno:ReplyToAnnotation', comment);
		this._selectedAnnotation = undefined;
		this._map.focus();
	},
	onAnnotationRemove: function (id) {
		this.onAnnotationCancel();
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		this._map.sendUnoCommand('.uno:DeleteAnnotation', comment);
		this._map.focus();
	},
	onAnnotationClick: function (event) {
		this._selectedForPopup = event.annotation;
		this.layoutAnnotations();
	},
	onAnnotationSave: function (event) {
		var comment;
		if (this._draft) {
			comment = {
				Text: {
					type: 'string',
					value: this._draft._data.text
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
			this._map.removeLayer(this._draft);
			this._draft = null;
		} else {
			comment = {
				Id: {
					type: 'string',
					value: event.annotation._data.id
				},
				Text: {
					type: 'string',
					value: event.annotation._data.text
				}
			};
			this._map.sendUnoCommand('.uno:EditAnnotation', comment);
			this._selectedAnnotation = undefined;
		}
		this._map.focus();
	},
	countDocumentAnnotations: function () {
		var count = 0;
		if (this._annotations) {
			for (var part in this._annotations) {
				count = count + this._annotations[part].length;
			}
		}
		return count;
	},
	findNextPartWithComment: function () {
		var part = this.getSelectedPart() + 1;

		while (part < this._map._docLayer._parts) {
			var annotations = this._annotations[this.getPartHash(part)];
			if (annotations && annotations.length)
				return part;

			part = part + 1;
		}

		return null;
	},
	findPreviousPartWithComment: function () {
		var part = this.getSelectedPart() - 1;

		while (part >= 0) {
			var annotations = this._annotations[this.getPartHash(part)];
			if (annotations && annotations.length)
				return part;

			part = part - 1;
		}

		return null;
	},
	onAnnotationScrollDown: function () {
		var part = this.getSelectedPart();
		var annotations = this._annotations[this.getPartHash(part)];
		var commentsOnThePage = annotations ? annotations.length - 1 : 0;

		if (commentsOnThePage >= this._topAnnotation[part] + 1) {
			this._topAnnotation[part] = this._topAnnotation[part] + 1;

			this.onAnnotationCancel();
		} else if (part + 1 < this._map._docLayer._parts) {
			var newPart = this.findNextPartWithComment();
			if (newPart)
				this._map.setPart(newPart);
		}
		var offset = this._map._getCenterOffset(this._map.options.docBounds.getNorthEast());
		this._map.panBy({x: offset.x, y: 0});
	},
	onAnnotationScrollUp: function () {
		var part = this.getSelectedPart();
		if (!this._topAnnotation[part] || this._topAnnotation[part] === 0) {
			var newPart = this.findPreviousPartWithComment();
			if (newPart != null)
				this._map.setPart(newPart);
		} else {
			this._topAnnotation[part] = Math.max(--this._topAnnotation[part], 0);
			this.onAnnotationCancel();
		}

		var offset = this._map._getCenterOffset(this._map.options.docBounds.getNorthEast());
		this._map.panBy({x: offset.x, y: 0});
	},
	onPartChange: function (previous) {
		var part = this.getSelectedPart();
		this.hideAnnotations(previous);

		if (this.hasAnnotations(part)) {
			this._map._docLayer._updateMaxBounds(true);
			if (this._topAnnotation[part] === undefined) {
				this._topAnnotation[part] = 0;
			}
			this.onAnnotationCancel();
		}
	},
	clearAnnotations: function () {
		var annotation;
		var annotations;
		for (var key in this._annotations) {
			annotations = this._annotations[key];
			while (annotations.length > 0) {
				annotation = annotations.pop();
				if (annotation) {
					this._map.removeLayer(annotation);
				}
			}
		}
		this._annotations = {};
	},
	removeAnnotation: function (id) {
		// Removed annotation may be in another page. So we look inside all of them till we find the matching one.
		// Hmm let's return page index to specify the page subject to re-order annotations.
		var pageIndex = -1;

		var findFunction = function (item) {
			return item._data.id === id;
		};

		for (var i = 0; i < this.getPartHashes().length; i++) {
			var annotations = this._annotations[this.getPartHash(i)];
			var index = annotations.findIndex(findFunction);
			if (index !== -1) {
				this._map.removeLayer(annotations[index]);
				annotations.splice(index, 1);
				pageIndex = i;
				break;
			}
		}
		return pageIndex;
	},
	scrollUntilAnnotationIsVisible: function(annotation) {
		var bounds = annotation.getBounds();
		var mapBounds = this._map.getBounds();
		if (this._map.layerPointToLatLng(bounds.getTopRight()).lat > mapBounds.getNorth()) {
			this._topAnnotation[this.getSelectedPart()] = Math.max(this._topAnnotation[this.getSelectedPart()] - 2, 0);
		}
		else if (this._map.layerPointToLatLng(bounds.getBottomLeft()).lat < mapBounds.getSouth()) {
			this._topAnnotation[this.getSelectedPart()] = Math.min(this._topAnnotation[this.getSelectedPart()] + 2, this._annotations[this.getSelectedPartHash()].length - 1);
		}
		this.layoutAnnotations();
	},
	layoutAnnotations: function () {
		var topAnnotation;
		var annotations = this._annotations[this.getSelectedPartHash()];

		// Keeping annotations close to slide to avoide being overlapped by controls
		var diffPoint = L.point(5, this.options.marginY);
		var topRight = this._map.latLngToLayerPoint(this._map.options.docBounds.getNorthEast()).add(diffPoint);
		var bounds = null;
		for (var index in annotations) {
			var annotation = annotations[index];
			if (!this._topAnnotation[this.getSelectedPart()]) {
				this._topAnnotation[this.getSelectedPart()] = 0;
			}
			topAnnotation = this._topAnnotation[this.getSelectedPart()];
			if (topAnnotation > 0 && parseInt(index) === topAnnotation - 1) {
				// if the top annotation is not the first one, show a bit of the bottom of the previous annotation
				// so that the user gets aware that there are more annotations above.

				// get annotation bounds
				annotation.setLatLng(this._map.layerPointToLatLng(L.point(0, -100000))); // placed where it's not visible
				annotation.show(); // if it's hidden the bounds are wrong
				bounds = annotation.getBounds();
				annotation.hide();
				var topLeft = topRight.subtract(L.point(0, bounds.max.y-bounds.min.y));
				annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
				annotation.show();
				bounds = annotation.getBounds();
				bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));
			}
			else if (index >= topAnnotation) { // visible annotations
				var offsetX;
				if (annotation._data.id === this._selectedAnnotation) {
					if (bounds) {
						bounds.extend(L.point(bounds.max.x, bounds.max.y + 2 * this.options.marginY));
					}
					offsetX = L.point(2 * this.options.marginX, 0);
					topLeft = (bounds ? bounds.getBottomLeft() : topRight).subtract(offsetX);
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					bounds = annotation.getBounds();
					bounds = L.bounds(bounds.getBottomLeft().add(offsetX), bounds.getTopRight().add(offsetX));
					bounds.extend(L.point(bounds.max.x, bounds.max.y + 3 * this.options.marginY));
				}
				else if (this._selectedForPopup && annotation._data.id === this._selectedForPopup._data.id) {
					var marker = this._selectedForPopup._annotationMarker;
					var latlng = marker.getLatLng();
					var point = this._map.latLngToLayerPoint(latlng);
					var rect = marker._icon.getBoundingClientRect();

					if (this.options.showInline) {
						point = point.add(L.point(0, rect.height + this.options.popupOffset));
						annotation.setLatLng(this._map.layerPointToLatLng(point));
					}
					else {
						topLeft = bounds ? bounds.getBottomLeft() : topRight;
						annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
						annotation.show();
						bounds = annotation.getBounds();
						bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));

						var marginY = this.options.marginY;

						var annotationMarkerRightCenter = point.add(L.point(rect.width, rect.height / 2));
						var annotationLeftCenter = topLeft.add(L.point(0, bounds.getSize().y / 2));
						var connectionPoint1 = L.point(annotationLeftCenter.x - marginY, annotationMarkerRightCenter.y);
						var connectionPoint2 = L.point(annotationLeftCenter.x - marginY, annotationLeftCenter.y);

						this._selectionLine.setLatLngs([
							this._map.layerPointToLatLng(annotationMarkerRightCenter),
							this._map.layerPointToLatLng(connectionPoint1),
							this._map.layerPointToLatLng(connectionPoint2),
							this._map.layerPointToLatLng(annotationLeftCenter)
						]);
						this._map.addLayer(this._selectionLine);
					}
				}
				else {
					topLeft = bounds ? bounds.getBottomLeft() : topRight;
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					annotation.show();
					if (this.countDocumentAnnotations() > 1) {
						bounds = annotation.getBounds();
						bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));
					}
				}
			} else {
				annotation.hide();
			}
		}
		if (bounds) {
			if (!this._scrollAnnotation) {
				this._scrollAnnotation = L.control.scrollannotation();
				this._scrollAnnotation.addTo(this._map);
			}
		} else if (this._scrollAnnotation) {
			this._map.removeControl(this._scrollAnnotation);
			this._scrollAnnotation = null;
		}
	},
	addCommentsFromCommandValues: function (comments) {
		this.clearAnnotations();
		for (var index in comments) {
			var comment = comments[index];
			if (!this._annotations[comment.parthash]) {
				this._annotations[comment.parthash] = [];
			}
			this._annotations[comment.parthash].push(L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map));
		}
		if (!this._topAnnotation) {
			this._topAnnotation = [];
		}
		this._topAnnotation[this.getSelectedPart()] = 0;
		if (this.hasAnnotations(this.getSelectedPart())) {
			this._map._docLayer._updateMaxBounds(true);
		}
		this.layoutAnnotations();
	},
	processCommentMessage: function (comment) {
		if (comment.action === 'Add') {
			if (!this._annotations[comment.parthash]) {
				this._annotations[comment.parthash] = [];
			}
			this._annotations[comment.parthash].push(L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map));
			this._topAnnotation[this.getSelectedPart()] = Math.min(this._topAnnotation[this.getSelectedPart()], this._annotations[this.getSelectedPartHash()].length - 1);
			this.updateDocBounds(1, this.extraSize);
			this.layoutAnnotations();
			if (window.mode.isMobile())
				this._map._docLayer._openCommentWizard(this.getAnnotation(comment.id));
		} else if (comment.action === 'Remove') {
			var pageIndex = this.removeAnnotation(comment.id);
			if (pageIndex != -1) {
				this._topAnnotation[pageIndex] = Math.min(this._topAnnotation[pageIndex], this._annotations[this.getPartHash(pageIndex)].length - 1);
				this.updateDocBounds(0);
				this.layoutAnnotations();
				if (window.mode.isMobile())
					this._map._docLayer._openCommentWizard();
			}
		} else if (comment.action === 'Modify') {
			var modified = this.getAnnotation(comment.id);
			if (modified) {
				modified._data = comment;
				modified.update();
				this._selectedAnnotation = undefined;
				this.layoutAnnotations();
			}
			if (window.mode.isMobile())
				this._map._docLayer._openCommentWizard(modified);
		}
	},
	allocateExtraSize: function() {
		var annotations = [];
		if (this._annotations && this.getPartHashes() && this.getSelectedPart() !== undefined)
			annotations = this._annotations[this.getSelectedPartHash()];
		return (annotations !== undefined && annotations.length > 0) ? this.options.extraSize : new L.Point(0, 0);
	}
});

L.annotationManagerImpress = function (map, options) {
	return new L.AnnotationManagerImpress(map, options);
};
