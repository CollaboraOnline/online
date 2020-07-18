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
		extraSize: L.point(290, 0)
	},
	_initializeSpecific: function () {
		this._map.on('zoomend', this._onAnnotationZoom, this);
		this._map.on('AnnotationCancel', this.onAnnotationCancel, this);
		this._map.on('AnnotationClick', this.onAnnotationClick, this);
		this._map.on('AnnotationSave', this.onAnnotationSave, this);
		this._map.on('AnnotationScrollUp', this.onAnnotationScrollUp, this);
		this._map.on('AnnotationScrollDown', this.onAnnotationScrollDown, this);

		this._annotations = {};
		this._topAnnotation = [];
		this._topAnnotation[this.getSelectedPart()] = 0;
		this._selectedAnnotation = undefined;
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
	_onAnnotationZoom: function () {
		this.onAnnotationCancel();
	},
	onAnnotationCancel: function () {
		if (this._draft) {
			this._map.removeLayer(this._draft);
			this._draft = null;
		}
		this._map.focus();
		this._selectedAnnotation = undefined;
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
		annotation.reply();
		this.scrollUntilAnnotationIsVisible(annotation);
		annotation.focus();
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
	onAnnotationClick: function (e) {
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
	onAnnotationScrollDown: function () {
		var part = this.getSelectedPart();
		this._topAnnotation[part] = Math.min(this._topAnnotation[part] + 1, this._annotations[this.getPartHash(part)].length - 1);
		var topRight = this._map.latLngToLayerPoint(this._map.options.docBounds.getNorthEast());
		this._map.fire('scrollby', {x: topRight.x, y: 0});
		this.onAnnotationCancel();
	},
	onAnnotationScrollUp: function () {
		var part = this.getSelectedPart();
		if (this._topAnnotation[part] === 0) {
			this._map.fire('scrollby', {x: 0, y: -100});
		}
		this._topAnnotation[part] = Math.max(--this._topAnnotation[part], 0);
		this.onAnnotationCancel();
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
		var annotations = this._annotations[this.getSelectedPartHash()];
		for (var index in annotations) {
			if (annotations[index]._data.id == id) {
				this._map.removeLayer(annotations[index]);
				annotations.splice(index, 1);
				break;
			}
		}
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
		var topRight = this._map.latLngToLayerPoint(this._map.options.docBounds.getNorthEast())
			.add(L.point((this._selectedAnnotation ? 3 : 2) * this.options.marginX, this.options.marginY));
		var bounds, annotation;
		for (var index in annotations) {
			annotation = annotations[index];
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

			} else if (index >= topAnnotation) { // visible annotations
				if (annotation._data.id === this._selectedAnnotation) {
					if (bounds) {
						bounds.extend(L.point(bounds.max.x, bounds.max.y + 2 * this.options.marginY));
					}
					var offsetX = L.point(2 * this.options.marginX, 0);
					topLeft = (bounds ? bounds.getBottomLeft() : topRight).subtract(offsetX);
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					bounds = annotation.getBounds();
					bounds = L.bounds(bounds.getBottomLeft().add(offsetX), bounds.getTopRight().add(offsetX));
					bounds.extend(L.point(bounds.max.x, bounds.max.y + 3 * this.options.marginY));
				} else {
					topLeft = bounds ? bounds.getBottomLeft() : topRight;
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					annotation.show();
					bounds = annotation.getBounds();
					bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));
				}
			} else {
				annotation.hide();
			}
		}
		if (bounds) {
			if (!this._scrollAnnotation) {
				this._scrollAnnotation = L.control.scroll.annotation();
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
		} else if (comment.action === 'Remove') {
			this.removeAnnotation(comment.id);
			this._topAnnotation[this.getSelectedPart()] = Math.min(this._topAnnotation[this.getSelectedPart()], this._annotations[this.getSelectedPartHash()].length - 1);
			this.updateDocBounds(0);
			this.layoutAnnotations();
		} else if (comment.action === 'Modify') {
			var modified = this.getAnnotation(comment.id);
			if (modified) {
				modified._data = comment;
				modified.update();
				this._selectedAnnotation = undefined;
				this.layoutAnnotations();
			}
		}
	},
	allocateExtraSize: function() {
		var annotations = [];
		if (this._annotations && this.getPartHashes() && this.getSelectedPart() !== undefined)
			annotations = this._annotations[this.getSelectedPartHash()];
		return (annotations !== undefined && annotations.length > 0) ? this.options.extraSize : null;
	}
});

L.annotationManagerImpress = function (map, options) {
	return new L.AnnotationManagerImpress(map, options);
};
