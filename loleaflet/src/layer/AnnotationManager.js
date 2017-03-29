/*
 *  L.AnnotationManager
 */

L.AnnotationManager = L.Class.extend({
	options: {
		marginX: 50,
		marginY: 10
	},

	initialize: function (map) {
		this._map = map;
		this._items = [];
		this._selected = {};
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
		this._selected = {};
	},

	// Remove only change tracking comments from the document
	clearChanges: function() {
		for (var key in this._items) {
			if (this._items[key].trackchange) {
				this._map.removeLayer(this._items[key]);
			}
		}
	},

	// Fill normal comments in the documents
	fill: function (comments) {
		var comment;
		this.clear();
		for (var index in comments) {
			comment = comments[index];
			comment.anchorPos = L.LOUtil.stringToBounds(comment.anchorPos);
			comment.anchorPix = this._map._docLayer._twipsToPixels(comment.anchorPos.min);
			comment.trackchange = false;
			this._items.push(L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map));
		}
		this.layout();
	},

	fillChanges: function(redlines) {
		var changecomment;
		this.clearChanges();
		for (var idx in redlines) {
			changecomment = redlines[idx];
			changecomment.id = 'change-' + changecomment.index;
			changecomment.anchorPos = L.LOUtil.stringToBounds(changecomment.textRange);
			changecomment.anchorPix = this._map._docLayer._twipsToPixels(changecomment.anchorPos.min);
			changecomment.trackchange = true;
			changecomment.text = changecomment.comment;
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
		this._selected = -1;
		this._map._docLayer._selections.clearLayers();
		this.update();
	},

	select: function (annotation) {
		if (annotation) {
			this._selected = this.getIndexOf(annotation._data.id);
			this.update();
		}
	},

	update: function () {
		this.layout();
		this._map._docLayer._selections.clearLayers();
		if (this._selected >= 0) {
			var rectangles = L.PolyUtil.rectanglesToPolygons(L.LOUtil.stringToRectangles(this._items[this._selected]._data.textRange), this._map._docLayer);
			if (rectangles.length > 0) {
				this._map._docLayer._selections.addLayer(L.polygon(rectangles, {
					pointerEvents: 'none',
					fillColor: '#43ACE8',
					fillOpacity: 0.25,
					weight: 2,
					opacity: 0.25
				}));
			}
		}
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

	layout: function () {
		var docRight = this._map.project(this._map.options.maxBounds.getNorthEast());
		var topRight = docRight.add(L.point(this.options.marginX, this.options.marginY));
		var annotation, selected, layoutBounds, point, index;
		if (this._selected >= 0) {
			selected = this._items[this._selected];
			selected.setLatLng(this._map.unproject(L.point(topRight.x, selected._data.anchorPix.y)));
			layoutBounds = selected.getBounds();
			layoutBounds.extend(layoutBounds.min.subtract([0, this.options.marginY]));
			layoutBounds.extend(layoutBounds.max.add([0, this.options.marginY]));
			for (index = this._selected - 1; index >= 0; index--) {
				annotation = this._items[index];
				this.layoutUp(annotation, this._map.unproject(L.point(topRight.x, annotation._data.anchorPix.y)), layoutBounds);
			}
			for (index = this._selected + 1; index < this._items.length; index++) {
				annotation = this._items[index];
				this.layoutDown(annotation, this._map.unproject(L.point(topRight.x, annotation._data.anchorPix.y)), layoutBounds);
			}
			if (selected._data.trackchange) {
				selected.setLatLng(this._map.unproject(L.point(docRight.x, selected._data.anchorPix.y)));
			} else {
				selected.setLatLng(this._map.unproject(selected._data.anchorPix));
			}
			selected.show();
		} else {
			point = this._map.latLngToLayerPoint(this._map.unproject(topRight));
			layoutBounds = L.bounds(point, point);
			for (index in this._items) {
				annotation = this._items[index];
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
		this.select(annotation);
		annotation.edit();
		annotation.focus();
	},

	reply: function (annotation) {
		this.select(annotation);
		annotation.reply();
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
		var changetrack = obj.redline ? true : false;
		var action = changetrack ? obj.redline.action : obj.comment.action;
		if (action === 'Add') {
			if (changetrack) {
				// transform change tracking index into an id
				obj.redline.id = 'change-' + obj.redline.index;
				obj.redline.anchorPos = L.LOUtil.stringToBounds(obj.redline.textRange);
				obj.redline.anchorPix = this._map._docLayer._twipsToPixels(obj.redline.anchorPos.min);
				obj.redline.trackchange = true;
				obj.redline.text = obj.redline.comment;
				this.add(obj.redline);
				this._map.focus();
			} else {
				obj.comment.anchorPos = L.LOUtil.stringToBounds(obj.comment.anchorPos);
				obj.comment.anchorPix = this._map._docLayer._twipsToPixels(obj.comment.anchorPos.min);
				this.add(obj.comment);
				this._map.focus();
			}
			this.layout();
		} else if (action === 'Remove') {
			var id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			if (this.getItem(id)) {
				this._map.removeLayer(this.removeItem(id));
				this.unselect();
			}
		} else if (action === 'Modify') {
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var modified = this.getItem(id);
			if (modified) {
				var modifiedObj;
				if (changetrack) {
					obj.redline.anchorPos = L.LOUtil.stringToBounds(obj.redline.textRange);
					obj.redline.anchorPix = this._map._docLayer._twipsToPixels(obj.redline.anchorPos.min);
					obj.redline.text = obj.redline.comment;
					obj.redline.id = id;
					obj.redline.trackchange = true;
					modifiedObj = obj.redline;
				} else {
					obj.comment.anchorPos = L.LOUtil.stringToBounds(obj.comment.anchorPos);
					obj.comment.anchorPix = this._map._docLayer._twipsToPixels(obj.comment.anchorPos.min);
					modifiedObj = obj.comment;
				}
				modified._data = modifiedObj;
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
