/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class ChartContextButtonSection extends HTMLObjectSection {
	//static readonly namePrefix: string = 'ChartContextButton_';
	static readonly namePrefix: string = 'TableInsertMarker_';

	constructor(
		//name: string,
		//objectWidth: number,
		//objectHeight: number,
		//documentPosition: cool.SimplePoint,
		//extraClass: string,
		buttonType: number,
		//showSection: boolean = true,
	) {
		super(
			//ChartContextButtonSection.namePrefix + buttonType,
			ChartContextButtonSection.namePrefix,
			32,
			32,
			new cool.SimplePoint(100, buttonType * 32),
			'table-add-col-row-marker',
			true,
		);
		this.reposChartContextToolbar();

		this.sectionProperties.buttonType = buttonType;
	}

	public onMouseEnter(point: cool.SimplePoint, e: MouseEvent): void {
		this.getHTMLObject()?.classList.add('hovered');
	}

	public onMouseLeave(point: cool.SimplePoint, e: MouseEvent): void {
		this.getHTMLObject()?.classList.remove('hovered');
	}

	public onMouseDown(point: cool.SimplePoint, e: MouseEvent): void {
		this.stopEvents(e);
	}

	public onMouseUp(point: cool.SimplePoint, e: MouseEvent): void {
		this.stopEvents(e);
	}

	private stopEvents(e: MouseEvent) {
		this.stopPropagating();

		// We shouldn't need below 2 when we remove map element.
		e.preventDefault();
		e.stopImmediatePropagation();
	}

	public onClick(point: cool.SimplePoint, e: MouseEvent): void {
		if (this.sectionProperties.buttonType === 'column') {
			app.socket.sendMessage('uno .uno:InsertColumnsAfter');
		} else {
			app.socket.sendMessage('uno .uno:InsertRowsAfter');
		}
	}

	showChartContextToolbar(): void {
		//this.registerMessageHandlers();
		//this.changeOpacity(1);
		this.showHideToolbar(true);
	}

	hideChartContextToolbar(): void {
		//this.registerMessageHandlers();
		this.showHideToolbar(false);
	}

	reposChartContextToolbar(): void {
		if (!GraphicSelection || !GraphicSelection.hasActiveSelection()) return;
		const pos = this.calcPosition();
		this.getHTMLObject().style.left = pos.x + 'px';
		this.getHTMLObject().style.top = pos.y + 'px';
	}

	private calcPosition(): { x: number; y: number } {
		const pos = {
			x: GraphicSelection.rectangle.pX2,
			y: GraphicSelection.rectangle.pY1,
		};
		pos.x -=
			(app.activeDocument.activeView.viewedRectangle.pX1 -
				app.sectionContainer.getDocumentAnchor()[0]) /
				app.dpiScale -
			app.sectionContainer.getCanvasBoundingClientRect().x;
		pos.y -=
			(app.activeDocument.activeView.viewedRectangle.pY1 -
				app.sectionContainer.getDocumentAnchor()[1]) /
				app.dpiScale -
			app.sectionContainer.getCanvasBoundingClientRect().y;

		pos.y += this.sectionProperties.buttonType * 32;
		return pos;
	}

	private showHideToolbar(show: boolean): void {
		app.layoutingService.appendLayoutingTask(() => {
			if (!show) {
				this.getHTMLObject()?.classList.add('hidden');
				//window.L.DomUtil.addClass(this.container, 'hidden');
				this.showSection = false;
				return;
			}

			if (!GraphicSelection || !GraphicSelection.hasActiveSelection()) return;
			const pos = this.calcPosition();
			this.getHTMLObject().style.left = pos.x + 'px';
			this.getHTMLObject().style.top = pos.y + 'px';
			this.getHTMLObject()?.classList.remove('hidden');
			//window.L.DomUtil.removeClass(this.container, 'hidden');
			this.showSection = true;
		});
	}
	/*
	setLastInputEventType(e: any) {
		this.lastIinputEvent = e;
		if (e.type === 'buttonup' && e.input === 'mouse' && this.pendingShow) {
			this.showChartContextToolbarImpl();
			this.pendingShow = false;
		}
	}
*/
	//changeOpacity(opacity: number) {
	//	this.container.style.opacity = opacity.toString();
	//}

	/*---2. try ... ---*/
	/*
	//constructor(type: 'select' | 'save', documentPosition: cool.SimplePoint) {
	constructor(type: number) {
		super(
			ChartContextButtonSection.namePrefix + type,
			32,
			32,
			//documentPosition,
			new cool.SimplePoint(100, type * 32),
			'table-add-col-row-marker',
			true,
		);

		this.sectionProperties.buttonType = type;
		this.sectionProperties.mouseEntered = false;

		const div = this.getHTMLObject();
		div.classList.add('table-add-col-row-marker');
	}

	public onMouseEnter() {
		this.sectionProperties.mouseEntered = true;
		this.getHTMLObject()?.classList.add('hovered');
	}

	public onMouseLeave() {
		this.sectionProperties.mouseEntered = false;
		this.getHTMLObject()?.classList.remove('hovered');
	}

	public onMouseDown(point: cool.SimplePoint, e: MouseEvent): void {
		e.preventDefault();
		this.stopPropagating();
		e.stopPropagation();
	}

	public onClick(point: cool.SimplePoint, e: MouseEvent): void {
		e.preventDefault();
		this.stopPropagating();
		e.stopPropagation();

		this.handleClick();
	}

	public getButtonType(): string {
		return this.sectionProperties.buttonType;
	}

	public setButtonSize(width: number, height: number): void {
		this.size = [width, height];
		const container = this.getHTMLObject();
		if (container) {
			container.style.width = `${width}px`;
			container.style.height = `${height}px`;
		}
	}

	private handleClick(): void {
		if (this.sectionProperties.buttonType === 0) {//'select') {
			app.socket.sendMessage('uno .uno:InsertColumnsAfter');
		} else {
			app.socket.sendMessage('uno .uno:InsertRowsAfter');
		}
	}
	*/
}
