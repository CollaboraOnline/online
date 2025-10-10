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

class ViewLayoutWriter extends ViewLayoutBase {
	public readonly type: string = 'ViewLayoutWriter';
	public map: any;

	constructor() {
		super();
		this.map = window.L.Map.THIS;

		// Question: why doesn't scroll offset setting work when zoom event
		// is fired?
		this.map.on(
			'zoomend',
			function () {
				// const commentSection = app.sectionContainer.getSectionWithName(app.CSections.CommentList.name) as cool.CommentSection;
				// commentSection.setMovedDocumentByOffset(0); // reset the old margin calculation
				// if (commentSection && commentSection.needSomeOfThatLeftSpace()) {
				// 	(app.activeDocument.activeView as ViewLayoutWriter).scroll(commentSection.needThisMuchOfThatLeftSpace(), 0);
				// }
			},
			this,
		);
	}

	public canScrollHorizontal(documentAnchor: CanvasSectionObject): boolean {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;
		return (
			this.viewSize.pX > documentAnchor.size[0] ||
			commentSection.needSomeOfThatLeftSpace()
		);
	}

	private adjustDocumentMarginsForComments() {
		const commentSection = app.sectionContainer.getSectionWithName(
			app.CSections.CommentList.name,
		) as cool.CommentSection;

		if (commentSection.needSomeOfThatLeftSpace()) {
			this.scrollHorizontal(commentSection.needThisMuchOfThatLeftSpace());
			commentSection.setMovedDocumentByOffset(
				commentSection.needThisMuchOfThatLeftSpace(),
			);
		}
	}

	public scroll(pX: number, pY: number): void {
		this.adjustDocumentMarginsForComments();
		super.scroll(pX, pY);
	}
}
