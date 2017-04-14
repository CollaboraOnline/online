/*
 *  L.AnnotationManager
 */

L.AnnotationManager = L.Class.extend({
	options: {
		marginX: 50,
		marginY: 10,
		offset: 5
	},

	initialize: function (map) {
		this._map = map;
		this._items = [];
		this._selected = null;
		this._animation = new L.PosAnimation();
		this._arrow = L.polyline([], {color: 'darkblue', weight: 1});
		this._map.on('zoomend', this._onAnnotationZoom, this);
		this._map.on('AnnotationCancel', this._onAnnotationCancel, this);
		this._map.on('AnnotationClick', this._onAnnotationClick, this);
		this._map.on('AnnotationReply', this._onAnnotationReply, this);
		this._map.on('AnnotationSave', this._onAnnotationSave, this);
		this._map.on('RedlineAccept', this._onRedlineAccept, this);
		this._map.on('RedlineReject', this._onRedlineReject, this);
	},

	// Remove only text comments from the document (excluding change tracking comments)
	clear: function () {
		for (var key in this._items) {
			if (!this._items[key].trackchange) {
				this._map.removeLayer(this._items[key]);
			}
		}
		this._items = [];
		this._selected = null;
		this._map.removeLayer(this._arrow);
	},

	// Remove only change tracking comments from the document
	clearChanges: function() {
		for (var key in this._items) {
			if (this._items[key].trackchange) {
				this._map.removeLayer(this._items[key]);
			}
		}
	},

	adjustComment: function(comment) {
		var rectangles, color, viewId;
		comment.anchorPos = L.LOUtil.stringToBounds(comment.anchorPos);
		comment.anchorPix = this._map._docLayer._twipsToPixels(comment.anchorPos.min);
		comment.trackchange = false;
		rectangles = L.PolyUtil.rectanglesToPolygons(L.LOUtil.stringToRectangles(comment.textRange), this._map._docLayer);
		viewId = this._map.getViewId(comment.author);
		color = viewId >= 0 ? L.LOUtil.rgbToHex(this._map.getViewColor(viewId)) : '#43ACE8';
		if (rectangles.length > 0) {
			comment.textSelected = L.polygon(rectangles, {
				pointerEvents: 'none',
				fillColor: color,
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25
			});
		}
	},

	adjustRedLine: function(redline) {
		var rectangles, color, viewId;
		// transform change tracking index into an id
		redline.id = 'change-' + redline.index;
		redline.anchorPos = L.LOUtil.stringToBounds(redline.textRange);
		redline.anchorPix = this._map._docLayer._twipsToPixels(redline.anchorPos.min);
		redline.trackchange = true;
		redline.text = redline.comment;
		rectangles = L.PolyUtil.rectanglesToPolygons(L.LOUtil.stringToRectangles(redline.textRange), this._map._docLayer);
		viewId = this._map.getViewId(redline.author);
		color = viewId >= 0 ? L.LOUtil.rgbToHex(this._map.getViewColor(viewId)) : '#43ACE8';
		if (rectangles.length > 0) {
			redline.textSelected = L.polygon(rectangles, {
				pointerEvents: 'none',
				fillColor: color,
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25
			});
		}
	},

	// Fill normal comments in the documents
	fill: function (comments) {
		var comment;
		this.clear();
		for (var index in comments) {
			comment = comments[index];
			this.adjustComment(comment);
			this._items.push(L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map));
		}
		this.layout();
	},

	fillChanges: function(redlines) {
		var changecomment;
		this.clearChanges();
		for (var idx in redlines) {
			changecomment = redlines[idx];
			this.adjustRedLine(changecomment);
			this._items.push(L.annotation(this._map.options.maxBounds.getSouthEast(), changecomment).addTo(this._map));
		}
		this.layout();
	},

	getItem: function (id) {
		for (var iterator in this._items) {
			if (this._items[iterator]._data.id === id) {
				return this._items[iterator];
			}
		}
		return null;
	},

	getIndexOf: function (id) {
		for (var index = 0; index < this._items.length; index++) {
			if (this._items[index]._data.id === id) {
				return index;
			}
		}
		return -1;
	},

	removeItem: function (id) {
		var annotation;
		for (var iterator in this._items) {
			annotation = this._items[iterator];
			if (annotation._data.id === id) {
				this._items.splice(iterator, 1);
				return annotation;
			}
		}
	},

	unselect: function () {
		this._selected = null;
		this.update();
	},

	select: function (annotation) {
		if (annotation) {
			this._selected = annotation;
			this.update();
		}
	},

	update: function () {
		if (this._selected) {
			var point0, point1, point2;
			var topRight = this._map.project(this._map.options.maxBounds.getNorthEast());
			point0 = this._map._docLayer._twipsToPixels(this._selected._data.anchorPos.max);
			point1 = L.point(point0.x, point0.y + this.options.offset);
			point2 = L.point(topRight.x, point1.y);
			this._arrow.setLatLngs([this._map.unproject(point0), this._map.unproject(point1), this._map.unproject(point2)]);
			this._map.addLayer(this._arrow);
		} else {
			this._map.removeLayer(this._arrow);
		}
		this.layout();
	},

	layoutUp: function (annotation, latLng, layoutBounds) {
		annotation.setLatLng(latLng);
		var bounds = annotation.getBounds();
		if (layoutBounds.intersects(bounds)) {
			layoutBounds.extend(layoutBounds.min.subtract([0, bounds.getSize().y]));
			latLng = this._map.layerPointToLatLng(layoutBounds.min);
		} else {
			latLng = this._map.layerPointToLatLng(bounds.min);
			layoutBounds.extend(bounds.min);
		}
		layoutBounds.extend(layoutBounds.min.subtract([0, this.options.marginY]));
		annotation.setLatLng(latLng);
		annotation.show();
	},

	layoutDown: function (annotation, latLng, layoutBounds) {
		annotation.setLatLng(latLng);
		var bounds = annotation.getBounds();
		if (layoutBounds.intersects(bounds)) {
			latLng = this._map.layerPointToLatLng(layoutBounds.getBottomLeft());
			layoutBounds.extend(layoutBounds.max.add([0, bounds.getSize().y]));
		} else {
			latLng = this._map.layerPointToLatLng(bounds.min);
			layoutBounds.extend(bounds.max);
		}
		layoutBounds.extend(layoutBounds.max.add([0, this.options.marginY]));
		annotation.setLatLng(latLng);
		annotation.show();
	},

	layout: function (zoom) {
		var docRight = this._map.project(this._map.options.maxBounds.getNorthEast());
		var topRight = docRight.add(L.point(this.options.marginX, this.options.marginY));
		var latlng, annotation, selectIndex, layoutBounds, point, index;
		if (this._selected) {
			selectIndex = this.getIndexOf(this._selected._data.id);
			if (zoom) {
				this._selected._data.anchorPix = this._map._docLayer._twipsToPixels(this._selected._data.anchorPos.min);
			}
			latlng = this._map.unproject(L.point(docRight.x, this._selected._data.anchorPix.y));
			this._animation.run(this._selected._container, this._map.latLngToLayerPoint(latlng));
			this._selected.setLatLng(latlng);
			layoutBounds = this._selected.getBounds();
			layoutBounds.min = layoutBounds.min.add([this.options.marginX, 0]);
			layoutBounds.max = layoutBounds.max.add([this.options.marginX, 0]);
			layoutBounds.extend(layoutBounds.min.subtract([0, this.options.marginY]));
			layoutBounds.extend(layoutBounds.max.add([0, this.options.marginY]));
			for (index = selectIndex - 1; index >= 0; index--) {
				annotation = this._items[index];
				if (zoom) {
					annotation._data.anchorPix = this._map._docLayer._twipsToPixels(annotation._data.anchorPos.min);
				}
				this.layoutUp(annotation, this._map.unproject(L.point(topRight.x, annotation._data.anchorPix.y)), layoutBounds);
			}
			for (index = selectIndex + 1; index < this._items.length; index++) {
				annotation = this._items[index];
				if (zoom) {
					annotation._data.anchorPix = this._map._docLayer._twipsToPixels(annotation._data.anchorPos.min);
				}
				this.layoutDown(annotation, this._map.unproject(L.point(topRight.x, annotation._data.anchorPix.y)), layoutBounds);
			}
			if (!this._selected.isEdit()) {
				this._selected.show();
			}
		} else {
			point = this._map.latLngToLayerPoint(this._map.unproject(topRight));
			layoutBounds = L.bounds(point, point);
			for (index in this._items) {
				annotation = this._items[index];
				if (zoom) {
					annotation._data.anchorPix = this._map._docLayer._twipsToPixels(annotation._data.anchorPos.min);
				}
				this.layoutDown(annotation, this._map.unproject(L.point(topRight.x, annotation._data.anchorPix.y)), layoutBounds);
			}
		}
	},

	add: function (comment) {
		var annotation = L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map);
		this._items.push(annotation);
		this._items.sort(function(a, b) {
			return Math.abs(a._data.anchorPos.min.y) - Math.abs(b._data.anchorPos.min.y) ||
			       Math.abs(a._data.anchorPos.min.x) - Math.abs(b._data.anchorPos.min.x);
		});
	},

	edit: function (comment) {
		var annotation = L.annotation(this._map._docLayer._twipsToLatLng(comment.anchorPos.getTopRight()), comment).addTo(this._map);
		annotation.edit();
		annotation.focus();
	},

	modify: function (annotation) {
		annotation.edit();
		this.select(annotation);
		annotation.focus();
	},

	reply: function (annotation) {
		annotation.reply();
		this.select(annotation);
		annotation.focus();
	},

	remove: function (id) {
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		this._map.sendUnoCommand('.uno:DeleteComment', comment);
		this.unselect();
		this._map.focus();
	},

	_onRedlineAccept: function(e) {
		var command = {
			AcceptTrackedChange: {
				type: 'unsigned short',
				value: e.id.substring('change-'.length)
			}
		};
		this._map.sendUnoCommand('.uno:AcceptTrackedChange', command);
		this.unselect();
		this._map.focus();
	},

	_onRedlineReject: function(e) {
		var command = {
			RejectTrackedChange: {
				type: 'unsigned short',
				value: e.id.substring('change-'.length)
			}
		};
		this._map.sendUnoCommand('.uno:RejectTrackedChange', command);
		this.unselect();
		this._map.focus();
	},

	onACKComment: function (obj) {
		var id;
		var changetrack = obj.redline ? true : false;
		var action = changetrack ? obj.redline.action : obj.comment.action;
		if (action === 'Add') {
			if (changetrack) {
				this.adjustRedLine(obj.redline);
				this.add(obj.redline);
			} else {
				this.adjustComment(obj.comment);
				this.add(obj.comment);
			}
			if (this._selected && !this._selected.isEdit()) {
				this._map.focus();
			}
			this.layout();
		} else if (action === 'Remove') {
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var removed = this.getItem(id);
			if (removed) {
				this._map.removeLayer(this.removeItem(id));
				if (this._selected === removed) {
					this.unselect();
				} else {
					this.layout();
				}
			}
		} else if (action === 'Modify') {
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var modified = this.getItem(id);
			if (modified) {
				var modifiedObj;
				if (changetrack) {
					this.adjustRedLine(obj.redline);
					modifiedObj = obj.redline;
				} else {
					this.adjustComment(obj.comment);
					modifiedObj = obj.comment;
				}
				modified.setData(modifiedObj);
				modified.update();
				this.update();
			}
		}
	},

	_onAnnotationCancel: function (e) {
		if (e.annotation._data.id === 'new') {
			this._map.removeLayer(e.annotation);
		} else {
			this.layout();
		}
		this._map.focus();
	},

	_onAnnotationClick: function (e) {
		this.select(e.annotation);
	},

	_onAnnotationReply: function (e) {
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
		this._map.sendUnoCommand('.uno:ReplyComment', comment);
		this.unselect();
		this._map.focus();
	},

	_onAnnotationSave: function (e) {
		var comment;
		if (e.annotation._data.id === 'new') {
			comment = {
				Text: {
					type: 'string',
					value: e.annotation._data.text
				},
				Author: {
					type: 'string',
					value: e.annotation._data.author
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
			this._map.removeLayer(e.annotation);
		}
		else if (e.annotation._data.trackchange) {
			comment = {
				ChangeTrackingId: {
					type: 'long',
					value: e.annotation._data.index
				},
				Text: {
					type: 'string',
					value: e.annotation._data.text
				}
			};
			this._map.sendUnoCommand('.uno:CommentChangeTracking', comment);
		} else {
			comment = {
				Id: {
					type: 'string',
					value: e.annotation._data.id
				},
				Text: {
					type: 'string',
					value: e.annotation._data.text
				}
			};
			this._map.sendUnoCommand('.uno:EditAnnotation', comment);
		}
		this.unselect();
		this._map.focus();
	},

	_onAnnotationZoom: function (e) {
		this.layout(true);
	}
});


L.Map.include({
	insertComment: function() {
		this._docLayer.newAnnotation({
			text: '',
			textrange: '',
			author: this.getViewName(this._docLayer._viewId),
			dateTime: new Date().toDateString(),
			id: 'new' // 'new' only when added by us
		});
	}
});


L.annotationManager = function (map) {
	return new L.AnnotationManager(map);
};
