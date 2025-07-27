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

	const overflowMenuWrapper = L.DomUtil.create('div', 'menu-overflow-wrapper');

	const showOverflowMenu = () => {
		parentContainer.append(overflowMenuWrapper);
		overflowMenuWrapper.style.opacity = '1';
		overflowMenuWrapper.style.pointerEvents = 'revert';
		L.DomUtil.addClass(overflowMenuButton, 'selected');
	};

	const hideOverflowMenu = () => {
		if (overflowMenuWrapper.parentNode === parentContainer)
			parentContainer.removeChild(overflowMenuWrapper);
		overflowMenuWrapper.style.opacity = '0';
		overflowMenuWrapper.style.pointerEvents = 'none';
		L.DomUtil.removeClass(overflowMenuButton, 'selected');
	};

	const onButtonClick = () => {
		if (
			overflowMenuWrapper.style.opacity === '0' ||
			overflowMenuWrapper.style.opacity === ''
		) {
			showOverflowMenu();
		} else {
			hideOverflowMenu();
		}
	};

	overflowMenuButton?.addEventListener('click', () => {
		app.layoutingService.appendLayoutingTask(onButtonClick);
	});

	// resizing

	let overflowMenuDebounced: ReturnType<typeof setTimeout>;
	const originalTopbar = overflowMenu.querySelectorAll(':scope > *');

	const overflowMenuHandler = (overflow: boolean) => {
		hideOverflowMenu();

		overflowMenu.replaceChildren();
		originalTopbar.forEach((element: Element) => {
			overflowMenu.append(element);
		});

		const topBarButtons = overflowMenu.querySelectorAll(':scope > *');

		const overflowMenuOffscreen = document.createElement('div');
		overflowMenuOffscreen.className = 'menu-overfow-vertical';
		overflowMenuOffscreen.style.display = 'grid';
		overflowMenuOffscreen.style.gridAutoFlow = 'column';

		let section: Array<HTMLElement> = [];

		const appendSection = () => {
			for (const element of section) {
				overflowMenuOffscreen.appendChild(element);
			}
			section.length = 0;
		};

		topBarButtons.forEach((button: Element) => {
			const htmlButton = button as HTMLElement;
			if (overflow) {
				appendSection();
				overflowMenuOffscreen.appendChild(htmlButton);
			} else if (htmlButton.className.includes('vertical')) {
				section = [htmlButton];
			} else {
				section.push(htmlButton);
			}
		});

		overflowMenuWrapper.append(overflowMenuOffscreen);

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

	// button
	builder.build(
		innerContainer,
		[
			{
				type: 'bigcustomtoolitem',
				id: 'overflow-button-' + data.id,
				text: data.name ? data.name : '',
				icon: getToolitemIcon(firstItem),
				// TODO: command: (firstItem as any).command, // call on main button click
				noLabel: !data.name,
				// TODO: dropdown: true, // show dropdown arrow
			} as any as WidgetJSON,
		],
		false,
	);

	setupOverflowMenu(container, contentContainer, data.id);

	return false;
} as JSWidgetHandler;
