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

	private readonly labelHeight: number = 20;
	private leftLabel: HTMLSpanElement;
	private rightLabel: HTMLSpanElement;

	constructor() {
		super(
			app.CSections.CompareChangesLabel.name,
			0,
			0,
			new cool.SimplePoint(0, 0),
			'compare-changes-labels',
		);
		this.leftLabel = document.createElement('span');
		this.rightLabel = document.createElement('span');
		this.setupLabels();
	}

	private setupLabels(): void {
		const container = this.getHTMLObject();
		container.style.pointerEvents = 'none';
		container.style.overflow = 'visible';
		// Be on top of the text cursor.
		container.style.zIndex = '1001';

		this.leftLabel.textContent = _('Original');
		this.leftLabel.style.position = 'absolute';
		this.leftLabel.style.height = this.labelHeight + 'px';
		this.leftLabel.style.lineHeight = this.labelHeight + 'px';
		this.leftLabel.style.backgroundColor = '#d63031';
		this.leftLabel.style.color = 'white';
		this.leftLabel.style.fontSize = '12px';
		this.leftLabel.style.paddingLeft = '4px';
		container.appendChild(this.leftLabel);

		this.rightLabel.textContent = _('Current');
		this.rightLabel.style.position = 'absolute';
		this.rightLabel.style.height = this.labelHeight + 'px';
		this.rightLabel.style.lineHeight = this.labelHeight + 'px';
		this.rightLabel.style.backgroundColor = '#00b894';
		this.rightLabel.style.color = 'white';
		this.rightLabel.style.fontSize = '12px';
		this.rightLabel.style.paddingLeft = '4px';
		container.appendChild(this.rightLabel);
	}

	override onDraw(): void {
		this.adjustHTMLObjectPosition();
		const container = this.getHTMLObject();

		if (
			!app.activeDocument ||
			app.activeDocument.activeLayout.type !== 'ViewLayoutCompareChanges'
		) {
			container.style.display = 'none';
			return;
		}

		container.style.display = '';

		const layout = app.activeDocument.activeLayout as ViewLayoutCompareChanges;

		const pageWidth = app.activeDocument.fileSize.pX;

		// Left page label position.
		const part = -1;
		const leftOrigin = new cool.SimplePoint(0, 0, part, TileMode.LeftSide);
		const leftX = layout.documentToViewX(leftOrigin);

		// Right page label position.
		const rightOrigin = new cool.SimplePoint(0, 0, part, TileMode.RightSide);
		const rightX = layout.documentToViewX(rightOrigin);

		this.leftLabel.style.display = '';
		this.leftLabel.style.left = leftX + 'px';
		this.leftLabel.style.top = '0px';
		this.leftLabel.style.width = pageWidth + 'px';

		this.rightLabel.style.display = '';
		this.rightLabel.style.left = rightX + 'px';
		this.rightLabel.style.top = '0px';
		this.rightLabel.style.width = pageWidth + 'px';
	}
}

app.definitions.compareChangesLabelSection = CompareChangesLabelSection;
