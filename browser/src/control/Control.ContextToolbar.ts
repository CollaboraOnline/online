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
 * L.control.ContextToolbar - definition of context toolbar
 * This toolbar should appear over selection when related selection is done using mouse
 */

class ContextToolbar {
	container: HTMLElement;
	builder: any;
	map: any;
	initialized: boolean = false;
	lastIinputEvent?: any = {};
	pendingShow: boolean = false;
	// roughly twice the height(76px) of default context toolbar in each direction from boundary
	disappearingBoundary: number = 150; // px

	constructor(map: any) {
		this.map = map;
		this.builder = new L.control.notebookbarBuilder({
			windowId: -2,
			mobileWizard: this,
			map: this.map,
			cssClass: 'notebookbar',
			suffix: 'context-toolbar',
		});
		this.container = L.DomUtil.createWithId(
			'div',
			'context-toolbar',
			document.body,
		);
		L.DomUtil.addClass(this.container, 'notebookbar horizontal');
	}

	showContextToolbar(): void {
		if (this.lastIinputEvent.input === 'mouse') this.pendingShow = true;
		if (this.lastIinputEvent.type !== 'buttonup') return;

		this.showContextToolbarImpl();
	}

	showContextToolbarImpl(): void {
		this.pendingShow = false;
		if (!this.initialized) {
			this.builder.build(this.container, this.getWriterTextContext(), false);
			this.initialized = true;
		}

		this.builder.map.on('jsdialogaction', this.onJSAction, this);
		this.builder.map.on('jsdialogupdate', this.onJSUpdate, this);
		document.addEventListener('pointermove', this.pointerMove);
		this.changeOpacity(1);
		this.showHideToolbar(true);
	}

	hideContextToolbar(): void {
		this.builder.map.off('jsdialogaction', this.onJSAction, this);
		this.builder.map.off('jsdialogupdate', this.onJSUpdate, this);
		document.removeEventListener('pointermove', this.pointerMove);
		this.showHideToolbar(false);
	}

	private showHideToolbar(show: boolean): void {
		app.layoutingService.appendLayoutingTask(() => {
			if (!show) {
				L.DomUtil.addClass(this.container, 'hidden');
				return;
			}

			let statRect;
			if (!TextSelections || !(statRect = TextSelections.getStartRectangle()))
				return;
			const pos = { x: statRect.pX1, y: statRect.pY1 };
			pos.x -=
				(app.sectionContainer.getDocumentTopLeft()[0] -
					app.sectionContainer.getDocumentAnchor()[0]) /
					app.dpiScale -
				app.sectionContainer.getCanvasBoundingClientRect().x;
			pos.y -=
				(app.sectionContainer.getDocumentTopLeft()[1] -
					app.sectionContainer.getDocumentAnchor()[1]) /
					app.dpiScale -
				app.sectionContainer.getCanvasBoundingClientRect().y;
			this.container.style.left = pos.x + 'px';
			this.container.style.top = pos.y + 'px';
			L.DomUtil.removeClass(this.container, 'hidden');
		});
	}

