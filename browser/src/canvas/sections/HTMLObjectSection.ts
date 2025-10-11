// @ts-strict-ignore
/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

class HTMLObjectSection extends CanvasSectionObject {
	processingOrder: number = app.CSections.HTMLObject.processingOrder;
	drawingOrder: number = app.CSections.HTMLObject.drawingOrder;
	zIndex: number = app.CSections.HTMLObject.zIndex;
	documentObject: boolean = true;

	constructor (sectionName: string, objectWidth: number, objectHeight: number, documentPosition: cool.SimplePoint, extraClass: string = "", showSection: boolean = true) {
        super(sectionName);

		this.size = [objectWidth * app.dpiScale, objectHeight * app.dpiScale];
		this.position = [documentPosition.pX, documentPosition.pY];
		this.sectionProperties.objectWidth = objectWidth;
		this.sectionProperties.objectHeight = objectHeight;
		this.sectionProperties.objectDiv = document.createElement('div');
		this.sectionProperties.objectDiv.className = 'html-object-section';

		if (objectWidth === null) this.sectionProperties.objectDiv.style.width = 'auto';
		else this.sectionProperties.objectDiv.style.width = objectWidth + 'px';

		if (objectHeight === null) this.sectionProperties.objectDiv.style.height = 'auto';
		else this.sectionProperties.objectDiv.style.height = objectHeight + 'px';

		if (extraClass)
			this.sectionProperties.objectDiv.className += ' ' + extraClass;

		// canvas-container and canvas overlap entirely. We can append the html object to canvas-container.
		document.getElementById('canvas-container').appendChild(this.sectionProperties.objectDiv);

		if (!showSection) {
			this.sectionProperties.objectDiv.style.display = 'none';
			this.showSection = false;
		}
	}

	onInitialize(): void {
		this.setPosition(this.position[0], this.position[1]);
		this.adjustHTMLObjectPosition();
	}

	public onSectionShowStatusChange(): void {
		if (this.showSection)
			this.sectionProperties.objectDiv.style.display = '';
		else
			this.sectionProperties.objectDiv.style.display = 'none';
	}

	adjustHTMLObjectPosition() {
		let leftAddition = 0;
		let topAddition = 0;

		if (this.sectionProperties.objectDiv.parentNode && this.sectionProperties.objectDiv.parentNode.id === 'map') {
			const clientRectMap = document.getElementById('map').getBoundingClientRect();
			const clientRectCanvas = document.getElementById('canvas-container').getBoundingClientRect();

			leftAddition = clientRectMap.width - clientRectCanvas.width;
			topAddition = clientRectMap.height - clientRectCanvas.height;
		}

		const left = Math.round((this.myTopLeft[0] + leftAddition) / app.dpiScale) + 'px';
		const top = Math.round((this.myTopLeft[1] + topAddition) / app.dpiScale) + 'px';

		if (this.sectionProperties.objectDiv.style.left !== left)
			this.sectionProperties.objectDiv.style.left = left;

		if (this.sectionProperties.objectDiv.style.top !== top)
			this.sectionProperties.objectDiv.style.top = top;
	}

	onDraw(frameCount?: number, elapsedTime?: number): void {
		this.adjustHTMLObjectPosition();
	}

	public getHTMLObject() {
		return this.sectionProperties.objectDiv;
	}

	public onNewDocumentTopLeft(): void {
		this.adjustHTMLObjectPosition();

		if (this.isVisible && this.isSectionShown()) {
			if (this.sectionProperties.objectDiv.style.display !== '')
				this.sectionProperties.objectDiv.style.display = '';
		}
		else
			this.sectionProperties.objectDiv.style.display = 'none';
	}

	public getPosition(): cool.SimplePoint {
		const twips = [Math.round(this.position[0] * app.pixelsToTwips), Math.round(this.position[1] * app.pixelsToTwips)];
		return new cool.SimplePoint(twips[0], twips[1]);
	}

	public onRemove(): void {
		this.sectionProperties.objectDiv.remove();
	}
}
