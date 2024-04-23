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

	constructor (sectionName: string, objectWidth: number, objectHeight: number, documentPosition: cool.SimplePoint,  extraClass: string = "", visible: boolean = true) {
        super({
			name: "will-be-set-at-initialization", // There may be multiple instances of this class.
			anchor: [],
			position: new Array<number>(0),
			size: new Array<number>(0),
			expand: '',
			showSection: true,
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
		this.sectionProperties.objectDiv.style.width = objectWidth;
		this.sectionProperties.objectDiv.style.height = objectHeight;

		if (extraClass)
			this.sectionProperties.objectDiv.classList.add(extraClass);

		// document-container and canvas overlap entirely. We can append the html object to document-container.
		document.getElementById('document-container').appendChild(this.sectionProperties.objectDiv);

		if (!visible)
			this.sectionProperties.objectDiv.style.display = 'none';
	}

	onInitialize(): void {
		this.setPosition(this.position[0], this.position[1]);
	}

	public setVisibility(value: boolean) {
		this.showSection = value;

		if (!value)
			this.sectionProperties.objectDiv.style.display = 'none';
		else
			this.sectionProperties.objectDiv.style.display = '';
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
		if (this.isVisible) {
			if (this.sectionProperties.objectDiv.style.display !== '')
				this.sectionProperties.objectDiv.style.display = '';
		}
		else
			this.sectionProperties.objectDiv.style.display = 'none';
	}

	public onRemove(): void {
		this.sectionProperties.objectDiv.remove();
	}
}

app.definitions.htmlObjectSection = HTMLObjectSection;
