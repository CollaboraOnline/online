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
 * Control.NotebookbarBase - component for tabbed menu on the top of application
 */

class NotebookbarBase extends JSDialogComponent {
	/// reference to old JS Notebookbar
	impl: any = null;

	constructor(map: any, impl: any) {
		super(map, 'Notebookbar', 'notebookbar');
		this.impl = impl;

		this.createBuilder();
		this.impl.setBuilder(this.builder, this.model);

		this.map.addControl(this.impl);

		this.registerMessageHandlers();
	}

	// when we show the UI
	public onAdd() {
		this.setupContainer(undefined);
		this.impl.create(this.container);
		if (this.builder) {
			this.map.on(
				'commandstatechanged',
				this.builder.onCommandStateChanged,
				this.builder,
			);
		}
	}

	// when we hide the UI
	public onRemove() {
		if (this.builder)
			this.map.off(
				'commandstatechanged',
				this.builder.onCommandStateChanged,
				this.builder,
			);

		if (this.impl) this.impl.onRemove();
	}

	protected createBuilder() {
		this.builder = new window.L.control.notebookbarBuilder({
			windowId: WindowId.Notebookbar,
			mobileWizard: this.impl,
			map: this.map,
			cssClass: 'notebookbar',
			useSetTabs: true,
			suffix: 'notebookbar',
		});
	}

	protected setupContainer(parentContainer?: HTMLElement) {
		// remove old toolbar
		let toolbar = window.L.DomUtil.get('toolbar-up');
		if (toolbar) toolbar.outerHTML = '';
		// create toolbar from template
		$('#toolbar-logo').after(this.map.toolbarUpTemplate.cloneNode(true));
		toolbar = window.L.DomUtil.get('toolbar-up');

		this.container = window.L.DomUtil.create(
			'div',
			'notebookbar-scroll-wrapper',
			toolbar,
		);
	}

	protected onJSUpdate(e: any) {
		if (super.onJSUpdate(e)) {
			this.impl?.setInitialized(true);
			return true;
		}
		return false;
	}

	protected onJSAction(e: any) {
		if (super.onJSAction(e)) {
			this.impl?.setInitialized(true);
			return true;
		}
		return false;
	}

	/// used to get full model
	public getFullJSON(): any[] {
		return this.impl?.getFullJSON();
	}

	// shortcuts

	/// used to get shortcut items
	public getDefaultToolItems(): any[] {
		return this.impl?.getDefaultToolItems();
	}

	public insertButtonToShortcuts(button: ToolItemWidgetJSON) {
		this.impl?.insertButtonToShortcuts(button);
	}

	public reloadShortcutsBar() {
		this.impl?.reloadShortcutsBar();
	}

	public showNotebookbarCommand(commandId: string, show: boolean) {
		this.impl?.showNotebookbarCommand(commandId, show);
	}

	// tabs

	public getTabs() {
		return this.impl?.getTabs();
	}

	public setTabs(tabs: any[]) {
		this.impl?.setTabs();
	}

	public showTabs() {
		this.impl?.showTabs();
	}

	public hideTabs() {
		this.impl?.hideTabs();
	}

	// customization

	public showItem(id: string, show?: boolean): boolean {
		return this.impl?.showItem(id /* no show used */);
	}

	public hideItem(id: string): boolean {
		return this.impl?.hideItem(id);
	}
}

JSDialog.NotebookbarBase = function (map: any, impl: any) {
	return new NotebookbarBase(map, impl);
};
