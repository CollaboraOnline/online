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
		this._map.on('AnnotationSave', this._onAnnotationSave, this);
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
			comment.dateTime = new Date(comment.dateTime.replace(/,.*/, 'Z')).toDateString();
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
		this._selected = {};
		this._map._docLayer._selections.clearLayers();
		this.update();
	},

	select: function (obj) {
		var annotation = obj instanceof L.Annotation ? obj : this.getItem(obj);
		if (!this._selected.annotation || this._selected.annotation._data.id !== annotation._data.id) {
			this._selected.annotation = annotation;
			this.update();
		}
	},

	update: function () {
		var topRight = this._map.project(this._map.options.maxBounds.getNorthEast());
		var point, bounds;
		this.layout();
		if (this._selected.annotation) {
			point = this._map._docLayer._twipsToPixels(this._selected.annotation._data.anchorPos.min);
			bounds = L.latLngBounds(this._map._docLayer._twipsToLatLng(this._selected.annotation._data.anchorPos.getBottomLeft()),
				this._map._docLayer._twipsToLatLng(this._selected.annotation._data.anchorPos.getTopRight()));
			this._map._docLayer._selections.clearLayers();
			this._map._docLayer._selections.addLayer(L.rectangle(bounds,{
				pointerEvents: 'none',
				fillColor: '#43ACE8',
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25
			}));
			this._selected.annotation.setLatLng(this._map.unproject(L.point(topRight.x, point.y)));
		}
	},

	layout: function () {
		var topRight = this._map.project(this._map.options.maxBounds.getNorthEast()).add(L.point(this.options.marginX, this.options.marginY));
		var annotation, bounds, layoutBounds, foundBounds,point, latlng;
		var layouts = [];

		if (this._selected.annotation) {
			point = L.point(topRight.x, this._map._docLayer._twipsToPixels(this._selected.annotation._data.anchorPos.min).y);
			this._selected.annotation.setLatLng(this._map.unproject(point));
			bounds = this._selected.annotation.getBounds();
			bounds.extend(bounds.min.subtract([0, this.options.marginY]));
			bounds.extend(bounds.getBottomLeft().add([0, this.options.marginY]));
			this._selected.bounds = bounds;
		}

		for (var iterator in this._items) {
			annotation = this._items[iterator];
			if (annotation === this._selected.annotation) {
				continue;
			}
			point = L.point(topRight.x, this._map._docLayer._twipsToPixels(annotation._data.anchorPos.min).y);
			latlng = this._map.unproject(point);
			annotation.setLatLng(latlng);
			bounds = annotation.getBounds();
			foundBounds = null;
			for (var itBounds in layouts) {
				layoutBounds = layouts[itBounds];
				if (layoutBounds.intersects(bounds)) {
					if (foundBounds) {
						foundBounds = layoutBounds.max.y > foundBounds.max.y ? layoutBounds : foundBounds;
					} else {
						foundBounds = layoutBounds;
					}
				}
			}

			if (foundBounds) {
				if (foundBounds.contains(bounds.getTopRight())) {
					point = foundBounds.getBottomLeft().add([0, bounds.getSize().y + this.options.marginY]);
					latlng = this._map.layerPointToLatLng(foundBounds.getBottomLeft());
				} else {
					point = foundBounds.min.subtract([0, bounds.getSize().y + this.options.marginY]);
					latlng = this._map.layerPointToLatLng(point);
				}
				foundBounds.extend(point);
			} else {
				foundBounds = L.bounds(bounds.min, bounds.max);
				foundBounds.extend(L.point(bounds.min.x, bounds.min.y - this.options.marginY));
				foundBounds.extend(L.point(bounds.min.x, bounds.max.y + this.options.marginY));
				layouts.push(foundBounds);
			}

			if (this._selected.annotation && this._selected.bounds && this._selected.bounds.intersects(foundBounds)) {
				foundBounds.extend(this._selected.bounds.min);
				latlng = this._map.layerPointToLatLng(this._selected.bounds.getBottomLeft());
				foundBounds.extend(this._selected.bounds.getBottomLeft().add([0, bounds.getSize().y + this.options.marginY]));
				this._selected.bounds = null;
			}

			annotation.setLatLng(latlng);
			annotation.show();
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

	acceptChange: function(id) {
		var command = {
			AcceptTrackedChange: {
				type: 'unsigned short',
				value: id.substring('change-'.length)
			}
		};
		this._map.sendUnoCommand('.uno:AcceptTrackedChange', command);
		this.unselect();
		this._map.focus();
	},

	rejectChange: function(id) {
		var command = {
			RejectTrackedChange: {
				type: 'unsigned short',
				value: id.substring('change-'.length)
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
				obj.redline.trackchange = true;
				obj.redline.text = obj.redline.comment;
				this.add(obj.redline);
				this._map.focus();
			} else {
				obj.comment.anchorPos = L.LOUtil.stringToBounds(obj.comment.anchorPos);
				obj.comment.dateTime = new Date(obj.comment.dateTime.replace(/,.*/, 'Z')).toDateString();
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
					obj.redline.anchorPos = L.LOUtil.stringToBounds(obj.redline.anchorPos);
					obj.redline.text = obj.redline.comment;
					obj.redline.id = id;
					obj.redline.trackchange = true;
					modifiedObj = obj.redline;
				} else {
					obj.comment.anchorPos = L.LOUtil.stringToBounds(obj.comment.anchorPos);
					obj.comment.dateTime = new Date(obj.comment.dateTime.replace(/,.*/, 'Z')).toDateString();
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
