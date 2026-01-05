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
 * JSDialog.Listbox - listbox widget
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'listbox',
 *     text: 'Entries: ',
 *     entries: [
 *         'First Entry',
 *         'Second Entry',
 *         'Third Entry'
 *     ],
 *     selectedEntries: [ '0' ]
 * }
 */

declare var JSDialog: any;

JSDialog.listbox = function (
	parentContainer: Element,
	data: ListBoxWidget,
	builder: JSBuilder,
) {
	let title: string = data.text ? data.text : '';
	let selectedEntryIsString = false;

	if (data.selectedEntries) {
		selectedEntryIsString = isNaN(parseInt(data.selectedEntries[0] as any));
		if (title && title.length) {
			// pass
		} else if (selectedEntryIsString) {
			title = builder._cleanText(data.selectedEntries[0] as string);
		} else if (
			data.entries &&
			data.entries.length > (data.selectedEntries[0] as number)
		) {
			title = data.entries[data.selectedEntries[0] as number];
		}
	}
	title = builder._cleanText(title);

	const container = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-listbox-container ',
		parentContainer,
	);
	container.id = data.id;

	const listbox = window.L.DomUtil.create(
		'select',
		builder.options.cssClass + ' ui-listbox ',
		container,
	);
	listbox.id = data.id + '-input';

	JSDialog.SetupA11yLabelForLabelableElement(
		parentContainer,
		listbox,
		data,
		builder,
	);

	const listboxArrow = window.L.DomUtil.create(
		'span',
		builder.options.cssClass + ' ui-listbox-arrow',
		container,
	);
	listboxArrow.id = 'listbox-arrow-' + data.id;
	listboxArrow.onclick = function () {
		listbox.showPicker();
	};

	if (data.enabled === false) {
		container.disabled = true;
		listbox.disabled = true;
		container.setAttribute('disabled', 'true');
	}

	JSDialog.SynchronizeDisabledState(container, [listbox]);

	$(listbox).change(() => {
		if ($(listbox).val())
			builder.callback(
				'combobox',
				'selected',
				data,
				$(listbox).val() + ';' + $(listbox).children('option:selected').text(),
				builder,
			);
	});

	let hasSelectedEntry = false;
	let index: any;

	if (typeof data.entries === 'object') {
		for (index in data.entries) {
			let isSelected = false;
			const currEntryIsTitle = data.entries[index] == title;

			const isCurrentlySelectedEntry =
				data.selectedEntries && index == data.selectedEntries[0];

			const currStringEntryIsSelectedEntry =
				data.selectedEntries &&
				selectedEntryIsString &&
				data.entries[index] === data.selectedEntries[0];

			if (
				isCurrentlySelectedEntry ||
				currStringEntryIsSelectedEntry ||
				currEntryIsTitle
			) {
				isSelected = true;
			}

			const option = window.L.DomUtil.create('option', '', listbox);
			option.value = index;
			option.innerText = data.entries[index];
			if (isSelected) {
				option.selected = true;
				hasSelectedEntry = true;
			}
		}
	}

	// no selected entry; set the visible value to empty string
	// unless the font is not included in the entries
	if (!hasSelectedEntry) {
		if (title) {
			const newOption = window.L.DomUtil.create('option', '', listbox);
			newOption.value = ++index;
			newOption.innerText = title;
			newOption.selected = true;
		} else {
			$(listbox).val('');
		}
	}

	return false;
};
