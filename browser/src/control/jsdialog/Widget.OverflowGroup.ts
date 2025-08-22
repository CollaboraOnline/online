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
	if (!from) {
		app.console.debug('overflow manager: no source for migration');
		return;
	}

	const items = from.querySelectorAll(':scope > *');

	items.forEach((button: Element) => {
		const htmlButton = button as HTMLElement;
		to.appendChild(htmlButton);
	});
}

function createMoreButton(
	id: string,
	more: MoreOptions,
	groupLabel: HTMLElement,
): HTMLElement {
	const moreOptionsButton = document.createElement('button');
	moreOptionsButton.className = 'ui-content unobutton';
	moreOptionsButton.id = `${id}-more-button`;
	moreOptionsButton.setAttribute('aria-label', `More options for ${id}`);
	moreOptionsButton.setAttribute('aria-pressed', 'false');

	const img = document.createElement('img');
	app.LOUtil.setImage(img, 'lc_overflow-morebutton.svg', app.map);
	moreOptionsButton.appendChild(img);

	const unoToolButtonDiv = document.createElement('div');
	unoToolButtonDiv.id = `${id}-more`;
	unoToolButtonDiv.className = 'unotoolbutton ui-overflow-group-more';
	unoToolButtonDiv.tabIndex = -1;
	unoToolButtonDiv.setAttribute('data-cooltip', `More options for ${id}`);
	unoToolButtonDiv.appendChild(moreOptionsButton);

	const expanderIconRightDiv = document.createElement('div');
	expanderIconRightDiv.className = 'ui-expander-icon-right jsdialog sidebar';
	expanderIconRightDiv.appendChild(unoToolButtonDiv);

	if (groupLabel.parentElement) {
		groupLabel.parentElement.appendChild(expanderIconRightDiv);
	}

	moreOptionsButton.addEventListener('click', (e) => {
		e.stopPropagation();
		e.preventDefault();
		app.map.sendUnoCommand(more.command);
	});

	return expanderIconRightDiv;
}

function setupOverflowMenu(
	overflowGroupContainer: HTMLElement,
	overflowGroupContentContainer: HTMLElement,
	bottomBar: HTMLElement,
	id: string,
	more: MoreOptions | undefined,
) {
	const overflowMenuButton = overflowGroupContainer.querySelector(
		'[id^="overflow-button"]',
	) as HTMLElement;
	overflowMenuButton.style.display = 'none';

	const groupLabel = overflowGroupContainer.querySelector(
		'.ui-overflow-group-label',
	) as HTMLElement;

	if (more) {
		createMoreButton(id, more, groupLabel);
	}

	// keeps hidden items
	const hiddenItems = L.DomUtil.create(
		'div',
		'hidden-overflow-container',
		overflowGroupContainer,
	);
	hiddenItems.style.display = 'none';
	overflowGroupContainer.classList.add(
		'ui-overflow-group-container-with-label',
	);

	// keeps original content
	const originalTopbar =
		overflowGroupContentContainer.querySelectorAll(':scope > *');

	// hide/show content on resize
	const overflowMenuHandler = (hideContent: boolean) => {
		overflowGroupContentContainer.replaceChildren();
		hiddenItems.replaceChildren();

		if (hideContent) {
			// top row container
			const topRow = document.createElement('div');
			topRow.classList.add('top-row-overflow-group');
			originalTopbar.forEach((el) => topRow.append(el));
			overflowGroupContentContainer.append(topRow, bottomBar ?? null);
			migrateItems(overflowGroupContentContainer, hiddenItems);
		} else {
			// show normally
			originalTopbar.forEach((el) => overflowGroupContentContainer.append(el));
			hiddenItems.replaceChildren(); // do not allow to duplicate buttons
			if (bottomBar) {
				// make sure bottom bar gets it's original position after unfold
				overflowGroupContainer?.append(bottomBar);
			}
		}
	};

	const dropdownId = 'overflow-button-' + id;
	let isCollapsed = false;

	(overflowGroupContainer as OverflowGroupContainer).isCollapsed = () => {
		return isCollapsed;
	};

	(overflowGroupContainer as OverflowGroupContainer).foldGroup = () => {
		if (isCollapsed) return;
		app.console.debug('overflow manager: fold group: ' + id);
		JSDialog.CloseDropdown(dropdownId);

		overflowMenuHandler(true);
		overflowGroupContainer.classList.remove(
			'ui-overflow-group-container-with-label',
		);
		overflowMenuButton.style.display = '';
		isCollapsed = true;
	};

	(overflowGroupContainer as OverflowGroupContainer).unfoldGroup = () => {
		if (!isCollapsed) return;

		app.console.debug('overflow manager: unfold group: ' + id);
		JSDialog.CloseDropdown(dropdownId);

		overflowMenuButton.style.display = 'none';
		overflowGroupContainer.classList.add(
			'ui-overflow-group-container-with-label',
		);
		overflowMenuHandler(false);
		isCollapsed = false;
	};

	// fill the updated menu after it is open
	(overflowMenuButton as any)._onDropDown = (opened: boolean) => {
		if (opened) {
			// we need to schedule it 2 times as the first one happens just before
			// layouting task adds menu container to the DOM
			app.layoutingService.appendLayoutingTask(() => {
				app.layoutingService.appendLayoutingTask(() => {
					const menu = JSDialog.GetDropdown(dropdownId);
					if (!menu) {
						app.console.error(
							'overflow manager: menu missing: "' + dropdownId + '"',
						);
						return;
					}
					// move overflow to the NB structure to be targeted by onJSUpdate and onJSAction
					const overflowNode = menu.parentNode;
					overflowNode.style.position = 'fixed';
					overflowNode.style.zIndex = '20000';
					overflowGroupContainer.appendChild(menu.parentNode);
					menu?.replaceChildren();
					menu?.classList.add('ui-toolbar');
					menu?.classList.add('ui-overflow-group-popup');

					migrateItems(hiddenItems, menu);
				});
			});
		} else {
			const menu = JSDialog.GetDropdown(dropdownId);
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
	const overflowGroupContainer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group',
		parentContainer,
	);
	overflowGroupContainer.id = data.id;

	const overflowGroupInnerContainer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group-inner',
		overflowGroupContainer,
	);
	overflowGroupInnerContainer.id = data.id + '-inner';

	const contentContainer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group-content',
		overflowGroupInnerContainer,
	);
	contentContainer.classList.add(data.vertical ? 'vertical' : 'horizontal');
	overflowGroupInnerContainer.id = data.id + '-content';

	const bottomBar = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group-bottom',
		overflowGroupContainer,
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
				children: [
					{
						id: 'dummy-overflow-button-required-for-focus',
						type: 'pushbutton',
						text: 'X',
					},
				],
			} as WidgetJSON,
		},
		{ type: 'separator' },
	] as Array<MenuDefinition>;
	builder._menus.set(data.id, builtMenu);

	// button
	const id = 'overflow-button-' + data.id;
	builder.build(
		overflowGroupInnerContainer,
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

	setupOverflowMenu(
		overflowGroupContainer,
		contentContainer,
		bottomBar,
		data.id,
		data.more,
	);

	return false;
} as JSWidgetHandler;
