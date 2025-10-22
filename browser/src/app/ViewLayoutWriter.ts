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

interface DocumentSpacingInfo {
	spaceOnDocumentLeft: number;
	spaceOnDocumentRight: number;
	commentSectionWidth: number;
}

class ViewLayoutWriter extends ViewLayoutBase {
	public readonly type: string = 'ViewLayoutWriter';
	private documentScrollOffset: number = 0;

	constructor() {
		super();
		app.map.on('zoomlevelschange', this.adjustDocumentMarginsForComments, this);
		app.map.on('resize', this.adjustDocumentMarginsForComments, this);
		app.map.on(
			'showannotationschanged',
			this.adjustDocumentMarginsForComments,
			this,
		);
	}

	private getCommentAndDocumentSpacingInfo(): DocumentSpacingInfo {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;

		return {
			spaceOnDocumentRight: commentSection.calculateAvailableSpace(),
			commentSectionWidth: commentSection.sectionProperties.commentWidth,
			spaceOnDocumentLeft: commentSection.calculateAvailableSpace(),
		} as DocumentSpacingInfo;
	}

	public documentCanMoveLeft() {
		const spacingInfo = this.getCommentAndDocumentSpacingInfo();
		return (
			spacingInfo.spaceOnDocumentRight < spacingInfo.commentSectionWidth &&
			spacingInfo.commentSectionWidth - spacingInfo.spaceOnDocumentRight <
				spacingInfo.spaceOnDocumentLeft
		);
	}

	private documentMoveLeftByOffset(): number {
		const spacingInfo = this.getCommentAndDocumentSpacingInfo();
		return spacingInfo.commentSectionWidth - spacingInfo.spaceOnDocumentRight;
	}

	private adjustDocumentMarginsForComments() {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;

		if (commentSection.sectionProperties.show != true) {
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
