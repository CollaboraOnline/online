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
		app.map.on('zoomlevelschange', this.adjustDocumentMarginsForComments, this);
		app.map.on('resize', this.adjustDocumentMarginsForComments, this);
		app.map.on('deleteannotation', this.adjustDocumentMarginsForComments, this);
		app.map.on(
			'showannotationschanged',
			this.adjustDocumentMarginsOnAnnotationToggle,
			this,
		);
	}

	private adjustDocumentMarginsOnAnnotationToggle() {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;

		if (
			commentSection.sectionProperties.selectedComment &&
			!commentSection.sectionProperties.selectedComment.isEdit()
		) {
			commentSection.unselect();
		}
		this.adjustDocumentMarginsForComments();
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

	public documentCanMoveLeft() {
		const spacingInfo = this.getCommentAndDocumentSpacingInfo();
		return (
			spacingInfo.documentMarginsWidth < spacingInfo.commentSectionWidth &&
			spacingInfo.commentSectionWidth - spacingInfo.documentMarginsWidth <
				spacingInfo.documentMarginsWidth
		);
	}

	private documentMoveLeftByOffset(): number {
		const spacingInfo = this.getCommentAndDocumentSpacingInfo();
		return spacingInfo.commentSectionWidth - spacingInfo.documentMarginsWidth;
	}

	private adjustDocumentMarginsForComments() {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;

		if (
			commentSection.sectionProperties.show != true ||
			commentSection.sectionProperties.commentList.length == 0
		) {
			if (this.documentScrollOffset == 0) return;
			this.scrollHorizontal(-this.documentScrollOffset, true);
			this.documentScrollOffset = 0;
			app.sectionContainer.requestReDraw();
			return;
		}

		if (this.documentCanMoveLeft()) {
			this.documentScrollOffset = this.documentMoveLeftByOffset();
			this.scrollHorizontal(this.documentScrollOffset, true);
		} else {
			this.documentScrollOffset = 0;
		}
	}
}
