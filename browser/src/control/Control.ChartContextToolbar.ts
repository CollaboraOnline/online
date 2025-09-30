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
 * L.control.ChartContextToolbar - definition of chart context toolbar
 * This toolbar should appear when a chart is selected
 */

class ChartContextToolbar {
	container: HTMLElement;
	builder: JSBuilder;
	map: any;
	initialized: boolean = false;
	lastIinputEvent?: any = {};
	pendingShow: boolean = false;
	shown: boolean = false;

	constructor(map: any) {
		this.map = map;
		this.builder = new window.L.control.notebookbarBuilder({
			windowId: -2,
			//mobileWizard: this,
			map: this.map,
			cssClass: 'notebookbar',
			suffix: 'context-toolbar',
		} as JSBuilderOptions);

		this.container = window.L.DomUtil.createWithId(
			'div',
			'context-toolbar',
			document.body,
		);
		window.L.DomUtil.addClass(this.container, 'notebookbar horizontal chart');
	}

	showChartContextToolbar(): void {
		if (this.lastIinputEvent.input === 'mouse') this.pendingShow = true;
		if (this.lastIinputEvent.type !== 'buttonup') return;

		this.showChartContextToolbarImpl();
	}

	showChartContextToolbarImpl(): void {
		this.pendingShow = false;
		if (!this.initialized) {
			this.builder.build(this.container, this.getWriterTextContext(), false);
			this.initialized = true;
		}

		this.builder.map.on('jsdialogaction', this.onJSAction, this);
		this.builder.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.changeOpacity(1);
		this.showHideToolbar(true);
	}

	hideChartContextToolbar(): void {
		this.builder.map.off('jsdialogaction', this.onJSAction, this);
		this.builder.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.showHideToolbar(false);
	}

	reposChartContextToolbar(): void {
		if (!GraphicSelection || !GraphicSelection.hasActiveSelection()) return;
		const pos = this.calcPosition();
		this.container.style.left = pos.x + 'px';
		this.container.style.top = pos.y + 'px';
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

		return pos;
	}

	private showHideToolbar(show: boolean): void {
		app.layoutingService.appendLayoutingTask(() => {
			if (!show) {
				window.L.DomUtil.addClass(this.container, 'hidden');
				this.shown = false;
				return;
			}

			if (!GraphicSelection || !GraphicSelection.hasActiveSelection()) return;
			const pos = this.calcPosition();
			this.container.style.left = pos.x + 'px';
			this.container.style.top = pos.y + 'px';
			window.L.DomUtil.removeClass(this.container, 'hidden');
			this.shown = true;
		});
	}

	getWriterTextContext(): WidgetJSON[] {
		return [
			{
				id: 'home-container',
				type: 'container',
				children: [
					{
						id: 'home-select',
						type: 'toolitem',
						text: _UNO('.uno:SelectTheme'),
						command: '.uno:SelectTheme',
					} as ToolItemWidgetJSON,
					{
						id: 'home-save',
						type: 'toolitem',
						text: _UNO('.uno:ChartSaveToNewTheme'),
						command: '.uno:ChartSaveToNewTheme',
					} as ToolItemWidgetJSON,
				],
				vertical: true,
			} as ContainerWidgetJSON,
		];
	}

	onJSAction(e: any): any {
		if (e.data.jsontype !== 'notebookbar') return;

		this.builder.executeAction(this.container, e.data.data);
	}

	onJSUpdate(e: any): any {
		if (e.data.jsontype !== 'notebookbar') return;

		this.builder.updateWidget(this.container, e.data.control);
	}

	setLastInputEventType(e: any) {
		this.lastIinputEvent = e;
		if (e.type === 'buttonup' && e.input === 'mouse' && this.pendingShow) {
			this.showChartContextToolbarImpl();
			this.pendingShow = false;
		}
	}

	changeOpacity(opacity: number) {
		this.container.style.opacity = opacity.toString();
	}
}

window.L.control.ChartContextToolbar = function (map: any) {
	return new ChartContextToolbar(map);
};
