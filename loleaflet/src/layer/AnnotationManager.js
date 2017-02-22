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
		this._selected = {};
		this._arrow = L.polyline([], {color: 'darkblue', weight: 1});
		this._map.on('AnnotationCancel', this._onAnnotationCancel, this);
		this._map.on('AnnotationClick', this._onAnnotationClick, this);
		this._map.on('AnnotationSave', this._onAnnotationSave, this);
		var that = this;
		$.contextMenu({
			selector: '.loleaflet-annotation-content',
			className: 'loleaflet-font',
			items: {
				modify: {
					name: _('Modify'),
					callback: function (key, options) {
						that._onAnnotationModify.call(that, options.$trigger.get(0).annotation);
					}
				},
				remove: {
					name: _('Remove'),
					callback: function (key, options) {
						that._onAnnotationRemove.call(that, options.$trigger.get(0).annotation._data.id);
					}
				}
			}
		});
	},

	clear: function () {
		for (var key in this._items) {
			this._map.removeLayer(this._items[key]);
		}
		this._map.removeLayer(this._arrow);
		this._items = [];
		this._selected = {};
	},

	fill: function (comments) {
		var comment;
		this.clear();
		for (var index in comments) {
			comment = comments[index];
			comment.anchorPos = L.LOUtil.stringToPoint(comment.anchorPos);
			this._items.push(L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map));
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
		this._map.removeLayer(this._arrow);
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
		var point0, point1, point2, point3;
		this.layout();
		if (this._selected.annotation) {
			point0 = this._map._docLayer._twipsToPixels(this._selected.annotation._data.anchorPos);
			point1 = L.point(point0.x, point0.y - this.options.offset);
			point2 = L.point(topRight.x, point1.y);
			point3 = L.point(topRight.x, point2.y + this.options.offset);
			this._arrow.setLatLngs([this._map.unproject(point0), this._map.unproject(point1), this._map.unproject(point2), this._map.unproject(point3)]);
			this._map.addLayer(this._arrow);
			this._selected.annotation.setLatLng(this._map.unproject(point3));
		}
	},

	layout: function () {
		var topRight = this._map.project(this._map.options.maxBounds.getNorthEast()).add(L.point(this.options.marginX, this.options.marginY));
		var annotation, bounds, layoutBounds, foundBounds,point, latlng;
		var layouts = [];

		if (this._selected.annotation) {
			point = L.point(topRight.x, this._map._docLayer._twipsToPixels(this._selected.annotation._data.anchorPos).y);
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
			point = L.point(topRight.x, this._map._docLayer._twipsToPixels(annotation._data.anchorPos).y);
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
		var annotation = L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map).edit();
		this._items.push(annotation);
		this._items.sort(function(a, b) {
			return Math.abs(a._data.anchorPos.y) - Math.abs(b._data.anchorPos.y) ||
			       Math.abs(a._data.anchorPos.x) - Math.abs(b._data.anchorPos.x);
		});
		this.select(annotation);
		annotation.focus();
	},

	remove: function (id) {
		this._map.removeLayer(this.removeItem(id));
		this.unselect();
	},

	onACKComment: function (textMsg) {
		var obj = JSON.parse(textMsg.substring('comment:'.length + 1));

		if (obj.comment.action === 'Add') {
			obj.comment.anchorPos = L.LOUtil.stringToPoint(obj.comment.anchorPos);
			var added = this.getItem('new');
			if (added) {
				delete obj.comment.action;
				added._data = obj.comment;
				this._items.sort(function(a, b) {
					return Math.abs(a._data.anchorPos.y) - Math.abs(b._data.anchorPos.y) ||
					       Math.abs(a._data.anchorPos.x) - Math.abs(b._data.anchorPos.x);
				});
				added._updateContent();
				this.layout();
			}
			else { // annotation is added by some other view
				this._map.insertComment(obj.comment);
				this.unselect();
				this._map.focus();
			}

		} else if (obj.comment.action === 'Remove') {
			if (this.getItem(obj.comment.id)) {
				this.remove(obj.comment.id);
			}
		} else if (obj.comment.action === 'Modify') {
			obj.comment.anchorPos = L.LOUtil.stringToPoint(obj.comment.anchorPos);
			var modified = this.getItem(obj.comment.id);
			if (modified) {
				modified._data = obj.comment;
				modified._updateContent();
				this.update();
			}
		}
	},

	_onAnnotationCancel: function (e) {
		if (e.annotation._data.id === 'new') {
			this.remove(e.annotation._data.id);
		}
		this._map.focus();
	},

	_onAnnotationClick: function (e) {
		this.select(e.annotation);
	},

	_onAnnotationModify: function (annotation) {
		annotation.edit();
		this.select(annotation);
		annotation.focus();
	},

	_onAnnotationRemove: function (id) {
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		this._map.sendUnoCommand('.uno:DeleteComment', comment);
		this.remove(id);
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
	insertComment: function(comment) {
		comment = !!comment ? comment : {};
		this._docLayer._annotations.add({
			text: comment.text ? comment.text : '',
			textrange: comment.textrange ? comment.textrange : '',
			author: comment.author ? comment.author : this.getViewName(this._docLayer._viewId),
			dateTime: comment.dateTime ? comment.dateTime : new Date().toDateString(),
			id: comment.id ? comment.id : 'new', // 'new' only when added by us
			anchorPos: comment.anchorPos ? comment.anchorPos : this._docLayer._latLngToTwips(this._docLayer._visibleCursor.getNorthWest())
		});
	}
});


L.annotationManager = function (map) {
	return new L.AnnotationManager(map);
};
