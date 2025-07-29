// @ts-strict-ignore
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
 * Widget.PageMarginEntry.ts
 *
 * A JSDialog "json" widget for rendering the page margins presets
 * and the "Custom Margins…" link.
 */

declare var JSDialog: any;

interface PageMarginOption {
	title: string;
	icon: string;
	details: { Top: number; Left: number; Bottom: number; Right: number };
}

interface PageMarginOptions {
	[id: string]: PageMarginOption;
}

function createPageMarginEntryWidget(data: any, builder: any): HTMLElement {
	const inchesToHMM = (inches: number) => Math.round(inches * 25.4 * 100);
	const options: PageMarginOptions = data.options;
	const container = document.createElement('div');
	const map = builder.map;
	container.className = 'margins-popup-container';

	const onMarginClick = (evt: MouseEvent) => {
		const elm = evt.currentTarget as HTMLElement;
		const key = elm.id;
		if (!key || !options[key]) return;

		const opt = options[key];
		const cmd =
			`.uno:CalcPageMargin` +
			`?Page.LeftMargin:long=${inchesToHMM(opt.details.Left)}` +
			`&Page.RightMargin=${inchesToHMM(opt.details.Right)}` +
			`&Page.TopMargin:long=${inchesToHMM(opt.details.Top)}` +
			`&Page.BottomMargin=${inchesToHMM(opt.details.Bottom)}`;

		map.sendUnoCommand(cmd);
		builder.callback('dialog', 'close', { id: data.id }, null);
	};

	Object.keys(options).forEach((key) => {
		const opt = options[key];

		const item = document.createElement('div');
		item.className = 'margin-item';
		item.id = key;
		item.addEventListener('click', onMarginClick);

		const img = document.createElement('img');
		img.className = 'margin-icon';
		const iconName = app.LOUtil.getIconNameOfCommand(opt.icon, true);
		app.LOUtil.setImage(img, iconName, app.map);

		const textWrap = document.createElement('div');
		textWrap.className = 'margin-text-content';

		const title = document.createElement('div');
		title.className = 'margin-title';
		title.textContent = opt.title;

		const values = document.createElement('div');
		values.className = 'margin-values';

		const col1 = document.createElement('div');
		col1.className = 'margin-col';
		const topSpan = document.createElement('span');
		topSpan.textContent = _('Top: {top}').replace(
			'{top}',
			`${opt.details.Top}"`,
		);
		const leftSpan = document.createElement('span');
		leftSpan.textContent = _('Left: {left}').replace(
			'{left}',
			`${opt.details.Left}"`,
		);
		col1.appendChild(topSpan);
		col1.appendChild(leftSpan);

		const col2 = document.createElement('div');
		col2.className = 'margin-col';
		const bottomSpan = document.createElement('span');
		bottomSpan.textContent = _('Bottom: {bottom}').replace(
			'{bottom}',
			`${opt.details.Bottom}"`,
		);
		const rightSpan = document.createElement('span');
		rightSpan.textContent = _('Right: {right}').replace(
			'{right}',
			`${opt.details.Right}"`,
		);
		col2.appendChild(bottomSpan);
		col2.appendChild(rightSpan);

		values.appendChild(col1);
		values.appendChild(col2);
		textWrap.appendChild(title);
		textWrap.appendChild(values);

		item.appendChild(img);
		item.appendChild(textWrap);
		container.appendChild(item);
	});

	const hr = document.createElement('hr');
	hr.className = 'jsdialog ui-separator horizontal';
	container.appendChild(hr);

	const custom = document.createElement('div');
	custom.className = 'margin-item custom-margins-link';
	custom.id = 'customMarginsLink';
	custom.textContent = _('Custom Margins…');
	custom.addEventListener('click', (evt: MouseEvent) => {
		map.sendUnoCommand('.uno:PageFormatDialog');
		builder.callback('dialog', 'close', { id: data.id }, null);
	});
	container.appendChild(custom);

	return container;
}

JSDialog.pageMarginEntry = function (
	parentContainer: Element,
	data: any,
	builder: any,
): boolean {
	const element = createPageMarginEntryWidget(data, builder);
	parentContainer.appendChild(element);
	return false;
};
