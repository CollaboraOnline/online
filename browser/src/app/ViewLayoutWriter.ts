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
		app.map.on(
			'showannotationschanged',
			this.annotationOperationsCallback,
			this,
		);
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

	private documentCanMoveLeft() {
		const spacingInfo = this.getCommentAndDocumentSpacingInfo();

		const commentsWiderThanRightMargin =
			spacingInfo.documentMarginsWidth + this.documentScrollOffset <
			spacingInfo.commentSectionWidth;

		const haveEnoughLeftMarginForMove =
			spacingInfo.commentSectionWidth -
				(spacingInfo.documentMarginsWidth + this.documentScrollOffset) <
			spacingInfo.documentMarginsWidth - this.documentScrollOffset;

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

	private adjustDocumentMarginsForComments(onZoomOrResize: boolean) {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;

		const cursorAtComment =
			commentSection.sectionProperties.selectedComment &&
			!commentSection.sectionProperties.selectedComment.isEdit();

		if (!onZoomOrResize && cursorAtComment) {
			commentSection.unselect();
		}

		const commentsHiddenOrNotPresent =
			commentSection.sectionProperties.show != true ||
			commentSection.sectionProperties.commentList.length == 0;

		if (commentsHiddenOrNotPresent) {
			this.recenterDocument();
			return;
		}

		if (this.documentCanMoveLeft()) {
			this.documentScrollOffset = this.documentMoveLeftByOffset();
			this.scrollHorizontal(this.documentScrollOffset, true);
		} else if (onZoomOrResize) {
			this.documentScrollOffset = 0;
		}
	}

	private documentZoomOrResizeCallback() {
		this.adjustDocumentMarginsForComments(true);
	}

	private annotationOperationsCallback() {
		this.adjustDocumentMarginsForComments(false);
	}
}
