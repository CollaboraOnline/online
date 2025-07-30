// @ts-strict-ignore
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

// This class will be used internally by CanvasSectionContainer.
class CanvasSectionObject {
	context: CanvasRenderingContext2D;
	myTopLeft: Array<number> = [0, 0];
	documentTopLeft: Array<number> = [0, 0]; // Document top left will be updated by container.
	containerObject: CanvasSectionContainer = null;
	name: string = null;
	backgroundColor: string = null; // Default is null (container's background color will be used).
	backgroundOpacity: number = 1; // Valid when backgroundColor is valid.
	borderColor: string = null; // Default is null (no borders).
	boundToSection: string = null;
	anchor: Array<string> | Array<Array<string>> = [];
	documentObject: boolean; // If true, the section is a document object.
	// When section is a document object, its position should be the real position inside the document, in core pixels.
	isVisible: boolean = false; // Is section visible on the viewed area of the document? This property is valid for document objects. This is managed by the section container.
	showSection: boolean = true; // Show / hide section.
	position: Array<number> = [0, 0];
	isCollapsed: boolean;
	size: Array<number> = [0, 0];
	origSizeHint: undefined | Array<number>; // This is used to preserve the original size provided on construct.
	expand: Array<string> = [];
	isLocated: boolean; // Location and size of the section computed yet?
	processingOrder: number;
	drawingOrder: number;
	zIndex: number;
	interactable: boolean = true;
	isAnimating: boolean = false;
	windowSection: boolean = false;
	sectionProperties: any = {};
	boundsList: Array<CanvasSectionObject> = []; // The sections those this section can propagate events to. Updated by container.

	onInitialize(): void { return; }
	onCursorPositionChanged(newPosition: cool.SimpleRectangle): void { return; }
	onCellAddressChanged(): void { return; }
	onMouseMove(point: cool.SimplePoint, dragDistance: Array<number>, e: MouseEvent): void { return; }
	onMouseDown(point: cool.SimplePoint, e: MouseEvent): void { return; }
	onMouseUp(point: cool.SimplePoint, e: MouseEvent): void { return; }

	setShowSection(show: boolean): void {
		this.showSection = show;

		if (this.onSectionShowStatusChange)
			this.onSectionShowStatusChange();

		if (this.containerObject) { // Is section added to container.
			this.isVisible = this.containerObject.isDocumentObjectVisible(this);
			this.onDocumentObjectVisibilityChange();
		}

		if (this.containerObject.testing) {
			this.containerObject.createUpdateSingleDivElement(this);
		}
	}

	onSectionShowStatusChange(): void { return; } /// Called when setShowSection is called.

	isSectionShown(): boolean {
		return this.showSection;
	}

	onDocumentObjectVisibilityChange(): void { return; }
	onMouseEnter(point: cool.SimplePoint, e: MouseEvent): void { return; }
	onMouseLeave(point: cool.SimplePoint, e: MouseEvent): void { return; }
	onClick(point: cool.SimplePoint, e: MouseEvent): void { return; }
	onDoubleClick(point: cool.SimplePoint, e: MouseEvent): void { return; }
	onContextMenu(e?: MouseEvent): void { return; }
	onMouseWheel(point: cool.SimplePoint, delta: Array<number>, e: WheelEvent): void { return; }
	onMultiTouchStart(e: TouchEvent): void { return; }
	onMultiTouchMove(point: cool.SimplePoint, dragDistance: number, e: TouchEvent): void { return; }
	onMultiTouchEnd(e: TouchEvent): void { return; }
	onResize(): void { return; }
	onDraw(frameCount?: number, elapsedTime?: number): void { return; }
	onUpdateDOM(): void { return; } // Called before onDraw, to update the DOM if required.
	onDrawArea(area?: cool.Bounds, paneTopLeft?: cool.Point, canvasContext?: CanvasRenderingContext2D): void { return; } // area is the area to be painted using canvasContext.
	onAnimate(frameCount: number, elapsedTime: number): void { return; }
	onAnimationEnded(frameCount: number, elapsedTime: number): void { return; } // frameCount, elapsedTime. Sections that will use animation, have to have this function defined.
	onNewDocumentTopLeft(size: Array<number>): void { return; }
	onRemove(): void { return; } // This Function is called right before section is removed.

