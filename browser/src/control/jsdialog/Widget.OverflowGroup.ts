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
	const overflowMenuWrapper = L.DomUtil.create('div', 'menu-overflow-wrapper');

	// resizing
	const originalTopbar = overflowMenu.querySelectorAll(':scope > *');

	const overflowMenuHandler = (overflow: boolean) => {
		overflowMenu.replaceChildren();
		originalTopbar.forEach((element: Element) => {
			overflowMenu.append(element);
		});

		const topBarButtons = overflowMenu.querySelectorAll(':scope > *');

		topBarButtons.forEach((button: Element) => {
			const htmlButton = button as HTMLElement;
			if (overflow) overflowMenuWrapper.appendChild(htmlButton);
		});

		overflowMenu.style.left =
			overflowMenuButton.offsetLeft -
			overflowMenu.clientWidth +
			overflowMenuButton.offsetWidth +
			'px';
	};

	(parentContainer as OverflowGroupContainer).foldGroup = function () {
		console.debug('overflow manager: fold group: ' + id);
		overflowMenuHandler(true);
		groupLabel.style.display = 'none';
		overflowMenuButton.style.display = '';
	};

	(parentContainer as OverflowGroupContainer).unfoldGroup = function () {
		console.debug('overflow manager: unfold group: ' + id);
		groupLabel.style.display = '';
		overflowMenuButton.style.display = 'none';
		overflowMenuHandler(false);
	};
}

function findFirstToolitem(items: Array<WidgetJSON>): WidgetJSON | null {
	for (const item of items) {
		if (item.type.indexOf('toolitem') >= 0) return item;
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
	builder.build(contentContainer, data.children, false);

	const firstItem = findFirstToolitem(data.children);

	const builtMenu = [
		{
			type: 'json',
			content: {
				id: 'menu-overflow-wrapper',
				type: 'toolbox',
				children: data.children,
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
				id: 'overflow-button-' + id,
				text: data.name ? data.name : (firstItem as any).text,
				icon: getToolitemIcon(firstItem),
				command: (firstItem as any).command, // call on main button click
				noLabel: !data.name,
				menu: builtMenu,
				applyCallback: () => {
					if (!firstItem) return;
					firstItem.type.includes('custom')
						? app.dispatcher.dispatch((firstItem as any).command)
						: app.map.sendUnoCommand((firstItem as any).command);
				},
			} as any as WidgetJSON,
		],
		false,
	);

	setupOverflowMenu(container, contentContainer, data.id);

	return false;
} as JSWidgetHandler;
