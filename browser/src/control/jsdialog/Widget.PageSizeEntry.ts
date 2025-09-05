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

/**
 * Widget.PageSizeEntry.ts
 *
 * A JSDialog "json" widget for rendering the page sizes
 */

declare var JSDialog: any;

interface PageSizeOption {
	id: string;
	text: string;
	uno: string;
}

function createPageSizeEntryWidget(data: any, builder: any): HTMLElement {
	const sizes: PageSizeOption[] = data.options || [];
	const container = document.createElement('div');
	container.className = 'jsdialog ui-grid';

	const list = document.createElement('div');
	list.className = 'jsdialog pagesize-list';
	container.appendChild(list);

	const map = builder.map;

	sizes.forEach((opt) => {
		const item = document.createElement('div');
		item.className = 'ui-combobox-entry jsdialog ui-grid-cell';
		item.id = opt.id;

		item.addEventListener('click', (evt: MouseEvent) => {
			map.sendUnoCommand(opt.uno);
			builder.callback('dialog', 'close', { id: data.id }, null);
		});

		const text = document.createElement('span');
		text.textContent = opt.text;

		item.appendChild(text);
		list.appendChild(item);
	});

	const hr = document.createElement('hr');
	hr.className = 'jsdialog ui-separator horizontal';
	container.appendChild(hr);

	const moreSizeContainer = document.createElement('div');
	moreSizeContainer.className = 'ui-combobox-entry jsdialog ui-grid-cell';
	moreSizeContainer.id = 'page-size-more';

	moreSizeContainer.addEventListener('click', (evt: MouseEvent) => {
		map.sendUnoCommand('.uno:PageFormatDialog');
		builder.callback('dialog', 'close', { id: data.id }, null);
	});

	const text = document.createElement('span');
	text.textContent = _('More Paper Sizes...');
	moreSizeContainer.appendChild(text);
	container.appendChild(moreSizeContainer);

	return container;
}

JSDialog.pageSizeEntry = function (
	parentContainer: Element,
	data: any,
	builder: any,
): boolean {
	const element = createPageSizeEntryWidget(data, builder);
	parentContainer.appendChild(element);
	return false;
};
