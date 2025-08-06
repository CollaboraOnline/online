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

class TextSelectionHandle extends HTMLObjectSection {
	_showSection: boolean = true; // Store the internal show/hide section through forced non-touchscreen hides...
	super_setShowSection: (show: boolean) => void; // HACK: used when dealing with CanvasSectionContainer only having setShowSection via addSectionFunctions

	constructor (sectionName: string, objectWidth: number, objectHeight: number, documentPosition: cool.SimplePoint,  extraClass: string = "", showSection: boolean = false) {
		super(sectionName, objectWidth, objectHeight, documentPosition, extraClass, showSection);
	}

	onInitialize() {
		// HACK: used when dealing with CanvasSectionContainer only having setShowSection via addSectionFunctions
		// we need to rename the property otherwise
		// (1) we will not be able to call it again via super, since as it's not a real superclass function
		// (2) we will not be able to call our own setShowSection as, since as it's set directly on the object, it'll override everything in the prototype...
		this.super_setShowSection = this.setShowSection;
		delete this.setShowSection;
	}

	onDrag(point: number[]) {
		(<any>window).IgnorePanning = true;
		const candidateX = Math.round((this.myTopLeft[0] + point[0]) / app.dpiScale);
		const candidateY = Math.round((this.myTopLeft[1] + point[1]) / app.dpiScale);

		this.sectionProperties.objectDiv.style.left = candidateX + 'px';
		this.sectionProperties.objectDiv.style.top = candidateY + 'px';

		app.map.fire('handleautoscroll', {pos: { x: candidateX, y: candidateY }, map: app.map});
	}

	setShowSection(show: boolean) {
		this._showSection = show;

		if (!window.touch.currentlyUsingTouchscreen()) {
			this.super_setShowSection(false);
		} else {
			this.super_setShowSection(this._showSection);
		}
	}

	setOpacity(value: number) {
		this.getHTMLObject().style.opacity = value;
	}

	onDragEnd(point: number[]) {
		(<any>window).IgnorePanning = undefined;

		let x = this.position[0] + point[0];
		const y = this.position[1] + point[1];
		this.setPosition(x, y);

		app.map.fire('scrollvelocity', {vx: 0, vy: 0});
		const type = this.name === 'selection_start_handle' ? 'start' : 'end';

		if (type === 'start')
			x += 30 / app.dpiScale;

		if (!app.map._docLayer.isCalcRTL()) {
			app.map._docLayer._postSelectTextEvent(type, Math.round(x * app.pixelsToTwips), Math.round(y * app.pixelsToTwips));
		}
		else {
			const referenceX = app.file.viewedRectangle.pX1 + (app.file.viewedRectangle.pX2 - this.position[0]);
			app.map._docLayer._postSelectTextEvent(type, Math.round(referenceX * app.pixelsToTwips), Math.round(y * app.pixelsToTwips));
		}
	}

	onMouseMove(point: number[], dragDistance: number[], e: MouseEvent): void {
		e.stopPropagation();
		if (this.containerObject.isDraggingSomething()) {
			this.stopPropagating();
			this.onDrag(point);
		}
	}

	onDocumentObjectVisibilityChange(): void {
		if (this.showSection && this.isVisible)
			this.sectionProperties.objectDiv.style.display = '';
		else
			this.sectionProperties.objectDiv.style.display = 'none';
	}

	onClick(point: number[], e: MouseEvent): void {
		e.stopPropagation();
		this.stopPropagating();
	}

	onMouseDown(point: number[], e: MouseEvent): void {
		e.stopPropagation();
		this.stopPropagating();
	}

	onMouseUp(point: number[], e: MouseEvent): void {
		e.stopPropagation();
		if (this.containerObject.isDraggingSomething()) {
			this.stopPropagating();
			this.onDragEnd(point);
		}
	}
}
