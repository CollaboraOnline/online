/*
 *  L.AnnotationManager
 */

L.AnnotationManager = L.Class.extend({
	options: {
		marginX: 50,
		marginY: 10,
		offset: 5,
		extraSize: L.point(250, 0)
	},

	initialize: function (map, options) {
		this._map = map;
		this._items = [];
		this._selected = null;
		this._animation = new L.PosAnimation();
		L.setOptions(this, options);
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
		comment.trackchange = false;
		rectangles = L.PolyUtil.rectanglesToPolygons(L.LOUtil.stringToRectangles(comment.textRange || comment.anchorPos), this._map._docLayer);
		comment.anchorPos = L.LOUtil.stringToBounds(comment.anchorPos);
		comment.anchorPix = this._map._docLayer._twipsToPixels(comment.anchorPos.min);
		viewId = this._map.getViewId(comment.author);
		color = viewId >= 0 ? L.LOUtil.rgbToHex(this._map.getViewColor(viewId)) : '#43ACE8';
		if (rectangles.length > 0) {
			comment.textSelected = L.polygon(rectangles, {
				interactive: true,
				fillColor: color,
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25
			});
			comment.textSelected.on('click', function() {
				this.selectById(comment.id);
			}, this);
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
				interactive: true,
				fillOpacity: 0,
				opacity: 0
			});
			redline.textSelected.on('click', function() {
				this.selectById(redline.id);
			}, this);
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
		if (this._items.length > 0) {
			this._map._docLayer._updateMaxBounds(true);
			this.layout();
		}
	},

	fillChanges: function(redlines) {
		var changecomment;
		this.clearChanges();
		for (var idx in redlines) {
			changecomment = redlines[idx];
			this.adjustRedLine(changecomment);
			this._items.push(L.annotation(this._map.options.maxBounds.getSouthEast(), changecomment).addTo(this._map));
		}
		if (this._items.length > 0) {
			this._map._docLayer._updateMaxBounds(true);
			this.layout();
		}
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

	// Returns the root comment id of given id
	getRootIndexOf: function(id) {
		var index = this.getIndexOf(id);
		for (var idx = index - 1;
			     idx >=0 && this._items[idx]._data.id === this._items[idx + 1]._data.parent;
			     idx--)
		{
			index = idx;
		}

		return index;
	},

	// Returns the last comment id of comment thread containing the given id
	getLastChildIndexOf: function(id) {
		var index = this.getIndexOf(id);
		for (var idx = index + 1;
		     idx < this._items.length && this._items[idx]._data.parent === this._items[idx - 1]._data.id;
		     idx++)
		{
			index = idx;
		}

		return index;
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
		if (this._selected) {
			this._selected = null;
			this.update();
		}
	},

	select: function (annotation) {
		if (annotation) {
			// Select the root comment
			var idx = this.getRootIndexOf(annotation._data.id);
			this._selected = this._items[idx];
			this.update();
		}
	},

	selectById: function(commentId) {
		var idx = this.getRootIndexOf(commentId);
		this._selected = this._items[idx];
		this.update();
	},

	update: function () {
		if (this._selected) {
			var point;
			var scale = this._map.getZoomScale(this._map.getZoom(), 10);
			var docRight = this._map.project(this._map.options.maxBounds.getNorthEast()).subtract(this.options.extraSize.multiplyBy(scale));
			point = this._map._docLayer._twipsToPixels(this._selected._data.anchorPos.min);
			this._arrow.setLatLngs([this._map.unproject(point), map.unproject(L.point(docRight.x, point.y))]);
			this._map.addLayer(this._arrow);
		} else {
			this._map.removeLayer(this._arrow);
		}
		this.layout();
	},

	updateDocBounds: function (count, extraSize) {
		if (this._items.length === count) {
			this._map._docLayer._updateMaxBounds(true, extraSize);
		}
	},

	layoutUp: function (commentThread, latLng, layoutBounds) {
		if (commentThread.length <= 0)
			return;

		commentThread[0].setLatLng(latLng);
		var bounds = commentThread[0].getBounds();
		var idx = 1;
		while (idx < commentThread.length) {
			bounds.extend(bounds.max.add([0, commentThread[idx].getBounds().getSize().y]));
			idx++;
		}

		var pt;
		if (layoutBounds.intersects(bounds)) {
			layoutBounds.extend(layoutBounds.min.subtract([0, bounds.getSize().y]));
			pt = layoutBounds.min;
		} else {
			pt = bounds.min;
			layoutBounds.extend(bounds.min);
		}
		layoutBounds.extend(layoutBounds.min.subtract([0, this.options.marginY]));

		idx = 0;
		for (idx = 0; idx < commentThread.length; ++idx) {
			latLng = this._map.layerPointToLatLng(pt);
			commentThread[idx].setLatLng(latLng);
			commentThread[idx].show();

			var commentBounds = commentThread[idx].getBounds();
			pt = pt.add([0, commentBounds.getSize().y]);
		}
	},

	layoutDown: function (commentThread, latLng, layoutBounds) {
		if (commentThread.length <= 0)
			return;

		commentThread[0].setLatLng(latLng);
		var bounds = commentThread[0].getBounds();
		var idx = 1;
		while (idx < commentThread.length) {
			bounds.extend(bounds.max.add([0, commentThread[idx].getBounds().getSize().y]));
			idx++;
		}

		var pt;
		if (layoutBounds.intersects(bounds)) {
			pt = layoutBounds.getBottomLeft();
			layoutBounds.extend(layoutBounds.max.add([0, bounds.getSize().y]));
		} else {
			pt = bounds.min;
			layoutBounds.extend(bounds.max);
		}
		layoutBounds.extend(layoutBounds.max.add([0, this.options.marginY]));

		idx = 0;
		for (idx = 0; idx < commentThread.length; ++idx) {
			latLng = this._map.layerPointToLatLng(pt);
			commentThread[idx].setLatLng(latLng);
			commentThread[idx].show();

			var commentBounds = commentThread[idx].getBounds();
			pt = pt.add([0, commentBounds.getSize().y]);
		}
	},

	layout: function (zoom) {
		var scale = this._map.getZoomScale(this._map.getZoom(), 10);
		var docRight = this._map.project(this._map.options.maxBounds.getNorthEast()).subtract(this.options.extraSize.multiplyBy(scale));
		var topRight = docRight.add(L.point(this.options.marginX, this.options.marginY));
		var latlng, layoutBounds, point, idx;
		if (this._selected) {
			var selectIndexFirst = this.getRootIndexOf(this._selected._data.id);
			var selectIndexLast = this.getLastChildIndexOf(this._selected._data.id);
			if (zoom) {
				this._items[selectIndexFirst]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[selectIndexFirst]._data.anchorPos.min);
			}
			latlng = this._map.unproject(L.point(docRight.x, this._items[selectIndexFirst]._data.anchorPix.y));
			(new L.PosAnimation()).run(this._items[selectIndexFirst]._container, this._map.latLngToLayerPoint(latlng));
			this._items[selectIndexFirst].setLatLng(latlng);
			layoutBounds = this._items[selectIndexFirst].getBounds();

			// Adjust child comments too, if any
			for (idx = selectIndexFirst + 1; idx <= selectIndexLast; idx++) {
				if (zoom) {
					this._items[idx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[idx]._data.anchorPos.min);
				}

				latlng = this._map.layerPointToLatLng(layoutBounds.getBottomLeft());
				(new L.PosAnimation()).run(this._items[idx]._container, layoutBounds.getBottomLeft());
				this._items[idx].setLatLng(latlng);

				var commentBounds = this._items[idx].getBounds();
				layoutBounds.extend(layoutBounds.max.add([0, commentBounds.getSize().y]));
			}

			layoutBounds.min = layoutBounds.min.add([this.options.marginX, 0]);
			layoutBounds.max = layoutBounds.max.add([this.options.marginX, 0]);
			layoutBounds.extend(layoutBounds.min.subtract([0, this.options.marginY]));
			layoutBounds.extend(layoutBounds.max.add([0, this.options.marginY]));
			for (idx = selectIndexFirst - 1; idx >= 0;) {
				var commentThread = [];
				var tmpIdx = idx;
				do {
					if (zoom) {
						this._items[idx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[idx]._data.anchorPos.min);
					}
					commentThread.push(this._items[tmpIdx]);
					tmpIdx = tmpIdx - 1;
				} while (tmpIdx >= 0 && this._items[tmpIdx]._data.id === this._items[tmpIdx + 1]._data.parent);

				commentThread.reverse();
				// All will have some anchor position
				this.layoutUp(commentThread, this._map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
				idx = idx - commentThread.length;
			}
			for (idx = selectIndexLast + 1; idx < this._items.length;) {
				commentThread = [];
				tmpIdx = idx;
				do {
					if (zoom) {
						this._items[idx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[idx]._data.anchorPos.min);
					}
					commentThread.push(this._items[tmpIdx]);
					tmpIdx = tmpIdx + 1;
				} while (tmpIdx < this._items.length && this._items[tmpIdx]._data.parent === this._items[tmpIdx - 1]._data.id);

				// All will have some anchor position
				this.layoutDown(commentThread, this._map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
				idx = idx + commentThread.length;
			}
			if (!this._selected.isEdit()) {
				this._selected.show();
			}
		} else {
			point = this._map.latLngToLayerPoint(this._map.unproject(topRight));
			layoutBounds = L.bounds(point, point);
			for (idx = 0; idx < this._items.length;) {
				commentThread = [];
				tmpIdx = idx;
				do {
					if (zoom) {
						this._items[tmpIdx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[tmpIdx]._data.anchorPos.min);
					}
					commentThread.push(this._items[tmpIdx]);
					tmpIdx = tmpIdx + 1;
				} while (tmpIdx < this._items.length && this._items[tmpIdx]._data.parent === this._items[tmpIdx - 1]._data.id);

				this.layoutDown(commentThread, this._map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
				idx = idx + commentThread.length;
			}
		}
	},

	add: function (comment) {
		var annotation = L.annotation(this._map.options.maxBounds.getSouthEast(), comment,
			comment.id === 'new' ? {noMenu: true} : {}).addTo(this._map);
		if (comment.parent && comment.parent > '0') {
			var parentIdx = this.getIndexOf(comment.parent);
			this._items.splice(parentIdx + 1, 0, annotation);
		} else {
			this._items.push(annotation);
		}
		this._items.sort(function(a, b) {
			return Math.abs(a._data.anchorPos.min.y) - Math.abs(b._data.anchorPos.min.y) ||
				Math.abs(a._data.anchorPos.min.x) - Math.abs(b._data.anchorPos.min.x);
		});
		return annotation;
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

	// Adjust parent-child relationship, if required, after `comment` is added
	adjustParentAdd: function(comment) {
		if (comment.parent && comment.parent > '0') {
			var parentIdx = this.getIndexOf(comment.parent);
			if (this._items[parentIdx + 1] && this._items[parentIdx + 1]._data.parent === this._items[parentIdx]._data.id) {
				this._items[parentIdx + 1]._data.parent = comment.id;
			}
		}
	},

	// Adjust parent-child relationship, if required, after `comment` is removed
	adjustParentRemove: function(comment) {
		var newId = '0';
		var parentIdx = this.getIndexOf(comment._data.parent);
		if (parentIdx >= 0) {
			newId = this._items[parentIdx]._data.id;
		}
		var currentIdx = this.getIndexOf(comment._data.id);
		if (this._items[currentIdx + 1] && this._items[currentIdx].parentOf(this._items[currentIdx + 1])) {
			this._items[currentIdx + 1]._data.parent = newId;
		}
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
				this.adjustParentAdd(obj.comment);
				this.add(obj.comment);
			}
			if (this._selected && !this._selected.isEdit()) {
				this._map.focus();
			}
			this.updateDocBounds(1);
			this.layout();
		} else if (action === 'Remove') {
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var removed = this.getItem(id);
			if (removed) {
				this.adjustParentRemove(removed);
				this._map.removeLayer(this.removeItem(id));
				this.updateDocBounds(0);
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
			this._map.removeLayer(this.removeItem(e.annotation._data.id));
			this.updateDocBounds(0);
		}
		if (this._selected === e.annotation) {
			this.unselect();
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
			this._map.removeLayer(this.removeItem(e.annotation._data.id));
		} else if (e.annotation._data.trackchange) {
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


L.annotationManager = function (map, options) {
	return new L.AnnotationManager(map, options);
};
