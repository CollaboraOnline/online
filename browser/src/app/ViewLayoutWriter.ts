/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

type DocumentSpacingInfo = {
	documentMarginsWidth: number;
	commentSectionWidth: number;
};

class ViewLayoutWriter extends ViewLayoutBase {
	public readonly type: string = 'ViewLayoutWriter';
	private documentScrollOffset: number = 0;

	constructor() {
		super();
		app.map.on('zoomlevelschange', this.documentZoomOrResizeCallback, this);
		app.map.on('resize', this.documentZoomOrResizeCallback, this);
		app.map.on('deleteannotation', this.annotationOperationsCallback, this);
		app.map.on('insertannotation', this.annotationOperationsCallback, this);
		app.map.on('importannotations', this.annotationOperationsCallback, this);
		app.map.on(
			'showannotationschanged',
			this.annotationOperationsCallback,
			this,
		);

	}

	/* everything includes: comments (if toggled on), document */
	private isEverythingStillVisible(zoom: number) {
		const center = app.map.getCenter();
		/* get the dimentions of the new document */
		const pixelBounds = app.map.getPixelBoundsCore(center, zoom);
		const canvasWidth = pixelBounds.max.x + Math.abs(pixelBounds.min.x);

		/*
		 * the `max.X` coordinate is in canvas coordinate terms,
		 * starting from the left, and the `min.X` coordinate is
		 * negative also starting from the left edge. adding these two
		 * gives us the width of the document
		 */
		const docWidth = pixelBounds.max.x + pixelBounds.min.x;

		/* left bound is negative when the point has gone past the left edge */
		if (pixelBounds.min.x > 0)
			return false;

		let commentWidth = this.getCommentAndDocumentSpacingInfo().commentSectionWidth;
		if (this.commentsHiddenOrNotPresent())
			commentWidth = 0;

		return docWidth + commentWidth <= canvasWidth;
	}

	/*
	 * NOTE: this shouldn't be called at startup, atleast not before other
	 * 		 elements are loaded and visible, otherwise this covers the 
	 * 		 canvas and that shows some query errors.
	 */
	private setMaxZoomForAvailableSpace() {
		/*
		 * we start the zoom from 10 (100%) and go up or down
		 * to find the max possible zoom.
		 */
		const MAX_ZOOM_LEVEL = 20;
		const MIN_ZOOM_LEVEL = 1;
		let zoom = 10;

		if (this.isEverythingStillVisible(zoom + 1)) {
			for (let i = zoom + 1; i < MAX_ZOOM_LEVEL; ++i) {
				if (this.isEverythingStillVisible(i))
					zoom = i;
				else
					break;
			}
		} else {
			for (let i = zoom - 1; i > MIN_ZOOM_LEVEL; --i) {
				if (this.isEverythingStillVisible(i))
					zoom = i;
				else
					break;
			}
		}

		app.map.setZoom(zoom, null, true);
		console.error("zoom: " + zoom);
	}

	private getCommentAndDocumentSpacingInfo(): DocumentSpacingInfo {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;

		return {
			documentMarginsWidth: commentSection.calculateAvailableSpace(),
			commentSectionWidth: commentSection.sectionProperties.commentWidth,
		} as DocumentSpacingInfo;
	}

	private documentCanMoveLeft(ignoreDocumentScrollOffset: boolean) {
		const spacingInfo = this.getCommentAndDocumentSpacingInfo();
		const offset = ignoreDocumentScrollOffset ? 0 : this.documentScrollOffset;

		const commentsWiderThanRightMargin =
			spacingInfo.documentMarginsWidth + offset <
			spacingInfo.commentSectionWidth;

		const haveEnoughLeftMarginForMove =
			spacingInfo.commentSectionWidth -
				(spacingInfo.documentMarginsWidth + offset) <=
			spacingInfo.documentMarginsWidth - offset;

		return commentsWiderThanRightMargin && haveEnoughLeftMarginForMove;
	}

	/*
		`cool.CommentSection.shouldCollapse()` doesn't need `documentScrollOffset`
		details to know if it `shouldCollapse` the comments or not.
	*/
	public viewHasEnoughSpaceToShowFullWidthComments() {
		const spacingInfo = this.getCommentAndDocumentSpacingInfo();
		return (
			spacingInfo.documentMarginsWidth * 2 >= spacingInfo.commentSectionWidth
		);
	}

	private documentMoveLeftByOffset(): number {
		const spacingInfo = this.getCommentAndDocumentSpacingInfo();
		return (
			spacingInfo.commentSectionWidth -
			(spacingInfo.documentMarginsWidth + this.documentScrollOffset)
		);
	}

	private recenterDocument() {
		if (this.documentScrollOffset == 0) return;

		this.scrollHorizontal(-this.documentScrollOffset, true);
		this.documentScrollOffset = 0;
		app.sectionContainer.requestReDraw();
	}

	private commentsHiddenOrNotPresent() {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;

		if (
			commentSection.sectionProperties.show != true ||
			commentSection.sectionProperties.commentList.length == 0
		) {
			this.recenterDocument();
			return true;
		}
		return false;
	}

	private unselectSelectedCommentIfAny() {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;

		if (
			commentSection.sectionProperties.selectedComment &&
			!commentSection.sectionProperties.selectedComment.isEdit()
		) {
			commentSection.unselect();
		}
	}

	private adjustDocumentMarginsForComments(onZoomOrResize: boolean) {
		this.unselectSelectedCommentIfAny();

		if (this.commentsHiddenOrNotPresent()) return;

		if (this.documentCanMoveLeft(onZoomOrResize)) {
			if (onZoomOrResize) this.documentScrollOffset = 0;
			this.documentScrollOffset = this.documentMoveLeftByOffset();
			this.scrollHorizontal(this.documentScrollOffset, true);
		}
	}

	private documentZoomOrResizeCallback() {
		this.adjustDocumentMarginsForComments(true);
	}

	private annotationOperationsCallback() {
		this.adjustDocumentMarginsForComments(false);
		this.setMaxZoomForAvailableSpace();
	}
}