	setDrawingOrder(drawingOrder: number): void {
		this.drawingOrder = drawingOrder;
		this.containerObject.updateBoundSectionLists();
		this.containerObject.reNewAllSections();
	}

	setZIndex(zIndex: number): void {
		this.zIndex = zIndex;
		this.containerObject.updateBoundSectionLists();
		this.containerObject.reNewAllSections();
	}

	bindToSection(sectionName: string): void {
		this.boundToSection = sectionName;
		this.containerObject.updateBoundSectionLists();
		this.containerObject.reNewAllSections();
	}

	stopPropagating(): void {
		this.containerObject.lowestPropagatedBoundSection = this.name;
	}

	startAnimating(options: any): boolean {
		return this.containerObject.startAnimating(this.name, options);
	}

	resetAnimation(): void {
		this.containerObject.resetAnimation(this.name);
	}

	getTestDiv(): HTMLDivElement {
		var element: HTMLDivElement = <HTMLDivElement>document.getElementById('test-div-' + this.name);
		if (element)
			return element;

		return null;
	}

	// Document objects only.
	setPosition(x: number, y: number): void {
		if (this.documentObject !== true || !this.containerObject)
			return;

		x = Math.round(x);
		y = Math.round(y);
		let sectionXcoord = x;
		const positionAddition = this.containerObject.getDocumentTopLeft();

		if (this.isCalcRTL()) {
			// the document coordinates are not always in sync(fixing that is non-trivial!), so use the latest from map.
			const docLayer = this.sectionProperties.docLayer;
			const docSize = docLayer._map.getPixelBoundsCore().getSize();
			sectionXcoord = docSize.x - sectionXcoord - this.size[0];
		}

		if (app.isXOrdinateInFrozenPane(sectionXcoord))
			positionAddition[0] = 0;

		if (app.isYOrdinateInFrozenPane(y))
			positionAddition[1] = 0;

		this.myTopLeft[0] = this.containerObject.getDocumentAnchor()[0] + sectionXcoord - positionAddition[0];
		this.myTopLeft[1] = this.containerObject.getDocumentAnchor()[1] + y - positionAddition[1];

		this.position[0] = sectionXcoord;
		this.position[1] = y;
		const isVisible = this.containerObject.isDocumentObjectVisible(this);
		if (isVisible !== this.isVisible) {
			this.isVisible = isVisible;
			this.onDocumentObjectVisibilityChange();
		}

		if (this.containerObject.testing)
			this.containerObject.createUpdateSingleDivElement(this);
	}

	// All below functions should be included in their respective section definitions (or other classes), not here.
	isCalcRTL(): boolean { return; }
	setViewResolved(on: boolean): void { return; }
	setView(on: boolean): void { return; }
	scrollVerticalWithOffset(offset: number): void { return; }
	remove(id: string): void { return; }
	deleteThis(): void { return; }
	getActiveEdit(): any { return; }
	isMobileCommentActive(): boolean { return false; }
	getMobileCommentModalId(): string { return ''; }
	rejectAllTrackedCommentChanges(): void { return; }
	removeHighlighters(): void { return; }
	showUsernamePopUp(): void { return; }
	_selectColumn (colNumber: number, modifier: number): void { return; }
	_selectRow (row: number, modifier: number): void { return; }
	insertColumnBefore (index: number): void { return; }
	insertRowAbove (index: number): void { return; }
	deleteColumn (index: number): void { return; }
	deleteRow (index: number): void { return; }
	resetStrokeStyle(): void { return; }
	hasAnyComments(): boolean { return false; }

	public getLineWidth(): number {
		if (app.dpiScale > 1.0) {
			return app.roundedDpiScale;
		} else {
			return app.dpiScale;
		}
	}

	public getLineOffset(): number {
		if (app.dpiScale > 1.0) {
			return app.roundedDpiScale % 2 === 0 ? 0 : 0.5;
		} else {
			return 0.5;
		}
	}
}
