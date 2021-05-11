/* eslint-disable */
/* See CanvasSectionContainer.ts for explanations. */

declare var L: any;
declare var app: any;

app.definitions.CommentSection =
class CommentSection {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null;
	containerObject: any = null;
	dpiScale: number = null;
	name: string = L.CSections.CommentList.name;
	backgroundColor: string = null;
	borderColor: string = null;
	boundToSection: string = null;
	anchor: Array<any> = new Array(0);
	documentObject: boolean = false;
	position: Array<number> = [0, 0];
	size: Array<number> = [290, 0];
	expand: Array<string> = ['bottom'];
	isLocated: boolean = false;
	showSection: boolean = true;
	processingOrder: number = L.CSections.CommentList.processingOrder;
	drawingOrder: number = L.CSections.CommentList.drawingOrder;
	zIndex: number = L.CSections.CommentList.zIndex;
	interactable: boolean = false;
	sectionProperties: any = {};
	stopPropagating: Function; // Implemented by section container.
	setPosition: Function; // Implemented by section container. Document objects only.
	map: any;

	constructor () {
		this.map = L.Map.THIS;
		// Below anchor list may be expanded. For example, Writer may have ruler section. Then ruler section should also be added here.
		// If there is column header section, its bottom will be this section's top.
		this.anchor = [[L.CSections.ColumnHeader.name, 'bottom', 'top'], 'right'];
		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.list = new Array(0);
		this.sectionProperties.selectedComment = null;
		this.sectionProperties.arrow = null;
		this.sectionProperties.hiddenCommentCount = 0;
		this.sectionProperties.initialLayoutData = null;
		this.sectionProperties.lastSelectedComment = null;
		this.sectionProperties.showResolved = null;
		this.sectionProperties.marginX = 40;
		this.sectionProperties.marginY = 10;
		this.sectionProperties.offset = 5;
		this.sectionProperties.layoutTimer = null;
	}

	public onInitialize () {
		this.backgroundColor = this.containerObject.getClearColor();
	}

	public onResize () {

	}

	public onDraw () {

	}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {

	}

	public onMouseUp (point: Array<number>, e: MouseEvent) {
	}

	public onMouseDown (point: Array<number>, e: MouseEvent) {
	}

	public onMouseEnter () {
	}

	public onMouseLeave () {
	}

	public onNewDocumentTopLeft () {

	}

