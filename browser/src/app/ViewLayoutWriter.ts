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

		const compareButton = document.getElementById('compare-view-button');
		if (compareButton) {
			compareButton.onclick = function() {
				app.socket.sendMessage('uno .uno:RedlineRenderMode');
			};
		}
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
	}
}
