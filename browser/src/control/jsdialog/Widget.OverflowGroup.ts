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
) {
	const overflowMenuButton = parentContainer.querySelector(
		'#menuoverflow',
	) as HTMLElement;
	const overflowMenuWrapper = L.DomUtil.create(
		'div',
		'menu-overflow-wrapper',
		parentContainer,
	);

	const showOverflowMenu = () => {
		overflowMenuWrapper.style.opacity = '1';
		overflowMenuWrapper.style.pointerEvents = 'revert';
		L.DomUtil.addClass(overflowMenuButton, 'selected');
	};

	const hideOverflowMenu = () => {
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

	// returns available space for a container
	const getMenuWidth = () => {
		const minimalBuffer = 60;
		const fullWidth = (overflowMenu.parentNode as HTMLElement).clientWidth;
		const menuRequest = (overflowMenu as HTMLElement).clientWidth;
		const staticWidth = fullWidth - menuRequest + minimalBuffer;
		if (window.innerWidth > staticWidth) return window.innerWidth - staticWidth;
		else return minimalBuffer; // at least show placeholder
	};

	let overflowMenuDebounced: ReturnType<typeof setTimeout>;
	const originalTopbar = overflowMenu.querySelectorAll('.jsdialog');

	const overflowMenuHandler = () => {
		overflowMenuDebounced && clearTimeout(overflowMenuDebounced);

		overflowMenuDebounced = setTimeout(() => {
			app.layoutingService.appendLayoutingTask(() => {
				hideOverflowMenu();

				overflowMenu.replaceChildren();
				originalTopbar.forEach((element: Element) => {
					overflowMenu.append(element);
				});

				const topBarButtons = overflowMenu.querySelectorAll(
					'.jsdialog:not(.hidden)',
				);
				const menuWidth = getMenuWidth();

				const overflowMenuOffscreen = document.createElement('div');
				overflowMenuOffscreen.className = 'menu-overfow-vertical';
				overflowMenuOffscreen.style.display = 'grid';
				overflowMenuOffscreen.style.gridAutoFlow = 'column';

				let section: Array<HTMLElement> = [];
				let overflow = false;

				const appendSection = () => {
					for (const element of section) {
						overflowMenuOffscreen.appendChild(element);
					}
					section.length = 0;
				};

				topBarButtons.forEach((button: Element) => {
					const htmlButton = button as HTMLElement;
					if (htmlButton.offsetLeft > menuWidth || overflow) {
						overflow = true;
						appendSection();
						overflowMenuOffscreen.appendChild(htmlButton);
					} else if (htmlButton.className.includes('vertical')) {
						section = [htmlButton];
					} else {
						section.push(htmlButton);
					}
				});

				overflowMenuWrapper.append(overflowMenuOffscreen);

				if (overflowMenuOffscreen.children.length <= 0) {
					overflowMenuButton.style.display = 'none';
				} else {
					overflowMenuButton.style.display = 'revert';
				}

				overflowMenu.style.left =
					overflowMenuButton.offsetLeft -
					overflowMenu.clientWidth +
					overflowMenuButton.offsetWidth +
					'px';
			});
		}, 250);
	};

	window.addEventListener('resize', overflowMenuHandler);
}

JSDialog.OverflowGroup = function (
	parentContainer: Element,
	data: ContainerWidgetJSON,
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
		builder.options.cssClass + ' ui-overflow-group-content',
		container,
	);
	innerContainer.id = data.id + '-content';

	// content
	builder.build(innerContainer, data.children, false);

	// button
	builder.build(
		container,
		[
			{
				type: 'customtoolitem',
				id: 'menuoverflow',
				text: _('More'),
			} as any as WidgetJSON,
		],
		false,
	);

	setupOverflowMenu(container, innerContainer);

	return false;
} as JSWidgetHandler;
