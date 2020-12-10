/* -*- js-indent-level: 8 -*- */
/*
 *  L.AnnotationManager
 */

/* global $ */

L.AnnotationManager = L.AnnotationManagerBase.extend({
	options: {
		marginX: 40,
		marginY: 10,
		offset: 5,
		extraSize: L.point(290, 0)
	},

	_initializeSpecific: function (options) {
		this._items = [];
		this._hiddenItems = 0;
		this._selected = null;
		this._lastSelected = null; // Used to detect if selection changed.
		L.setOptions(this, options);
		this._arrow = L.polyline([], {color: 'darkblue', weight: 1});
		this._map.on('zoomend', this._onAnnotationZoom, this);
		this._map.on('AnnotationCancel', this._onAnnotationCancel, this);
		this._map.on('AnnotationClick', this._onAnnotationClick, this);
		this._map.on('AnnotationReply', this._onAnnotationReply, this);
		this._map.on('AnnotationSave', this._onAnnotationSave, this);
		this._map.on('RedlineAccept', this._onRedlineAccept, this);
		this._map.on('RedlineReject', this._onRedlineReject, this);
		this._showResolved = false;
	},

	// Remove only text comments from the document (excluding change tracking comments)
	clear: function () {
		var it = 0;
		while (it < this._items.length) {
			if (!this._items[it].trackchange) {
				this._map.removeLayer(this._items[it]);
				this._items.splice(it, 1);
			} else {
				it++;
			}
		}
		this._selected = null;
		this._map.removeLayer(this._arrow);
	},

	// Remove only change tracking comments from the document
	clearChanges: function() {
		var it = 0;
		while (it < this._items.length) {
			if (this._items[it].trackchange) {
				this._map.removeLayer(this._items[it]);
				this._items.splice(it, 1);
			} else {
				it++;
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
				pointerEvents: 'all',
				interactive: false,
				fillColor: color,
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25
			});
			comment.textSelected.addEventParent(this._map);
			comment.textSelected.on('click', function() {
				this.selectById(comment.id);
			}, this);

			if (window.mode.isMobile()) {
				// This would be used to highlight comment when tapped on the comment in wizard
				comment.wizardHighlight = L.polygon(rectangles, {
					pointerEvents: 'all',
					interactive: false,
					color: '#777777',
					fillColor: '#777777',
					fillOpacity: 0.25,
					weight: 2,
					opacity: 0.25
				});
			}
		}
	},

	adjustRedLine: function(redline) {
		// All sane values ?
		if (!redline.textRange) {
			console.warn('Redline received has invalid textRange');
			return false;
		}

		// transform change tracking index into an id
		redline.id = 'change-' + redline.index;
		redline.anchorPos = L.LOUtil.stringToBounds(redline.textRange);
		redline.anchorPix = this._map._docLayer._twipsToPixels(redline.anchorPos.min);
		redline.trackchange = true;
		redline.text = redline.comment;
		var rectangles = L.PolyUtil.rectanglesToPolygons(L.LOUtil.stringToRectangles(redline.textRange), this._map._docLayer);
		if (rectangles.length > 0) {
			redline.textSelected = L.polygon(rectangles, {
				pointerEvents: 'all',
				interactive: false,
				fillOpacity: 0,
				opacity: 0
			});
			redline.textSelected.addEventParent(this._map);
			redline.textSelected.on('click', function() {
				this.selectById(redline.id);
			}, this);
		}

		return true;
	},

	// Fill normal comments in the documents
	fill: function (comments) {
		var comment;
		this.clear();
		// items contains redlines
		var ordered = !this._items.length;
		for (var index in comments) {
			comment = comments[index];
			this.adjustComment(comment);
			if (comment.author in this._map._viewInfoByUserName) {
				comment.avatar = this._map._viewInfoByUserName[comment.author].userextrainfo.avatar;
			}
			this._items.push(L.annotation(this._map.options.docBounds.getSouthEast(), comment).addTo(this._map));
			this.updateResolvedState(this._items[this._items.length - 1]);
			if (this._items[this._items.length - 1]._data.resolved === 'true') {
				this._hiddenItems++;
			}
		}
		if (this._items.length > 0) {
			if (!ordered) {
				this._items.sort(function(a, b) {
					return Math.abs(a._data.anchorPos.min.y) - Math.abs(b._data.anchorPos.min.y) ||
						Math.abs(a._data.anchorPos.min.x) - Math.abs(b._data.anchorPos.min.x);
				});
			}
			this.layout();
		}
	},

	fillChanges: function(redlines) {
		var changecomment;
		this.clearChanges();
		// items contains comments
		var ordered = !this._items.length;
		for (var idx in redlines) {
			changecomment = redlines[idx];
			if (!this.adjustRedLine(changecomment)) {
				// something wrong in this redline, skip this one
				continue;
			}
			if (changecomment.author in this._map._viewInfoByUserName) {
				changecomment.avatar = this._map._viewInfoByUserName[changecomment.author].userextrainfo.avatar;
			}
			this._items.push(L.annotation(this._map.options.docBounds.getSouthEast(), changecomment).addTo(this._map));
		}
		if (this._items.length > 0) {
			if (!ordered) {
				this._items.sort(function(a, b) {
					return Math.abs(a._data.anchorPos.min.y) - Math.abs(b._data.anchorPos.min.y) ||
						Math.abs(a._data.anchorPos.min.x) - Math.abs(b._data.anchorPos.min.x);
				});
			}
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
		if (index < 0)
			return undefined;
		for (var idx = index + 1;
		     idx < this._items.length && this._items[idx]._data.parent === this._items[idx - 1]._data.id;
		     idx++)
		{
			index = idx;
		}

		return index;
	},

	getBounds: function () {
		if (this._items.length <= 0 || this._items.length === this._hiddenItems)
			return null;

		var allCommentsBounds = null;
		for (var idx = 0; idx < this._items.length; ++idx) {
			if (this._items[idx].isVisible()) {
				if (!allCommentsBounds) {
					allCommentsBounds = this._items[idx].getBounds();
				} else {
					var bounds = this._items[idx].getBounds();
					allCommentsBounds.extend(bounds.min);
					allCommentsBounds.extend(bounds.max);
				}
			}
		}
		return allCommentsBounds;
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
			if (this._selected && $(this._selected._container).hasClass('annotation-active'))
				$(this._selected._container).removeClass('annotation-active');

			this._selected = null;
			this.update();
		}
	},

	select: function (annotation) {
		if (annotation) {
			// Select the root comment
			var idx = this.getRootIndexOf(annotation._data.id);

			if (this._selected && $(this._selected._container).hasClass('annotation-active'))
				$(this._selected._container).removeClass('annotation-active');

			this._selected = this._items[idx];

			if (this._selected && !$(this._selected._container).hasClass('annotation-active'))
				$(this._selected._container).addClass('annotation-active');

			this.update();
		}
	},

	selectById: function(commentId) {
		var idx = this.getRootIndexOf(commentId);
		this._selected = this._items[idx];
		this.update();
	},

	update: function () {
		if (!this._selected) {
			this._map.removeLayer(this._arrow);
		}
		this.layout();
	},

	updateDocBounds: function () {
		if (this._items.length === 0 || this._items.length === this._hiddenItems) {
			this._map.fire('updatemaxbounds', {sizeChanged: true});
		}
	},

	_checkBounds: function () {
		if (!this._map || this._map.animatingZoom || this._items.length === 0) {
			return;
		}

		var thisBounds = this.getBounds();
		if (!thisBounds)
			return;

		var maxBounds = this._map.getLayerMaxBounds();
		if (!maxBounds.contains(thisBounds)) {
			var margin = this._items[0].getMargin();
			var docBounds = this._map.getLayerDocBounds();
			var delta = L.point(Math.max(thisBounds.max.x - docBounds.max.x, 0), Math.max(thisBounds.max.y - docBounds.max.y, 0));
			if (delta.x > 0) {
				delta.x += margin.x;
			}
			if (delta.y > 0) {
				delta.y += margin.y;
			}
			this._map.fire('updatemaxbounds', {
				sizeChanged: true,
				extraSize: delta
			});
		}
	},

	layoutUp: function (commentThread, latLng, layoutBounds) {
		if (commentThread.length <= 0)
			return;

		(new L.PosAnimation()).run(commentThread[0]._container, this._map.latLngToLayerPoint(latLng));
		commentThread[0].setLatLng(latLng, /*skip check bounds*/ true);
		var bounds = commentThread[0].getBounds();
		var idx = 1;
		while (idx < commentThread.length) {
			bounds.extend(bounds.max.add([0, commentThread[idx].getBounds().getSize().y]));
			idx++;
		}

		var docRight = this._map.project(this._map.options.docBounds.getNorthEast());
		var posX = docRight.x + this.options.marginX;
		posX = this._map.latLngToLayerPoint(this._map.unproject(L.point(posX, 0))).x;
		var posY;
		if (layoutBounds.min.y <= bounds.max.y) {
			layoutBounds.extend(layoutBounds.min.subtract([0, bounds.getSize().y]));
			posY = layoutBounds.min.y;
		}
		else {
			posY = bounds.min.y;
			layoutBounds.extend(L.point(layoutBounds.min.x, bounds.min.y));
		}
		var pt = L.point(posX, posY);
		layoutBounds.extend(layoutBounds.min.subtract([0, this.options.marginY]));

		idx = 0;
		for (idx = 0; idx < commentThread.length; ++idx) {
			if (commentThread[idx]._data.resolved !== 'true' || this._showResolved) {
				latLng = this._map.layerPointToLatLng(pt);
				(new L.PosAnimation()).run(commentThread[idx]._container, this._map.latLngToLayerPoint(latLng));
				commentThread[idx].setLatLng(latLng, /*skip check bounds*/ true);
				commentThread[idx].show();

				var commentBounds = commentThread[idx].getBounds();
				pt = pt.add([0, commentBounds.getSize().y]);
			}
		}
	},

	layoutDown: function (commentThread, latLng, layoutBounds) {
		if (commentThread.length <= 0)
			return;

		(new L.PosAnimation()).run(commentThread[0]._container, this._map.latLngToLayerPoint(latLng));
		commentThread[0].setLatLng(latLng, /*skip check bounds*/ true);
		var bounds = commentThread[0].getBounds();
		var idx = 1;
		while (idx < commentThread.length) {
			bounds.extend(bounds.max.add([0, commentThread[idx].getBounds().getSize().y]));
			idx++;
		}

		var docRight = this._map.project(this._map.options.docBounds.getNorthEast());
		var posX = docRight.x + this.options.marginX;
		posX = this._map.latLngToLayerPoint(this._map.unproject(L.point(posX, 0))).x;
		var posY;
		if (layoutBounds.max.y >= bounds.min.y) {
			posY = layoutBounds.getBottomLeft().y;
			layoutBounds.extend(layoutBounds.max.add([0, bounds.getSize().y]));
		}
		else {
			posY = bounds.min.y;
			layoutBounds.extend(L.point(layoutBounds.max.x, bounds.max.y));
		}
		var pt = L.point(posX, posY);
		layoutBounds.extend(layoutBounds.max.add([0, this.options.marginY]));

		idx = 0;
		for (idx = 0; idx < commentThread.length; ++idx) {
			if (commentThread[idx]._data.resolved !== 'true' || this._showResolved) {
				latLng = this._map.layerPointToLatLng(pt);
				(new L.PosAnimation()).run(commentThread[idx]._container, this._map.latLngToLayerPoint(latLng));
				commentThread[idx].setLatLng(latLng, /*skip check bounds*/ true);
				commentThread[idx].show();

				var commentBounds = commentThread[idx].getBounds();
				pt = pt.add([0, commentBounds.getSize().y]);
			}
		}
	},

	doLayout: function (zoom) {
		this._updateScaling();
		var docRight = this._map.project(this._map.options.docBounds.getNorthEast());
		var topRight = docRight.add(L.point(this.options.marginX, this.options.marginY));
		var latlng, layoutBounds, point, idx;
		if (this._selected) {
			var selectIndexFirst = this.getRootIndexOf(this._selected._data.id);
			var selectIndexLast = this.getLastChildIndexOf(this._selected._data.id);
			if (zoom) {
				this._items[selectIndexFirst]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[selectIndexFirst]._data.anchorPos.min);
			}

			var anchorPx = this._items[selectIndexFirst]._data.anchorPix;
			var posX = docRight.x;
			var posY = anchorPx.y;
			point = this._map._docLayer._twipsToPixels(this._items[selectIndexFirst]._data.anchorPos.min);

			var mapBoundsPx = this._map.getPixelBounds();
			var annotationBoundsPx = this._items[selectIndexFirst].getBounds();
			var annotationSize = annotationBoundsPx.getSize();
			var topLeftPoint = L.point(posX, posY);
			var bottomRightPoint = topLeftPoint.add(annotationSize);
			var scrollX = 0, scrollY = 0, spacing = 16;
			// there is an odd gap between map top and anchor point y coordinate; is this due to the top ruler bar ?
			// anyway without taking it into account the y-scroll offset is wrong
			var gapY = 22;

			if (this._selected !== this._lastSelected) {
				this._lastSelected = this._selected;
				if (anchorPx.x < mapBoundsPx.min.x) {
					// a lot of spacing; we would need to know where is the left start of the annotated element;
					// the anchor point is on the bottom right
					scrollX = anchorPx.x - mapBoundsPx.min.x - 3 * spacing;
				}
				if (anchorPx.y < mapBoundsPx.min.y + gapY) {
					scrollY = anchorPx.y - mapBoundsPx.min.y - gapY - spacing;
				}
				scrollX = Math.round(scrollX);
				scrollY = Math.round(scrollY);
				if (scrollX !== 0 || scrollY !== 0) {
					this._map.fire('scrollby', {x: scrollX, y: scrollY});
					return;
				}
			}

			// move the annotation box in order to make it visible but only if the annotated element is already visible
			if (anchorPx.x >= mapBoundsPx.min.x &&  anchorPx.x <= mapBoundsPx.max.x
				&& anchorPx.y >= mapBoundsPx.min.y + gapY && anchorPx.y <= mapBoundsPx.max.y + gapY) {
				scrollX = 0; scrollY = 0;

				if (bottomRightPoint.x > mapBoundsPx.max.x) {
					scrollX = bottomRightPoint.x - mapBoundsPx.max.x + spacing;
				}
				if (bottomRightPoint.y > mapBoundsPx.max.y) {
					scrollY = bottomRightPoint.y - mapBoundsPx.max.y - spacing;
				}
				scrollX = Math.round(scrollX);
				scrollY = Math.round(scrollY);
				console.log('doLayout: scrollY 2: ' + scrollY);
				posX -= scrollX;
				if (posX < mapBoundsPx.min.x)
					posX = Math.round(mapBoundsPx.min.x + spacing);
				posY -= scrollY;
				if (posY < mapBoundsPx.min.y)
					posY = Math.round(mapBoundsPx.min.y + spacing);
				// avoid the annotation box to cover the annotated element
				if (posX < anchorPx.x + spacing) {
					var anchorPosMax = this._map._docLayer._twipsToPixels(this._items[selectIndexFirst]._data.anchorPos.max);
					var lineHeight = Math.round(anchorPosMax.y - anchorPx.y);
					posY += 2 * lineHeight;
					point.y += lineHeight;
				}
			}

			// Draw arrow
			this._arrow.setLatLngs([this._map.unproject(point), this._map.unproject(L.point(posX, posY))]);
			this._map.addLayer(this._arrow);

			latlng = this._map.unproject(L.point(posX, posY));
			var annotationCoords = this._map.latLngToLayerPoint(latlng);
			(new L.PosAnimation()).run(this._items[selectIndexFirst]._container, annotationCoords);
			this._items[selectIndexFirst].setLatLng(latlng, /*skip check bounds*/ true);
			layoutBounds = this._items[selectIndexFirst].getBounds();

			// Adjust child comments too, if any
			for (idx = selectIndexFirst + 1; idx <= selectIndexLast; idx++) {
				if (this._items[idx]._data.resolved !== 'true' || this._showResolved) {
					if (zoom) {
						this._items[idx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[idx]._data.anchorPos.min);
					}
					latlng = this._map.layerPointToLatLng(layoutBounds.getBottomLeft());
					(new L.PosAnimation()).run(this._items[idx]._container, layoutBounds.getBottomLeft());
					this._items[idx].setLatLng(latlng, /*skip check bounds*/ true);
					var commentBounds = this._items[idx].getBounds();
					layoutBounds.extend(layoutBounds.max.add([0, commentBounds.getSize().y]));
				}
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
					if (this._items[tmpIdx]._data.resolved !== 'true' || this._showResolved) {
						commentThread.push(this._items[tmpIdx]);
					}

					tmpIdx = tmpIdx - 1;
				} while (tmpIdx >= 0 && this._items[tmpIdx]._data.id === this._items[tmpIdx + 1]._data.parent);

				if (commentThread.length > 0) {
					commentThread.reverse();
					// All will have some anchor position
					this.layoutUp(commentThread, this._map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
					idx = idx - commentThread.length;
				} else {
					idx = tmpIdx;
				}
			}

			for (idx = selectIndexLast + 1; idx < this._items.length;) {
				commentThread = [];
				tmpIdx = idx;
				do {
					if (zoom) {
						this._items[idx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[idx]._data.anchorPos.min);
					}
					if (this._items[tmpIdx]._data.resolved !== 'true' || this._showResolved) {
						commentThread.push(this._items[tmpIdx]);
					}

					tmpIdx = tmpIdx + 1;
				} while (tmpIdx < this._items.length && this._items[tmpIdx]._data.parent === this._items[tmpIdx - 1]._data.id);


				// All will have some anchor position
				if (commentThread.length > 0) {
					this.layoutDown(commentThread, this._map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
					idx = idx + commentThread.length;
				} else {
					idx = tmpIdx;
				}
			}
			if (!this._selected.isEdit()) {
				this._selected.show();
			}
		} else if (this._items.length > 0) { // If nothing is selected, but there are comments:
			this._lastSelected = null;
			point = this._map.latLngToLayerPoint(this._map.unproject(L.point(topRight.x, this._items[0]._data.anchorPix.y)));
			layoutBounds = L.bounds(point, point);
			// Pass over all comments present
			for (idx = 0; idx < this._items.length;) {
				commentThread = [];
				tmpIdx = idx;
				do {
					if (zoom) {
						this._items[tmpIdx]._data.anchorPix = this._map._docLayer._twipsToPixels(this._items[tmpIdx]._data.anchorPos.min);
					}
					// Add this item to the list of comments.
					if (this._items[tmpIdx]._data.resolved !== 'true' || this._showResolved) {
						commentThread.push(this._items[tmpIdx]);
					}
					tmpIdx = tmpIdx + 1;
					// Continue this loop, until we reach the last item, or an item which is not a direct descendant of the previous item.
				} while (tmpIdx < this._items.length && this._items[tmpIdx]._data.parent === this._items[tmpIdx - 1]._data.id);

				if (commentThread.length > 0) {
					this.layoutDown(commentThread, this._map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
					idx = idx + commentThread.length;
				} else {
					idx = tmpIdx;
				}
			}
		}
		this._checkBounds();
	},

	layout: function (zoom) {
		if (zoom)
			this.doLayout(zoom);
		else if (!this._layoutTimer) {
			var me = this;
			me._layoutTimer = setTimeout(function() {
				delete me._layoutTimer;
				me.doLayout(zoom);
			}, 250 /* ms */);
		} // else - avoid excessive re-layout
	},

	add: function (comment) {
		var annotation = L.annotation(this._map._docLayer._twipsToLatLng(comment.anchorPos.getTopRight()), comment,
			comment.id === 'new' ? {noMenu: true} : {}).addTo(this._map);
		if (comment.parent && comment.parent > '0') {
			var parentIdx = this.getIndexOf(comment.parent);
			this._items.splice(parentIdx + 1, 0, annotation);
			this.updateResolvedState(annotation);
			this.showHideComment(annotation);
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
		}
		else {
			annotation.reply();
			this.select(annotation);
			annotation.focus();
		}
	},

	resolve: function (annotation) {
		var comment = {
			Id: {
				type: 'string',
				value: annotation._data.id
			}
		};
		this._map.sendUnoCommand('.uno:ResolveComment', comment);
	},

	resolveThread: function (annotation) {
		var comment = {
			Id: {
				type: 'string',
				value: annotation._data.id
			}
		};
		this._map.sendUnoCommand('.uno:ResolveCommentThread', comment);
	},

	updateResolvedState: function (annotation) {
		var threadIndexFirst = this.getRootIndexOf(annotation._data.id);
		if (this._items[threadIndexFirst]._data.resolved !== annotation._data.resolved) {
			annotation._data.resolved = this._items[threadIndexFirst]._data.resolved;
			annotation.update();
			this.update();
		}
	},

	showHideComment: function (annotation) {
		// This manually shows/hides comments
		if (!this._showResolved) {
			if (annotation.isVisible() && annotation._data.resolved === 'true') {
				if (this._selected == annotation) {
					this.unselect();
				}
				annotation.hide();
				this._hiddenItems++;
				annotation.update();
			} else if (!annotation.isVisible() && annotation._data.resolved === 'false') {
				annotation.show();
				this._hiddenItems--;
				annotation.update();
			}
			this.layout();
			this.update();
			this.updateDocBounds();
		}
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

	removeThread: function (id) {
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		this._map.sendUnoCommand('.uno:DeleteCommentThread', comment);
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

	_isThreadResolved: function(annotation) {
		var lastChild = this.getLastChildIndexOf(annotation._data.id);

		while (this._items[lastChild]._data.parent !== '0') {
			if (this._items[lastChild]._data.resolved === 'false')
				return false;
			lastChild = this.getIndexOf(this._items[lastChild]._data.parent);
		}
		if (this._items[lastChild]._data.resolved === 'false')
			return false;
		return true;
	},

	// Adjust parent-child relationship, if required, after `comment` is added
	adjustParentAdd: function(comment) {
		if (comment.parent && comment.parent > '0') {
			var parentIdx = this.getIndexOf(comment.parent);
			if (parentIdx === -1) {
				console.warn('adjustParentAdd: No parent comment to attach received comment to. ' +
				             'Parent comment ID sought is :' + comment.parent + ' for current comment with ID : ' + comment.id);
				return;
			}
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

		if (changetrack && obj.redline.author in this._map._viewInfoByUserName) {
			obj.redline.avatar = this._map._viewInfoByUserName[obj.redline.author].userextrainfo.avatar;
		}
		else if (!changetrack && obj.comment.author in this._map._viewInfoByUserName) {
			obj.comment.avatar = this._map._viewInfoByUserName[obj.comment.author].userextrainfo.avatar;
		}

		if (window.mode.isMobile()) {
			var annotation = this._items[this.getRootIndexOf(obj.comment.id)];
			if (!annotation)
				annotation = this._items[this.getRootIndexOf(obj.comment.parent)]; //this is required for reload after reply in writer
		}
		if (action === 'Add') {
			if (changetrack) {
				if (!this.adjustRedLine(obj.redline)) {
					// something wrong in this redline
					return;
				}
				this.add(obj.redline);
			} else {
				this.adjustComment(obj.comment);
				this.adjustParentAdd(obj.comment);
				this.add(obj.comment);
			}
			if (this._selected && !this._selected.isEdit()) {
				this._map.focus();
			}
			this.layout();
		} else if (action === 'Remove') {
			if (window.mode.isMobile() && obj.comment.id === annotation._data.id) {
				var child = this._items[this.getIndexOf(obj.comment.id) + 1];
				// Need to restore the original layers here becuase once removed they will be inaccessible and will stay there
				this._map.removeLayer(annotation._data.wizardHighlight);
				this._map.addLayer(annotation._data.textSelected);
				if (child && child._data.parent === annotation._data.id)
					annotation = child;
				else
					annotation = undefined;
			}
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var removed = this.getItem(id);
			if (removed) {
				this.adjustParentRemove(removed);
				this._map.removeLayer(this.removeItem(id));
				if (this._selected === removed) {
					this.unselect();
				} else {
					this.layout();
				}
			}
			this.updateDocBounds();
		} else if (action === 'Modify') {
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var modified = this.getItem(id);
			if (modified) {
				var modifiedObj;
				if (changetrack) {
					if (!this.adjustRedLine(obj.redline)) {
						// something wrong in this redline
						return;
					}
					modifiedObj = obj.redline;
				} else {
					this.adjustComment(obj.comment);
					modifiedObj = obj.comment;
				}
				modified.setData(modifiedObj);
				modified.update();
				this.update();
			}
		} else if (action === 'Resolve') {
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var resolved = this.getItem(id);
			if (resolved) {
				var resolvedObj;
				if (changetrack) {
					if (!this.adjustRedLine(obj.redline)) {
						// something wrong in this redline
						return;
					}
					resolvedObj = obj.redline;
				} else {
					this.adjustComment(obj.comment);
					resolvedObj = obj.comment;
				}
				resolved.setData(resolvedObj);
				resolved.update();
				this.showHideComment(resolved);
				this.update();
			}
		}
		if (window.mode.isMobile())
			this._map._docLayer._openCommentWizard(annotation);
	},

	_onAnnotationCancel: function (e) {
		if (e.annotation._data.id === 'new') {
			var layer = this.removeItem(e.annotation._data.id);
			if (layer)
				this._map.removeLayer(layer);
			this.updateDocBounds();
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
			var item = this.removeItem(e.annotation._data.id);
			if (item)
				this._map.removeLayer(item);
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

	_onAnnotationZoom: function () {
		this._map.fire('updatemaxbounds', {sizeChanged: true});
		this.layout(true);
	},

	_getScaleFactor: function () {
		var scaleFactor = 1.0 / this._map.getZoomScale(this._map.options.zoom, this._map.getZoom());
		if (scaleFactor < 0.4)
			scaleFactor = 0.4;
		else if (scaleFactor < 0.6)
			scaleFactor = 0.6 - (0.6 - scaleFactor) / 2.0;
		else if (scaleFactor < 0.8)
			scaleFactor = 0.8;
		else if (scaleFactor <= 2)
			scaleFactor = 1;
		else if (scaleFactor > 2) {
			scaleFactor = 1 + (scaleFactor - 1) / 10.0;
			if (scaleFactor > 1.5)
				scaleFactor = 1.5;
		}
		return scaleFactor;
	},

	_updateScaling: function () {
		if (window.mode.isDesktop() || this._items.length === 0)
			return;
		var contentWrapperClassName, menuClassName;
		if (this._items[0]._data.trackchange) {
			contentWrapperClassName = '.loleaflet-annotation-redline-content-wrapper';
			menuClassName = '.loleaflet-annotation-menu-redline';
		} else {
			contentWrapperClassName = '.loleaflet-annotation-content-wrapper';
			menuClassName = '.loleaflet-annotation-menu';
		}

		var initNeeded = (this._initialLayoutData === undefined);
		var contentWrapperClass = $(contentWrapperClassName);
		if (initNeeded && contentWrapperClass.length > 0) {
			var contentAuthor = $('.loleaflet-annotation-content-author');
			var dateClass = $('.loleaflet-annotation-date');

			this._initialLayoutData = {
				wrapperWidth: parseInt(contentWrapperClass.css('width')),
				wrapperFontSize: parseInt(contentWrapperClass.css('font-size')),
				authorContentHeight: parseInt(contentAuthor.css('height')),
				dateFontSize: parseInt(dateClass.css('font-size')),
			};
		}

		// What if this._initialLayoutData is still undefined when we get here? (I.e. if
		// contentWrapperClass.length == 0.) No idea. Using
		// this._initialLayoutData.menuWidth below will lead to an unhandled exception.
		// Maybe best to just return then? Somebody who understands the code could fix this
		// better, perhaps.
		if (this._initialLayoutData === undefined)
			return;

		var menuClass = $(menuClassName);
		if ((this._initialLayoutData.menuWidth === undefined) && menuClass.length > 0) {
			this._initialLayoutData.menuWidth = parseInt(menuClass.css('width'));
			this._initialLayoutData.menuHeight = parseInt(menuClass.css('height'));
		}

		var scaleFactor = this._getScaleFactor();
		var idx;
		if (this._selected) {
			var selectIndexFirst = this.getRootIndexOf(this._selected._data.id);
			var selectIndexLast = this.getLastChildIndexOf(this._selected._data.id);
			for (idx = 0; idx < this._items.length; idx++) {
				if (idx < selectIndexFirst || idx >  selectIndexLast) {
					this._items[idx]._updateScaling(scaleFactor, this._initialLayoutData);
				}
				else {
					this._items[idx]._updateScaling(1, this._initialLayoutData);
				}
			}
		}
		else {
			for (idx = 0; idx < this._items.length; idx++) {
				this._items[idx]._updateScaling(scaleFactor, this._initialLayoutData);
			}
		}
	},

	setViewResolved: function(state) {
		this._showResolved = state;

		for (var idx = 0; idx < this._items.length;idx++) {
			if (this._items[idx]._data.resolved === 'true') {
				if (state==false) {
					if (this._selected == this._items[idx]) {
						this.unselect();
					}
					this._items[idx].hide();
					this._hiddenItems++;
				} else {
					this._items[idx].show();
					this._hiddenItems--;
				}
			}
			this._items[idx].update();
		}
		this.layout();
		this.update();
		if (state === false)
			this.updateDocBounds();
	},

	
});


L.Map.include({
	insertComment: function() {
		var avatar = undefined;
		var author = this.getViewName(this._docLayer._viewId);
		if (author in this._viewInfoByUserName) {
			avatar = this._viewInfoByUserName[author].userextrainfo.avatar;
		}
		this._docLayer.newAnnotation({
			text: '',
			textrange: '',
			author: author,
			dateTime: new Date().toDateString(),
			id: 'new', // 'new' only when added by us
			avatar: avatar
		});
	},

	showResolvedComments: function(on) {
		var unoCommand = '.uno:ShowResolvedAnnotations';
		this.sendUnoCommand(unoCommand);
		this._docLayer._annotations.setViewResolved(on);
	}
});


L.annotationManager = function (map, options) {
	return new L.AnnotationManager(map, options);
};