	getWriterTextContext(): Array<Record<string, unknown>> {
		return [
			{
				type: 'container',
				children: [
					{
						type: 'container',
						children: [
							{
								id: 'fontnamecombobox',
								type: 'combobox',
								text: (document.getElementById('fontnamecombobox-input') as any)
									.value,
								entries: Object.keys(
									this.builder.map._docLayer._toolbarCommandValues[
										'.uno:CharFontName'
									],
								),
								selectedCount: '1',
								selectedEntries: [
									(document.getElementById('fontnamecombobox-input') as any)
										.selectionStart,
								],
								command: '.uno:CharFontName',
								customEntryRenderer: true,
							},
							{
								id: 'fontsizecombobox',
								type: 'combobox',
								text: (document.getElementById('fontsizecombobox-input') as any)
									.value,
								entries: [
									6, 7, 8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20, 21, 22,
									24, 26, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96,
								],
								selectedCount: '1',
								selectedEntries: [
									(document.getElementById('fontsizecombobox-input') as any)
										.selectionStart,
								],
								command: '.uno:FontHeight',
							},
							{
								id: 'home-grow',
								type: 'toolitem',
								text: _UNO('.uno:Grow'),
								command: '.uno:Grow',
							},
							{
								id: 'home-shrink',
								type: 'toolitem',
								text: _UNO('.uno:Shrink'),
								command: '.uno:Shrink',
							},
						],
						vertical: 'false',
					},
					{
						type: 'container',
						children: [
							{
								type: 'toolbox',
								children: [
									{
										id: 'home-bold',
										type: 'toolitem',
										text: _UNO('.uno:Bold'),
										command: '.uno:Bold',
									},
									{
										id: 'home-italic',
										type: 'toolitem',
										text: _UNO('.uno:Italic'),
										command: '.uno:Italic',
									},
									{
										id: 'home-underline',
										type: 'toolitem',
										text: _UNO('.uno:Underline'),
										command: '.uno:Underline',
									},
									{
										id: 'home-strikeout',
										type: 'toolitem',
										text: _UNO('.uno:Strikeout'),
										command: '.uno:Strikeout',
									},
									{
										id: 'home-subscript',
										type: 'toolitem',
										text: _UNO('.uno:SubScript'),
										command: '.uno:SubScript',
									},
									{
										id: 'home-superscript',
										type: 'toolitem',
										text: _UNO('.uno:SuperScript'),
										command: '.uno:SuperScript',
									},
									{
										id: 'home-spacing:CharSpacingMenu',
										type: 'menubutton',
										noLabel: true,
										text: _UNO('.uno:Spacing'),
										command: '.uno:CharSpacing',
									},
									{
										id: 'home-back-color:ColorPickerMenu',
										class: 'unospan-CharBackColor',
										type: 'toolitem',
										noLabel: true,
										text: _UNO('.uno:CharBackColor', 'text'),
										command: '.uno:CharBackColor',
									},
									{
										id: 'home-color:ColorPickerMenu',
										class: 'unospan-FontColor',
										type: 'toolitem',
										noLabel: true,
										text: _UNO('.uno:Color'),
										command: '.uno:Color',
									},
								],
							},
						],
						vertical: 'false',
					},
				],
				vertical: 'true',
			},
			{
				type: 'separator',
				id: 'home-fontcombobox-break',
				orientation: 'vertical',
			},
			{
				id: 'home-insert-annotation',
				type: 'bigtoolitem',
				text: _UNO('.uno:InsertAnnotation'),
				command: '.uno:InsertAnnotation',
			},
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
			this.showContextToolbarImpl();
			this.pendingShow = false;
		}
	}

	calculateOpacity(e: PointerEvent): number {
		const clientRect: DOMRect = this.container.getBoundingClientRect();

		// hover over toolbar
		if (
			clientRect.left < e.clientX &&
			e.clientX < clientRect.right &&
			clientRect.top < e.clientY &&
			e.clientY < clientRect.bottom
		) {
			return 1;
		}

		const minX = clientRect.left - this.disappearingBoundary;
		const maxX = clientRect.right + this.disappearingBoundary;
		const minY = clientRect.top - this.disappearingBoundary;
		const maxY = clientRect.bottom + this.disappearingBoundary;

		let xDistance: number = 0;
		// left of toolbar
		if (minX < e.clientX && e.clientX < clientRect.left)
			xDistance = e.clientX - minX;
		// right of toolbar
		else if (clientRect.right < e.clientX && e.clientX < maxX)
			xDistance = maxX - e.clientX;

		let yDistance: number = 0;
		// top of toolbar
		if (minY < e.clientY && e.clientY < clientRect.top)
			yDistance = e.clientY - minY;
		// bottom of toolbar
		else if (clientRect.bottom < e.clientY && e.clientY < maxY)
			yDistance = maxY - e.clientY;

		return (xDistance + yDistance) / (2 * this.disappearingBoundary);
	}

	pointerMove = (e: PointerEvent): void => {
		app.layoutingService.appendLayoutingTask(() => {
			const opacity: number = this.calculateOpacity(e);

			if (opacity === 1) {
				this.makeContextToolbarConstant();
				return;
			} else if (opacity === 0) {
				this.hideContextToolbar();
				return;
			}

			this.changeOpacity(opacity);
		});
	};

	makeContextToolbarConstant(): void {
		document.removeEventListener('pointermove', this.pointerMove);
		this.changeOpacity(1);
	}

	changeOpacity(opacity: number) {
		this.container.style.opacity = opacity.toString();
	}
}

L.control.ContextToolbar = function (map: any) {
	return new ContextToolbar(map);
};
