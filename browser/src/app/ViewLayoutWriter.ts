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

	constructor() {
		super();
		app.map.on('zoomlevelschange', this.adjustDocumentMarginsForComments, this);
		app.map.on('resize', this.adjustDocumentMarginsForComments, this);

		/*
			WARN: this event hasn't been tested yet because there's a bug
			in writer comments code. when i hide the comments and scroll down,
			the comments show up again. this happens on latest master. i will
			quickly investigate and fix that first and then test this.

			this probably wouldn't work as the comment width is a constant,
			maybe a conditional which checks if comments are on or off and
			resets the offset if disabled, yes that would work.
		*/
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
			spaceOnDocumentLeft:
				((commentSection.containerObject.getDocumentAnchorSection().size[0] -
					app.activeDocument.fileSize.pX) *
					0.5) /
				app.dpiScale,
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
		if (this.documentCanMoveLeft())
			this.scrollHorizontal(this.documentMoveLeftByOffset(), true);
	}
}
