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
 * JSDialog.OverflowGroup - can hide items from last to first if requested and
 *                          add dropdown menu to access them instead
 */

declare var JSDialog: any;

function migrateItems(from: HTMLElement, to: HTMLElement) {
	const items = from.querySelectorAll(':scope > *');

	items.forEach((button: Element) => {
		const htmlButton = button as HTMLElement;
		to.appendChild(htmlButton);
	});
}

function setupOverflowMenu(
	parentContainer: HTMLElement,
	overflowMenu: HTMLElement,
	id: string,
) {
	const overflowMenuButton = parentContainer.querySelector(
		'[id^="overflow-button"]',
	) as HTMLElement;
	overflowMenuButton.style.display = 'none';

	const groupLabel = parentContainer.querySelector(
		'.ui-overflow-group-label',
	) as HTMLElement;

	// keeps hidden items
	const hiddenItems = L.DomUtil.create(
		'div',
		'hidden-overflow-container',
		parentContainer,
	);
	hiddenItems.style.display = 'none';

	// keeps original content
	const originalTopbar = overflowMenu.querySelectorAll(':scope > *');

	// hide/show content on resize
	const overflowMenuHandler = (hideContent: boolean) => {
		overflowMenu.replaceChildren();
		originalTopbar.forEach((element: Element) => {
			overflowMenu.append(element);
		});

		if (hideContent) migrateItems(overflowMenu, hiddenItems);
	};

	// New state + size cache
	let _isFolded = false;
	let unfoldedSize: number | undefined;

	(parentContainer as OverflowGroupContainer).foldGroup = () => {
		if (_isFolded) return;
		app.console.debug('overflow manager: fold group: ' + id);
		overflowMenuHandler(true);
		groupLabel.style.display = 'none';
		overflowMenuButton.style.display = '';
		_isFolded = true;
	};

	(parentContainer as OverflowGroupContainer).unfoldGroup = () => {
		if (!_isFolded) return;
		app.console.debug('overflow manager: unfold group: ' + id);
		groupLabel.style.display = '';
		overflowMenuButton.style.display = 'none';
		overflowMenuHandler(false);
		_isFolded = false;
	};

	(parentContainer as OverflowGroupContainer).isCollapsed = () => _isFolded;

	(parentContainer as OverflowGroupContainer).getUnfoldedSize = () => {
		if (unfoldedSize === undefined) {
			const prevState = _isFolded;
			if (_isFolded) {
				// temporarily unfold to measure, without flicker
				groupLabel.style.display = '';
				overflowMenuButton.style.display = 'none';
				overflowMenuHandler(false);
			}
			unfoldedSize = parentContainer.scrollWidth;
			if (_isFolded !== prevState) {
				// restore folded state
				groupLabel.style.display = 'none';
				overflowMenuButton.style.display = '';
				overflowMenuHandler(true);
				_isFolded = true;
			}
		}
		return unfoldedSize;
	};

	(overflowMenuButton as any)._onDropDown = (opened: boolean) => {
		if (opened) {
			// we need to schedule it 2 times as the first one happens just before
			// layouting task adds menu container to the DOM
			app.layoutingService.appendLayoutingTask(() => {
				app.layoutingService.appendLayoutingTask(() => {
					const menu = JSDialog.GetDropdown('overflow-button-' + id);
					// move overflow to the NB structure to be targeted by onJSUpdate and onJSAction
					const overflowNode = menu.parentNode;
					overflowNode.style.position = 'fixed';
					overflowNode.style.zIndex = '20000';
					parentContainer.appendChild(menu.parentNode);
					menu?.replaceChildren();
					menu?.classList.add('ui-toolbar');
					menu?.classList.add('ui-overflow-group-popup');

					migrateItems(hiddenItems, menu);
				});
			});
		} else {
			const menu = JSDialog.GetDropdown('overflow-button-' + id);
			migrateItems(menu, hiddenItems);
		}
	};
}

function findFirstToolitem(
	items: Array<WidgetJSON> | undefined,
): WidgetJSON | null {
	if (!items) return null;

	for (const item of items) {
		if (
			item.type.indexOf('toolitem') >= 0 ||
			item.type.indexOf('colorlistbox') >= 0
		)
			return item;
		else if (item.children && item.children.length) {
			const innerItem = findFirstToolitem(item.children);
			if (innerItem !== null) return innerItem;
		}
	}
	return null;
}

// TODO: add correct type
function getToolitemIcon(item: WidgetJSON | null): string {
	if (!item) return 'lc_menuoverflow.svg';

	if ((item as any).icon !== undefined) return (item as any).icon;
	else return app.LOUtil.getIconNameOfCommand((item as any).command);
}

JSDialog.OverflowGroup = function (
	parentContainer: Element,
	data: OverflowGroupWidgetJSON,
	builder: JSBuilder,
) {
	const container = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group',
		parentContainer,
	);
	container.id = data.id;

	const innerContainer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group-inner',
		container,
	);
	innerContainer.id = data.id + '-inner';

	const contentContainer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group-content',
		innerContainer,
	);
	contentContainer.classList.add(data.vertical ? 'vertical' : 'horizontal');
	innerContainer.id = data.id + '-content';

	const bottomBar = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group-bottom',
		container,
	);
	bottomBar.id = data.id + '-bottom';

	const label = L.DomUtil.create(
		'span',
		builder.options.cssClass + ' ui-overflow-group-label',
		bottomBar,
	);
	if (data.name) label.innerText = data.name;

	// content
	if (data.children) builder.build(contentContainer, data.children, false);
	else app.console.error('OverflowGroup: no content provided');

	// first toolitem in the group
	const firstItem = findFirstToolitem(data.children);
	console.assert(firstItem, 'First toolitem inside overflow group not found');

	// placeholder menu for a dropdown
	const builtMenu = [
		{
			type: 'json',
			content: {
				id: 'overflow-group-placeholder-' + data.id,
				type: 'toolbox',
				children: [],
			} as WidgetJSON,
		},
		{ type: 'separator' },
	] as Array<MenuDefinition>;
	builder._menus.set(data.id, builtMenu);

	// button
	const id = 'overflow-button-' + data.id;
	builder.build(
		innerContainer,
		[
			{
				type: 'menubutton',
				id: id,
				text: data.name ? data.name : firstItem ? (firstItem as any).text : '',
				icon: data.icon ? data.icon : getToolitemIcon(firstItem),
				command: firstItem ? (firstItem as any).command : '',
				noLabel: !data.name,
				menu: builtMenu,
				applyCallback:
					firstItem && firstItem.type === 'toolitem'
						? () => {
								firstItem.type.includes('custom')
									? app.dispatcher.dispatch((firstItem as any).command)
									: app.map.sendUnoCommand((firstItem as any).command);
							}
						: undefined,
			} as any as WidgetJSON,
		],
		false,
	);

	setupOverflowMenu(container, contentContainer, data.id);

	return false;
} as JSWidgetHandler;
