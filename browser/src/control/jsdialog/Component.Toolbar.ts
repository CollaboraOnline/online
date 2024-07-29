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
 * Component.Toolbar - base class for toolbars
 */

declare var JSDialog: any;

type ToolbarItem = any;

class Toolbar {
	protected map: any;
	protected docType: string;
	protected builder: any;
	protected callback: JSDialogCallback;
	protected toolbarElementId: string;
	protected parentContainer: Element;
	protected customItems: Array<ToolbarItem>;

	constructor(map: any, toolbarElementId: string) {
		this.map = map;
		this.docType = map.getDocType();
		this.customItems = [];
		this.toolbarElementId = toolbarElementId;

		this.builder = new L.control.jsDialogBuilder({
			mobileWizard: this,
			map: this.map,
			cssClass: 'jsdialog',
			noLabelsForUnoButtons: true,
			callback: this.callback ? this.callback.bind(this) : undefined,
		});

		this.reset();
		this.create();
		this.updateVisibilityForToolbar('');
	}

	getToolItems(): Array<ToolbarItem> {
		return [];
	}

	reset() {
		this.parentContainer = L.DomUtil.get(this.toolbarElementId);

		// In case it contains garbage
		if (this.parentContainer) this.parentContainer.replaceChildren();

		L.DomUtil.addClass(this.parentContainer, 'ui-toolbar');
	}

	create() {
		this.reset();

		var items = this.getToolItems();
		this.builder.build(this.parentContainer, items);

		JSDialog.MakeScrollable(
			this.parentContainer,
			this.parentContainer.querySelector('div'),
		);
		JSDialog.RefreshScrollables();

		if (this.map.isRestrictedUser()) {
			for (var i = 0; i < items.length; i++) {
				var it = items[i];
				var item = $('#' + it.id)[0];
				this.map.hideRestrictedItems(it, item, item);
			}
		}

		if (this.map.isLockedUser()) {
			for (var i = 0; i < items.length; i++) {
				var it = items[i];
				var item = $('#' + it.id)[0];
				this.map.disableLockedItem(it, item, item);
			}
		}
	}

	hasItem(id: string) {
		return (
			this.getToolItems().filter((item) => {
				return item.id === id;
			}).length > 0
		);
	}

	insertItem(beforeId: string, items: Array<ToolbarItem>) {
		this.customItems.push({ beforeId: beforeId, items: items });
		this.create();
	}

	showItem(command: string, show: boolean) {
		if (!command) return;

		this.builder.executeAction(this.parentContainer, {
			control_id: command,
			control: { id: command },
			action_type: show ? 'show' : 'hide',
		});

		JSDialog.RefreshScrollables();
	}

	enableItem(command: string, enable: boolean) {
		if (!command) return;

		this.builder.executeAction(this.parentContainer, {
			control_id: command,
			action_type: enable ? 'enable' : 'disable',
		});
	}

	selectItem(command: string, select: boolean) {
		if (!command) return;

		this.builder.executeAction(this.parentContainer, {
			control_id: command,
			action_type: select ? 'select' : 'unselect',
		});
	}

	updateItem(data: ToolbarItem) {
		this.builder.updateWidget(this.parentContainer, data);
		this.updateVisibilityForToolbar('');
		JSDialog.RefreshScrollables();
	}

	updateVisibilityForToolbar(context: string) {
		const toShow: Array<string> = [];
		const toHide: Array<string> = [];

		const items = this.getToolItems();
		items.forEach((item) => {
			if (
				(window as any).ThisIsTheiOSApp &&
				window.mode.isTablet() &&
				item.iosapptablet === false
			) {
				toHide.push(item.id);
			} else if (
				((window.mode.isMobile() && item.mobile === false) ||
					(window.mode.isTablet() && item.tablet === false) ||
					(window.mode.isDesktop() && item.desktop === false) ||
					(!(window as any).ThisIsAMobileApp &&
						item.mobilebrowser === false)) &&
				!item.hidden
			) {
				toHide.push(item.id);
			} else if (
				((window.mode.isMobile() && item.mobile === true) ||
					(window.mode.isTablet() && item.tablet === true) ||
					(window.mode.isDesktop() && item.desktop === true) ||
					((window as any).ThisIsAMobileApp && item.mobilebrowser === true)) &&
				item.hidden
			) {
				toShow.push(item.id);
			}

			if (context && item.context) {
				if (item.context.indexOf(context) >= 0) toShow.push(item.id);
				else toHide.push(item.id);
			} else if (!context && item.context) {
				if (item.context.indexOf('default') >= 0) toShow.push(item.id);
				else toHide.push(item.id);
			}
		});

		window.app.console.log('explicitly hiding: ' + toHide);
		window.app.console.log('explicitly showing: ' + toShow);

		toHide.forEach((item) => {
			this.showItem(item, false);
		});
		toShow.forEach((item) => {
			this.showItem(item, true);
		});
	}
}

JSDialog.Toolbar = Toolbar;
