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
 * JSDialog.IconView - icon view widget
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'iconview',
 *     singleclickactivate: true,
 *     entries: [
 *         { text: 'some text', tooltip: 'some tooltip', image: 'encoded png', selected: false }
 *     ]
 * }
 */

declare var JSDialog: any;

function _iconViewEntry(
	parentContainer: Element,
	parentData: IconViewJSON,
	entry: IconViewEntry,
	builder: any,
) {
	const disabled = parentData.enabled === false;

	if (entry.separator && entry.separator === true) {
		L.DomUtil.create(
			'hr',
			builder.options.cssClass + ' ui-iconview-separator',
			parentContainer,
		);
		return;
	}

	const entryContainer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-entry',
		parentContainer,
	);

	// By default `aria-presed` should be false
	entryContainer.setAttribute('aria-pressed', 'false');

	if (entry.selected && entry.selected === true) {
		$(entryContainer).addClass('selected');
		entryContainer.setAttribute('aria-pressed', 'true');
	}

	const icon = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-icon',
		entryContainer,
	);

	if (entry.ondemand) {
		const placeholder = L.DomUtil.create(
			'span',
			builder.options.cssClass,
			icon,
		);
		placeholder.innerText = entry.text;
		if (entry.tooltip) placeholder.title = entry.tooltip;
		else placeholder.title = entry.text;

		// Add tabindex attribute for accessibility, enabling keyboard navigation in the icon preview
		entryContainer.setAttribute('tabindex', '0');
		JSDialog.OnDemandRenderer(
			builder,
			parentData.id,
			'iconview',
			entry.row,
			placeholder,
			icon,
			entry.text,
		);
	} else {
		const img = L.DomUtil.create('img', builder.options.cssClass, icon);
		if (entry.image) img.src = entry.image;
		img.alt = entry.text;
		if (entry.tooltip) img.title = entry.tooltip;
		else img.title = entry.text;
	}

	if (!disabled) {
		const singleClick = parentData.singleclickactivate === true;
		$(entryContainer).click(function () {
			$('#' + parentData.id + ' .ui-treeview-entry').removeClass('selected');
			builder.callback('iconview', 'select', parentData, entry.row, builder);
			if (singleClick) {
				builder.callback(
					'iconview',
					'activate',
					parentData,
					entry.row,
					builder,
				);
			}
		});
		if (!singleClick) {
			$(entryContainer).dblclick(function () {
				$('#' + parentData.id + ' .ui-treeview-entry').removeClass('selected');
				builder.callback(
					'iconview',
					'activate',
					parentData,
					entry.row,
					builder,
				);
			});
		}
		builder._preventDocumentLosingFocusOnClick(entryContainer);
	}
}

JSDialog.iconView = function (
	parentContainer: Element,
	data: IconViewJSON,
	builder: any,
) {
	const container = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview',
		parentContainer,
	);
	container.id = data.id;

	const disabled = data.enabled === false;
	if (disabled) L.DomUtil.addClass(container, 'disabled');

	for (const i in data.entries) {
		_iconViewEntry(container, data, data.entries[i], builder);
	}

	const firstSelected = $(container).children('.selected').get(0);
	const blockOption = JSDialog._scrollIntoViewBlockOption('nearest');
	if (firstSelected)
		firstSelected.scrollIntoView({
			behavior: 'smooth',
			block: blockOption,
			inline: 'nearest',
		});

	container.onSelect = (position: number) => {
		$(container).children('.selected').removeClass('selected');

		const entry =
			container.children.length > position
				? container.children[position]
				: null;

		if (entry) {
			L.DomUtil.addClass(entry, 'selected');
			const blockOption = JSDialog._scrollIntoViewBlockOption('nearest');
			entry.scrollIntoView({
				behavior: 'smooth',
				block: blockOption,
				inline: 'nearest',
			});
		} else if (position != -1)
			console.warn(
				'not found entry: "' + position + '" in: "' + container.id + '"',
			);
	};

	container.updateRenders = (pos: number) => {
		const dropdown = container.querySelectorAll('.ui-iconview-entry');
		if (dropdown[pos]) {
			dropdown[pos].innerHTML = '';
			let container = dropdown[pos];

			if (data.entries[pos].text && data.textWithIconEnabled) {
				container = L.DomUtil.create(
					'div',
					builder.options.cssClass,
					dropdown[pos],
				);
			}
			const img = L.DomUtil.create('img', '', container);
			img.src = builder.rendersCache[data.id].images[pos];

			const entry = data.entries[pos];
			img.alt = entry.text;
			if (entry.tooltip) img.title = entry.tooltip;
			else img.title = entry.text;

			if (data.entries[pos].text && data.textWithIconEnabled) {
				// Add text below Icon
				L.DomUtil.addClass(container, 'icon-view-item-container');
				const placeholder = L.DomUtil.create(
					'span',
					'ui-iconview-entry-title',
					container,
				);
				placeholder.innerText = entry.text;
			}
		}
	};

	return false;
};
