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

/*
 * CompareChangesLabelSection - draws "Original" and "Current" labels above
 * the left and right pages in the compare changes view.
 */

class CompareChangesLabelSection extends HTMLObjectSection {
	processingOrder: number = app.CSections.CompareChangesLabel.processingOrder;
	drawingOrder: number = app.CSections.CompareChangesLabel.drawingOrder;
	zIndex: number = app.CSections.CompareChangesLabel.zIndex;
	documentObject: boolean = false;
	interactable: boolean = false;
	boundToSection: string = 'tiles';
	anchor: string[] = ['top', 'left'];

	private readonly labelHeight: number = 32;

	// Left and right labels, a title & optional subtitle inside each.
	private leftLabel: HTMLDivElement;
	private leftTitle: HTMLDivElement;
	private leftSubtitle: HTMLDivElement;
	private rightLabel: HTMLDivElement;
	private rightTitle: HTMLDivElement;
	private rightSubtitle: HTMLDivElement;

	constructor() {
		super(
			app.CSections.CompareChangesLabel.name,
			0,
			0,
			new cool.SimplePoint(0, 0),
			'compare-changes-labels',
		);
		this.leftLabel = document.createElement('div');
		this.leftTitle = document.createElement('div');
		this.leftSubtitle = document.createElement('div');
		this.rightLabel = document.createElement('div');
		this.rightTitle = document.createElement('div');
		this.rightSubtitle = document.createElement('div');
		this.setupLabels();
	}

	private setupLabels(): void {
		const container = this.getHTMLObject();
		container.style.pointerEvents = 'none';
		container.style.overflow = 'visible';
		// Be on top of the text cursor.
		container.style.zIndex = '1001';

		this.leftLabel.style.position = 'absolute';
		this.leftLabel.style.height = this.labelHeight + 'px';
		this.leftLabel.style.backgroundColor = '#d63031';
		this.leftLabel.style.color = 'white';
		this.leftLabel.style.textAlign = 'center';
		this.leftTitle.style.fontSize = '16px';
		this.leftTitle.style.lineHeight = '16px';
		this.leftSubtitle.style.fontSize = '12px';
		this.leftSubtitle.style.lineHeight = '16px';
		this.leftLabel.appendChild(this.leftTitle);
		this.leftLabel.appendChild(this.leftSubtitle);
		container.appendChild(this.leftLabel);

		this.rightLabel.style.position = 'absolute';
		this.rightLabel.style.height = this.labelHeight + 'px';
		this.rightLabel.style.backgroundColor = '#00b894';
		this.rightLabel.style.color = 'white';
		this.rightLabel.style.textAlign = 'center';
		this.rightTitle.style.fontSize = '16px';
		this.rightTitle.style.lineHeight = '16px';
		this.rightSubtitle.style.fontSize = '12px';
		this.rightSubtitle.style.lineHeight = '16px';
		this.rightLabel.appendChild(this.rightTitle);
		this.rightLabel.appendChild(this.rightSubtitle);
		container.appendChild(this.rightLabel);
	}

	private updateSubtitle(
		element: HTMLDivElement,
		info: DocumentMetadata,
	): void {
		const locale = String.locale;
		const dateOptions: Intl.DateTimeFormatOptions = {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		};
		const date = new Date(info.modificationDate).toLocaleDateString(
			locale,
			dateOptions,
		);
		element.textContent = _('Last edited by %1 on %2')
			.replace('%1', info.modifiedBy)
			.replace('%2', date);
	}

	override onDraw(): void {
		const container = this.getHTMLObject();

		if (
			!app.activeDocument ||
			app.activeDocument.activeLayout.type !== 'ViewLayoutCompareChanges'
		) {
			container.style.display = 'none';
			return;
		}

		this.adjustHTMLObjectPosition();
		container.style.display = '';

		const layout = app.activeDocument.activeLayout as ViewLayoutCompareChanges;

		// Use page rectangle to get actual page position and width (in twips).
		const pageRects = app.file.writer.pageRectangleList;
		if (!pageRects || pageRects.length === 0) {
			container.style.display = 'none';
			return;
		}
		const firstPage = pageRects[0];
		// firstPage has its dimensions as x, y, w, h; in twips.
		const pageX = firstPage[0];
		const pageY = firstPage[1];
		const pageWidth = Math.round(firstPage[2] * app.twipsToPixels);

		// Left page label position.
		const part = -1;
		const leftOrigin = new cool.SimplePoint(
			pageX,
			pageY,
			part,
			TileMode.LeftSide,
		);
		const leftX = layout.documentToViewX(leftOrigin);
		const topY = layout.documentToViewY(leftOrigin) - this.labelHeight;

		// Right page label position.
		const rightOrigin = new cool.SimplePoint(
			pageX,
			pageY,
			part,
			TileMode.RightSide,
		);
		const rightX = layout.documentToViewX(rightOrigin);

		const docName =
			(document.getElementById('document-name-input') as HTMLInputElement)
				?.value || '';
		this.leftTitle.textContent = _('%1: Initial Version').replace(
			'%1',
			docName,
		);
		this.rightTitle.textContent = _('%1: Current Version').replace(
			'%1',
			docName,
		);

		const props = app.writer.compareDocumentProperties;
		if (props) {
			this.updateSubtitle(this.leftSubtitle, props.metadata.otherDocument);
			this.updateSubtitle(this.rightSubtitle, props.metadata.thisDocument);
		}

		this.leftLabel.style.display = '';
		this.leftLabel.style.left = leftX + 'px';
		this.leftLabel.style.top = topY + 'px';
		this.leftLabel.style.width = pageWidth + 'px';

		this.rightLabel.style.display = '';
		this.rightLabel.style.left = rightX + 'px';
		this.rightLabel.style.top = topY + 'px';
		this.rightLabel.style.width = pageWidth + 'px';
	}
}

app.definitions.compareChangesLabelSection = CompareChangesLabelSection;
