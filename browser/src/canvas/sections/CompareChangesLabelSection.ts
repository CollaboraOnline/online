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

		this.setupLabel(
			container,
			this.leftLabel,
			this.leftTitle,
			this.leftSubtitle,
			'#d63031',
		);
		this.setupLabel(
			container,
			this.rightLabel,
			this.rightTitle,
			this.rightSubtitle,
			'#00b894',
		);
	}

	private setupLabel(
		container: HTMLDivElement,
		label: HTMLDivElement,
		title: HTMLDivElement,
		subtitle: HTMLDivElement,
		backgroundColor: string,
	): void {
		label.style.position = 'absolute';
		label.style.height = this.labelHeight + 'px';
		label.style.backgroundColor = backgroundColor;
		label.style.color = 'white';
		label.style.textAlign = 'center';
		title.style.fontSize = '16px';
		title.style.lineHeight = '16px';
		subtitle.style.fontSize = '12px';
		subtitle.style.lineHeight = '16px';
		label.appendChild(title);
		label.appendChild(subtitle);
		container.appendChild(label);
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

		const props = app.writer.compareDocumentProperties;
		if (props) {
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
			this.updateSubtitle(this.leftSubtitle, props.metadata.otherDocument);
			this.updateSubtitle(this.rightSubtitle, props.metadata.thisDocument);
			this.leftSubtitle.style.display = '';
			this.rightSubtitle.style.display = '';
		} else {
			this.leftTitle.textContent = _('Initial Version');
			this.rightTitle.textContent = _('Current Version');
			this.leftSubtitle.style.display = 'none';
			this.rightSubtitle.style.display = 'none';
		}

		// We only have a subtitle right after comparing; so if we don't have a subtitle,
		// center the title vertically.
		const titleHeight = props ? this.labelHeight / 2 : this.labelHeight;
		this.leftTitle.style.lineHeight = titleHeight + 'px';
		this.rightTitle.style.lineHeight = titleHeight + 'px';

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
