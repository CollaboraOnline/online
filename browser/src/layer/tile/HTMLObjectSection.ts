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

	constructor (sectionName: string, objectWidth: number, objectHeight: number, documentPosition: cool.SimplePoint,  extraClass: string = "", showSection: boolean = true) {
        super({
			name: "will-be-set-at-initialization", // There may be multiple instances of this class.
			anchor: [],
			position: new Array<number>(0),
			size: new Array<number>(0),
			expand: '',
			showSection: showSection,
			processingOrder: L.CSections.HTMLObject.processingOrder,
			drawingOrder: L.CSections.HTMLObject.drawingOrder,
			zIndex: L.CSections.HTMLObject.zIndex,
			interactable: true,
			sectionProperties: {},
		});

		this.documentObject = true;

		this.myTopLeft = [0, 0];
		this.name = sectionName;
		this.size = [objectWidth * app.dpiScale, objectHeight * app.dpiScale];
		this.position = [documentPosition.pX, documentPosition.pY];
		this.sectionProperties.objectWidth = objectWidth;
		this.sectionProperties.objectHeight = objectHeight;
		this.sectionProperties.objectDiv = document.createElement('div');
		this.sectionProperties.objectDiv.className = 'html-object-section';
		this.sectionProperties.objectDiv.style.width = objectWidth + 'px';
		this.sectionProperties.objectDiv.style.height = objectHeight + 'px';

		if (extraClass)
			this.sectionProperties.objectDiv.classList.add(extraClass);

		// canvas-container and canvas overlap entirely. We can append the html object to canvas-container.
		const tempFunction = function(elementToAdd: any) {
			const container = document.getElementById('canvas-container');
			if (container) {
				container.appendChild(elementToAdd);
			}
			else {
				setTimeout(() => {
					tempFunction(elementToAdd);
				}, 100);
			}
		};
		tempFunction(this.sectionProperties.objectDiv);

		if (!showSection)
			this.sectionProperties.objectDiv.style.display = 'none';
	}

	onInitialize(): void {
		this.setPosition(this.position[0], this.position[1]);
	}

	public onSectionShowStatusChange(): void {
		if (this.showSection)
			this.sectionProperties.objectDiv.style.display = '';
		else
			this.sectionProperties.objectDiv.style.display = 'none';
	}

	public onDraw() {
		if (this.sectionProperties.objectDiv.style.left !== Math.round(this.myTopLeft[0] / app.dpiScale) + 'px')
			this.sectionProperties.objectDiv.style.left = Math.round(this.myTopLeft[0] / app.dpiScale) + 'px';

		if (this.sectionProperties.objectDiv.style.top !== Math.round(this.myTopLeft[1] / app.dpiScale) + 'px')
			this.sectionProperties.objectDiv.style.top = Math.round(this.myTopLeft[1] / app.dpiScale) + 'px';
	}

	public getHTMLObject() {
		return this.sectionProperties.objectDiv;
	}

	public onNewDocumentTopLeft(): void {
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

app.definitions.htmlObjectSection = HTMLObjectSection;