	private adjustComment (comment: any) {
		var rectangles, color, viewId;
		comment.trackchange = false;
		rectangles = L.PolyUtil.rectanglesToPolygons(L.LOUtil.stringToRectangles(comment.textRange || comment.anchorPos), this.map._docLayer);
		comment.anchorPos = L.LOUtil.stringToBounds(comment.anchorPos);
		comment.anchorPix = this.map._docLayer._twipsToPixels(comment.anchorPos.min);
		viewId = this.map.getViewId(comment.author);
		color = viewId >= 0 ? L.LOUtil.rgbToHex(this.map.getViewColor(viewId)) : '#43ACE8';
		if (rectangles.length > 0) {
			comment.textSelected = L.polygon(rectangles, {
				pointerEvents: 'all',
				interactive: false,
				fillColor: color,
				fillOpacity: 0.25,
				weight: 2,
				opacity: 0.25
			});
			comment.textSelected.addEventParent(this.map);
			comment.textSelected.on('click', function() {
				this.selectById(comment.id);
			}, this);

			if ((<any>window).mode.isMobile()) {
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
	}

	private getScaleFactor () {
		var scaleFactor = 1.0 / this.map.getZoomScale(this.map.options.zoom, this.map.getZoom());
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
	}

	// Returns the last comment id of comment thread containing the given id
	private getLastChildIndexOf (id: any) {
		var index = this.getIndexOf(id);
		if (index < 0)
			return undefined;
		for (var idx = index + 1;
		     idx < this.sectionProperties.commentList.length && this.sectionProperties.commentList[idx]._data.parent === this.sectionProperties.commentList[idx - 1]._data.id;
		     idx++)
		{
			index = idx;
		}

		return index;
	}

	private updateScaling () {
		if ((<any>window).mode.isDesktop() || this.sectionProperties.commentList.length === 0)
			return;
		var contentWrapperClassName, menuClassName;
		if (this.sectionProperties.commentList[0]._data.trackchange) {
			contentWrapperClassName = '.loleaflet-annotation-redline-content-wrapper';
			menuClassName = '.loleaflet-annotation-menu-redline';
		} else {
			contentWrapperClassName = '.loleaflet-annotation-content-wrapper';
			menuClassName = '.loleaflet-annotation-menu';
		}

		var initNeeded = (this.sectionProperties.initialLayoutData === null);
		var contentWrapperClass = $(contentWrapperClassName);
		if (initNeeded && contentWrapperClass.length > 0) {
			var contentAuthor = $('.loleaflet-annotation-content-author');
			var dateClass = $('.loleaflet-annotation-date');

			this.sectionProperties.initialLayoutData = {
				wrapperWidth: parseInt(contentWrapperClass.css('width')),
				wrapperFontSize: parseInt(contentWrapperClass.css('font-size')),
				authorContentHeight: parseInt(contentAuthor.css('height')),
				dateFontSize: parseInt(dateClass.css('font-size')),
			};
		}

		// What if this._initialLayoutData is still null when we get here? (I.e. if
		// contentWrapperClass.length == 0.) No idea. Using
		// this._initialLayoutData.menuWidth below will lead to an unhandled exception.
		// Maybe best to just return then? Somebody who understands the code could fix this
		// better, perhaps.
		if (this.sectionProperties.initialLayoutData === null)
			return;

		var menuClass = $(menuClassName);
		if ((this.sectionProperties.initialLayoutData.menuWidth === undefined) && menuClass.length > 0) {
			this.sectionProperties.initialLayoutData.menuWidth = parseInt(menuClass.css('width'));
			this.sectionProperties.initialLayoutData.menuHeight = parseInt(menuClass.css('height'));
		}

		var scaleFactor = this.getScaleFactor();
		var idx;
		if (this.sectionProperties.selectedComment) {
			var selectIndexFirst = this.getRootIndexOf(this.sectionProperties.selectedComment._data.id);
			var selectIndexLast = this.getLastChildIndexOf(this.sectionProperties.selectedComment._data.id);
			for (idx = 0; idx < this.sectionProperties.commentList.length; idx++) {
				if (idx < selectIndexFirst || idx >  selectIndexLast) {
					this.sectionProperties.commentList[idx]._updateScaling(scaleFactor, this.sectionProperties.initialLayoutData);
				}
				else {
					this.sectionProperties.commentList[idx]._updateScaling(1, this.sectionProperties.initialLayoutData);
				}
			}
		}
		else {
			for (idx = 0; idx < this.sectionProperties.commentList.length; idx++) {
				this.sectionProperties.commentList[idx]._updateScaling(scaleFactor, this.sectionProperties.initialLayoutData);
			}
		}
	}

	private layoutDown (commentThread: any, latLng: any, layoutBounds: any) {
		if (commentThread.length <= 0)
			return;

		(new L.PosAnimation()).run(commentThread[0]._container, this.map.latLngToLayerPoint(latLng));
		commentThread[0].setLatLng(latLng, /*skip check bounds*/ true);
		var bounds = commentThread[0].getBounds();
		var idx = 1;
		while (idx < commentThread.length) {
			bounds.extend(bounds.max.add([0, commentThread[idx].getBounds().getSize().y]));
			idx++;
		}

		var docRight = this.map.project(this.map.options.docBounds.getNorthEast());
		var posX = docRight.x + this.sectionProperties.marginX;
		posX = this.map.latLngToLayerPoint(this.map.unproject(L.point(posX, 0))).x;
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
		layoutBounds.extend(layoutBounds.max.add([0, this.sectionProperties.marginY]));

		idx = 0;
		for (idx = 0; idx < commentThread.length; ++idx) {
			if (commentThread[idx]._data.resolved !== 'true' || this.sectionProperties.showResolved) {
				latLng = this.map.layerPointToLatLng(pt);
				(new L.PosAnimation()).run(commentThread[idx]._container, this.map.latLngToLayerPoint(latLng));
				commentThread[idx].setLatLng(latLng, /*skip check bounds*/ true);
				commentThread[idx].show();

				var commentBounds = commentThread[idx].getBounds();
				pt = pt.add([0, commentBounds.getSize().y]);
			}
		}
	}

	private getBounds () {
		if (this.sectionProperties.commentList.length <= 0 || this.sectionProperties.commentList.length === this.sectionProperties.hiddenCommentCount)
			return null;

		var allCommentsBounds = null;
		for (var idx = 0; idx < this.sectionProperties.commentList.length; ++idx) {
			if (this.sectionProperties.commentList[idx].isVisible()) {
				if (!allCommentsBounds) {
					allCommentsBounds = this.sectionProperties.commentList[idx].getBounds();
				} else {
					var bounds = this.sectionProperties.commentList[idx].getBounds();
					allCommentsBounds.extend(bounds.min);
					allCommentsBounds.extend(bounds.max);
				}
			}
		}
		return allCommentsBounds;
	}

	checkBounds () {
		if (!this.map || this.map.animatingZoom || this.sectionProperties.commentList.length === 0) {
			return;
		}

		var thisBounds = this.getBounds();
		if (!thisBounds)
			return;

		var maxBounds = this.map.getLayerMaxBounds();
		if (!maxBounds.contains(thisBounds)) {
			var margin = this.sectionProperties.commentList[0].getMargin();
			var docBounds = this.map.getLayerDocBounds();
			var delta = L.point(Math.max(thisBounds.max.x - docBounds.max.x, 0), Math.max(thisBounds.max.y - docBounds.max.y, 0));
			if (delta.x > 0) {
				delta.x += margin.x;
			}
			if (delta.y > 0) {
				delta.y += margin.y;
			}

			this.map._docLayer._extraScollSizeCSS.x = delta.x;
			this.map._docLayer._extraScollSizeCSS.y = delta.y;
			this.map._docLayer._updateMaxBounds(true);
		}
	}

	private doLayout (zoom: any) {
		this.updateScaling();
		var docRight = this.map.project(this.map.options.docBounds.getNorthEast());
		var topRight = docRight.add(L.point(this.sectionProperties.marginX, this.sectionProperties.marginY));
		var latlng, layoutBounds, point, idx;
		if (this.sectionProperties.selectedComment) {
			var selectIndexFirst = this.getRootIndexOf(this.sectionProperties.selectedComment._data.id);
			var selectIndexLast = this.getLastChildIndexOf(this.sectionProperties.selectedComment._data.id);
			if (zoom) {
				this.sectionProperties.commentList[selectIndexFirst]._data.anchorPix = this.map._docLayer._twipsToPixels(this.sectionProperties.commentList[selectIndexFirst]._data.anchorPos.min);
			}

			var anchorPx = this.sectionProperties.commentList[selectIndexFirst]._data.anchorPix;
			var posX = docRight.x;
			var posY = anchorPx.y;
			point = this.map._docLayer._twipsToPixels(this.sectionProperties.commentList[selectIndexFirst]._data.anchorPos.min);

			var mapBoundsPx = this.map.getPixelBounds();
			var annotationBoundsPx = this.sectionProperties.commentList[selectIndexFirst].getBounds();
			var annotationSize = annotationBoundsPx.getSize();
			var topLeftPoint = L.point(posX, posY);
			var bottomRightPoint = topLeftPoint.add(annotationSize);
			var scrollX = 0, scrollY = 0, spacing = 16;
			// there is an odd gap between map top and anchor point y coordinate; is this due to the top ruler bar ?
			// anyway without taking it into account the y-scroll offset is wrong
			var gapY = 22;

			if (this.sectionProperties.selectedComment !== this.sectionProperties.lastSelectedComment) {
				this.sectionProperties.lastSelectedComment = this.sectionProperties.selectedComment;
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
					this.map.fire('scrollby', {x: scrollX, y: scrollY});
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
					var anchorPosMax = this.map._docLayer._twipsToPixels(this.sectionProperties.commentList[selectIndexFirst]._data.anchorPos.max);
					var lineHeight = Math.round(anchorPosMax.y - anchorPx.y);
					posY += 2 * lineHeight;
					point.y += lineHeight;
				}
			}

			// Draw arrow
			this.sectionProperties.arrow.setLatLngs([this.map.unproject(point), this.map.unproject(L.point(posX, posY))]);
			this.map.addLayer(this.sectionProperties.arrow);

			latlng = this.map.unproject(L.point(posX, posY));
			var annotationCoords = this.map.latLngToLayerPoint(latlng);
			(new L.PosAnimation()).run(this.sectionProperties.commentList[selectIndexFirst]._container, annotationCoords);
			this.sectionProperties.commentList[selectIndexFirst].setLatLng(latlng, /*skip check bounds*/ true);
			layoutBounds = this.sectionProperties.commentList[selectIndexFirst].getBounds();

			// Adjust child comments too, if any
			for (idx = selectIndexFirst + 1; idx <= selectIndexLast; idx++) {
				if (this.sectionProperties.commentList[idx]._data.resolved !== 'true' || this.sectionProperties.showResolved) {
					if (zoom) {
						this.sectionProperties.commentList[idx]._data.anchorPix = this.map._docLayer._twipsToPixels(this.sectionProperties.commentList[idx]._data.anchorPos.min);
					}
					latlng = this.map.layerPointToLatLng(layoutBounds.getBottomLeft());
					(new L.PosAnimation()).run(this.sectionProperties.commentList[idx]._container, layoutBounds.getBottomLeft());
					this.sectionProperties.commentList[idx].setLatLng(latlng, /*skip check bounds*/ true);
					var commentBounds = this.sectionProperties.commentList[idx].getBounds();
					layoutBounds.extend(layoutBounds.max.add([0, commentBounds.getSize().y]));
				}
			}

			layoutBounds.min = layoutBounds.min.add([this.sectionProperties.marginX, 0]);
			layoutBounds.max = layoutBounds.max.add([this.sectionProperties.marginX, 0]);
			layoutBounds.extend(layoutBounds.min.subtract([0, this.sectionProperties.marginY]));
			layoutBounds.extend(layoutBounds.max.add([0, this.sectionProperties.marginY]));

			for (idx = selectIndexFirst - 1; idx >= 0;) {
				var commentThread = [];
				var tmpIdx: number = idx;
				do {
					if (zoom) {
						this.sectionProperties.commentList[idx]._data.anchorPix = this.map._docLayer._twipsToPixels(this.sectionProperties.commentList[idx]._data.anchorPos.min);
					}
					if (this.sectionProperties.commentList[tmpIdx]._data.resolved !== 'true' || this.sectionProperties.showResolved) {
						commentThread.push(this.sectionProperties.commentList[tmpIdx]);
					}

					tmpIdx = tmpIdx - 1;
				} while (tmpIdx >= 0 && this.sectionProperties.commentList[tmpIdx]._data.id === this.sectionProperties.commentList[tmpIdx + 1]._data.parent);

				if (commentThread.length > 0) {
					commentThread.reverse();
					// All will have some anchor position
					this.layoutUp(commentThread, this.map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
					idx = idx - commentThread.length;
				} else {
					idx = tmpIdx;
				}
			}

			for (idx = selectIndexLast + 1; idx < this.sectionProperties.commentList.length;) {
				commentThread = [];
				tmpIdx = idx;
				do {
					if (zoom) {
						this.sectionProperties.commentList[idx]._data.anchorPix = this.map._docLayer._twipsToPixels(this.sectionProperties.commentList[idx]._data.anchorPos.min);
					}
					if (this.sectionProperties.commentList[tmpIdx]._data.resolved !== 'true' || this.sectionProperties.showResolved) {
						commentThread.push(this.sectionProperties.commentList[tmpIdx]);
					}

					tmpIdx = tmpIdx + 1;
				} while (tmpIdx < this.sectionProperties.commentList.length && this.sectionProperties.commentList[tmpIdx]._data.parent === this.sectionProperties.commentList[tmpIdx - 1]._data.id);


				// All will have some anchor position
				if (commentThread.length > 0) {
					this.layoutDown(commentThread, this.map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
					idx = idx + commentThread.length;
				} else {
					idx = tmpIdx;
				}
			}
			if (!this.sectionProperties.selectedComment.isEdit()) {
				this.sectionProperties.selectedComment.show();
			}
		} else if (this.sectionProperties.commentList.length > 0) { // If nothing is selected, but there are comments:
			this.sectionProperties.lastSelectedComment = null;
			point = this.map.latLngToLayerPoint(this.map.unproject(L.point(topRight.x, this.sectionProperties.commentList[0]._data.anchorPix.y)));
			layoutBounds = L.bounds(point, point);
			// Pass over all comments present
			for (idx = 0; idx < this.sectionProperties.commentList.length;) {
				commentThread = [];
				tmpIdx = idx;
				do {
					if (zoom) {
						this.sectionProperties.commentList[tmpIdx]._data.anchorPix = this.map._docLayer._twipsToPixels(this.sectionProperties.commentList[tmpIdx]._data.anchorPos.min);
					}
					// Add this item to the list of comments.
					if (this.sectionProperties.commentList[tmpIdx]._data.resolved !== 'true' || this.sectionProperties.showResolved) {
						commentThread.push(this.sectionProperties.commentList[tmpIdx]);
					}
					tmpIdx = tmpIdx + 1;
					// Continue this loop, until we reach the last item, or an item which is not a direct descendant of the previous item.
				} while (tmpIdx < this.sectionProperties.commentList.length && this.sectionProperties.commentList[tmpIdx]._data.parent === this.sectionProperties.commentList[tmpIdx - 1]._data.id);

				if (commentThread.length > 0) {
					this.layoutDown(commentThread, this.map.unproject(L.point(topRight.x, commentThread[0]._data.anchorPix.y)), layoutBounds);
					idx = idx + commentThread.length;
				} else {
					idx = tmpIdx;
				}
			}
		}
		this.checkBounds();
	}

	layoutUp (commentThread: any, latLng: any, layoutBounds: any) {
		if (commentThread.length <= 0)
			return;

		(new L.PosAnimation()).run(commentThread[0]._container, this.map.latLngToLayerPoint(latLng));
		commentThread[0].setLatLng(latLng, /*skip check bounds*/ true);
		var bounds = commentThread[0].getBounds();
		var idx = 1;
		while (idx < commentThread.length) {
			bounds.extend(bounds.max.add([0, commentThread[idx].getBounds().getSize().y]));
			idx++;
		}

		var docRight = this.map.project(this.map.options.docBounds.getNorthEast());
		var posX = docRight.x + this.sectionProperties.marginX;
		posX = this.map.latLngToLayerPoint(this.map.unproject(L.point(posX, 0))).x;
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
		layoutBounds.extend(layoutBounds.min.subtract([0, this.sectionProperties.marginY]));

		idx = 0;
		for (idx = 0; idx < commentThread.length; ++idx) {
			if (commentThread[idx]._data.resolved !== 'true' || this.sectionProperties.showResolved) {
				latLng = this.map.layerPointToLatLng(pt);
				(new L.PosAnimation()).run(commentThread[idx]._container, this.map.latLngToLayerPoint(latLng));
				commentThread[idx].setLatLng(latLng, /*skip check bounds*/ true);
				commentThread[idx].show();

				var commentBounds = commentThread[idx].getBounds();
				pt = pt.add([0, commentBounds.getSize().y]);
			}
		}
	}

	private layout (zoom: any = null) {
		if (zoom)
			this.doLayout(zoom);
		else if (!this.sectionProperties.layoutTimer) {
			var that = this;
			that.sectionProperties.layoutTimer = setTimeout(function() {
				delete that.sectionProperties.layoutTimer;
				that.doLayout(zoom);
			}, 250 /* ms */);
		} // else - avoid excessive re-layout
	}

	private update () {
		if (!this.sectionProperties.selectedComment) {
			this.map.removeLayer(this.sectionProperties.arrow);
		}
		this.layout();
	}

	private getIndexOf (id: any) {
		for (var index = 0; index < this.sectionProperties.commentList.length; index++) {
			if (this.sectionProperties.commentList[index]._data.id === id) {
				return index;
			}
		}
		return -1;
	}

	// Returns the root comment id of given id
	private getRootIndexOf (id: any) {
		var index = this.getIndexOf(id);
		for (var idx = index - 1;
			     idx >=0 && this.sectionProperties.commentList[idx]._data.id === this.sectionProperties.commentList[idx + 1]._data.parent;
			     idx--)
		{
			index = idx;
		}

		return index;
	}

	private updateResolvedState (comment: any) {
		var threadIndexFirst = this.getRootIndexOf(comment._data.id);
		if (this.sectionProperties.commentList[threadIndexFirst]._data.resolved !== comment._data.resolved) {
			comment._data.resolved = this.sectionProperties.commentList[threadIndexFirst]._data.resolved;
			comment.update();
			this.update();
		}
	}

	public importComments (commentList: any) {
		var comment;
		this.clearList();
		// items contains redlines
		var ordered = !this.sectionProperties.list.length;
		for (var index in commentList) {
			comment = commentList[index];
			this.adjustComment(comment);
			if (comment.author in this.map._viewInfoByUserName) {
				comment.avatar = this.map._viewInfoByUserName[comment.author].userextrainfo.avatar;
			}
			this.sectionProperties.list.push(L.annotation(this.map.options.docBounds.getSouthEast(), comment).addTo(this.map));
			this.updateResolvedState(this.sectionProperties.list[this.sectionProperties.list.length - 1]);
			if (this.sectionProperties.list[this.sectionProperties.list.length - 1]._data.resolved === 'true') {
				this.sectionProperties.hiddenCommentCount++;
			}
		}
		if (this.sectionProperties.list.length > 0) {
			if (!ordered) {
				this.sectionProperties.list.sort(function(a: any, b: any) {
					return Math.abs(a._data.anchorPos.min.y) - Math.abs(b._data.anchorPos.min.y) ||
						Math.abs(a._data.anchorPos.min.x) - Math.abs(b._data.anchorPos.min.x);
				});
			}
			this.layout();
		}
	}

	// Remove only text comments from the document (excluding change tracking comments)
	private clearList () {
		for (var i: number = this.sectionProperties.list.length -1; i > -1; i--) {
			if (!this.sectionProperties.list[i].trackchange) {
				this.map.removeLayer(this.sectionProperties.list[i]);
				this.sectionProperties.list.splice(i, 1);
			}
		}

		this.sectionProperties.selectedComment = null;
		this.map.removeLayer(this.sectionProperties.arrow);
	}

	public onMouseWheel () {}
	public onClick () {}
	public onDoubleClick () {}
	public onContextMenu () {}
	public onLongPress () {}
	public onMultiTouchStart () {}
	public onMultiTouchMove () {}
	public onMultiTouchEnd () {}
}