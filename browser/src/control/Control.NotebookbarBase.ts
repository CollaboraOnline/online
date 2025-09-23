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

	constructor(map: any) {
		super(map, 'Notebookbar', 'notebookbar');
		this.map = map;
	}

	public onAdd(impl: any) {
		this.impl = impl;

		this.map.addControl(this.impl);
		this.createBuilder();
		this.impl.setBuilder(this.builder, this.model);
		this.setupContainer(this.impl.container);

		this.registerMessageHandlers();
	}

	public onRemove() {
		if (this.builder)
			this.map.off(
				'commandstatechanged',
				this.builder.onCommandStateChanged,
				this.builder,
			);
		this.unregisterMessageHandlers();
		if (this.impl) {
			this.map.removeControl(this.impl);
			delete this.impl;
			this.impl = null;
		}
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
		if (this.builder)
			this.map.on(
				'commandstatechanged',
				this.builder.onCommandStateChanged,
				this.builder,
			);
	}

	protected setupContainer(parentContainer?: HTMLElement) {
		this.container = parentContainer;
	}

	protected onJSUpdate(e: FireEvent) {
		if (super.onJSUpdate(e)) {
			this.impl?.setInitialized(true);
			return true;
		}
		return false;
	}

	protected onJSAction(e: FireEvent) {
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

	public showNotebookbarButton(buttonId: string, show: boolean) {
		this.impl?.showNotebookbarButton(buttonId, show);
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

	public showItem(id: string, show?: boolean) {
		this.impl?.showItem(id /* no show used */);
	}

	public hideItem(id: string) {
		this.impl?.hideItem(id);
	}
}

JSDialog.NotebookbarBase = function (map: any) {
	return new NotebookbarBase(map);
};
