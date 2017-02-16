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
		this._items = {};
		this._anchors = [];
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
						that._onAnnotationModify.call(that, options.$trigger.attr('id'));
					}
				},
				remove: {
					name: _('Remove'),
					callback: function (key, options) {
						that._onAnnotationRemove.call(that, options.$trigger.attr('id'));
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
		this._items = {};
		this._anchors = [];
		this._selected = {};
	},

	fill: function (comments) {
		var comment;
		this.clear();
		for (var index in comments) {
			comment = comments[index];
			comment.anchorPos = L.LOUtil.stringToPoint(comment.anchorPos);
			this._items[comment.id] = L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map);
			this._anchors.push({anchor: comment.anchorPos, id: comment.id});
		}
		this._anchors.sort(function(a, b) {
			return Math.abs(a.anchor.y) - Math.abs(b.anchor.y);
		});
		this.layout();
	},

	unselect: function () {
		this._selected = {};
		this._map.removeLayer(this._arrow);
		this.layout();
	},

	select: function (id) {
		var topRight = this._map.project(this._map.options.maxBounds.getNorthEast());
		var annotation = this._items[id];
		var point0, point1, point2, point3;
		if (!this._selected.annotation || this._selected.annotation._data.id !== annotation._data.id) {
			this._selected.annotation = annotation;
			this.layout();
			point0 = this._map._docLayer._twipsToPixels(annotation._data.anchorPos);
			point1 = L.point(point0.x, point0.y - this.options.offset);
			point2 = L.point(topRight.x, point1.y);
			point3 = L.point(topRight.x, point2.y + this.options.offset);
			this._arrow.setLatLngs([this._map.unproject(point0), this._map.unproject(point1), this._map.unproject(point2), this._map.unproject(point3)]);
			this._map.addLayer(this._arrow);
			annotation.setLatLng(this._map.unproject(point3));
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

		for (var itAnchor in this._anchors) {
			annotation = this._items[this._anchors[itAnchor].id];
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
		this._items[comment.id] = L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map).edit();
		this._anchors.push({anchor: comment.anchorPos, id: comment.id});
		this._anchors.sort(function(a, b) {
			return Math.abs(a.anchor.y) - Math.abs(b.anchor.y);
		});
		this.select(comment.id);
		this._items[comment.id].focus();
	},

	remove: function (id) {
		this._removeAnchor(id);
		this.unselect();
		this._map.removeLayer(this._items[id]);
		delete this._items[id];
	},

	onACKComment: function (textMsg) {
		textMsg = textMsg.substring('comment:'.length + 1);
		var obj = JSON.parse(textMsg);

		if (obj.comment.action === 'Add') {
			if (this._items['new']) {
				delete obj.comment.action;
				obj.comment.anchorPos = L.LOUtil.stringToPoint(obj.comment.anchorPos);
				this._items[obj.comment.id] = this._items['new'];
				this._items[obj.comment.id]._data = obj.comment;
				this._items['new'] = null;
				this._removeAnchor('new');
				this._anchors.push({anchor: obj.comment.anchorPos, id: obj.comment.id});
				this._anchors.sort(function(a, b) {
					return Math.abs(a.anchor.y) - Math.abs(b.anchor.y);
				});
				this._items[obj.comment.id]._updateContent();
				this.layout();
			}

		} else if (obj.comment.action === 'Remove') {
			if (this._items[obj.comment.id]) {
				// something wrong here
			}
		} else if (obj.comment.action === 'Modify') {
			if (this._items[obj.comment.id] && this._items[obj.comment.id].text !== obj.comment.text) {
				// something wrong here
			}
		}
	},

	_onAnnotationCancel: function (e) {
		if (e.id === 'new') {
			this.remove(e.id);
		}
		this._map.focus();
	},

	_onAnnotationClick: function (e) {
		this.select(e.id);
	},

	_onAnnotationModify: function (id) {
		this._items[id].edit();
		this.select(id);
		this._items[id].focus();
	},

	_onAnnotationRemove: function (id) {
		var comment = {
			Id: {
				type: 'long',
				value: id
			}
		};
		this._map.sendUnoCommand('.uno:DeleteComment', comment);
		this.remove(id);
		this._map.focus();
	},

	_onAnnotationSave: function (e) {
		if (e.id === 'new') {
			var comment = {
				Text: {
					type: 'string',
					value: this._items[e.id]._data.text
				},
				Author: {
					type: 'string',
					value: this._items[e.id]._data.author
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
		} else {
			var comment = {
				Id: {
					type: 'long',
					value: e.id
				},
				Text: {
					type: 'string',
					value: this._items[e.id]._data.text
				}
			};
			this._map.sendUnoCommand('.uno:EditAnnotation', comment);
		}
		this.unselect();
		this._map.focus();
	},

	_removeAnchor: function (id) {
		for (var index in this._anchors) {
			if (this._anchors[index].id === id) {
				this._anchors.splice(index, 1);
				break;
			}
		}
	}
});


L.Map.include({
	insertComment: function() {
		this._docLayer._annotations.add({
			text: '',
			textrange: '',
			author: this.getViewName(this._docLayer._viewId),
			dateTime: new Date().toDateString(),
			id: 'new',
			anchorPos:  this._docLayer._latLngToTwips(this._docLayer._visibleCursor.getNorthWest())
		});
	}
});


L.annotationManager = function (map) {
	return new L.AnnotationManager(map);
};
