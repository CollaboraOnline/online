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

function _createEntryImage(
	parent: HTMLElement,
	builder: JSBuilder,
	entryData: IconViewEntry,
	image: string,
) {
	const img = window.L.DomUtil.create('img', builder.options.cssClass, parent);
	if (image) img.src = image;

	if (entryData.text) {
		img.alt = entryData.text;
	} else if (entryData.tooltip) {
		img.alt = entryData.tooltip;
	} else {
		img.alt = '';
	}

	if (entryData.tooltip) img.title = entryData.tooltip;
	else if (entryData.text) img.title = entryData.text;
	else img.title = '';
}

function _createEntryText(parent: HTMLElement, entryData: IconViewEntry) {
	// Add text below Icon
	window.L.DomUtil.addClass(parent, 'icon-view-item-container');
	const placeholder = window.L.DomUtil.create(
		'span',
		'ui-iconview-entry-title',
		parent,
	);
	placeholder.innerText = entryData.text ? entryData.text : '';
}

function _iconViewEntry(
	parentContainer: Element,
	parentData: IconViewJSON,
	entry: IconViewEntry,
	builder: JSBuilder,
) {
	const disabled = parentData.enabled === false;
	const hasText = entry.text && parentData.textWithIconEnabled;

	if (entry.separator && entry.separator === true) {
		window.L.DomUtil.create(
			'hr',
			builder.options.cssClass + ' ui-iconview-separator',
			parentContainer,
		);
		return;
	}

	const entryContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-entry',
		parentContainer,
	);

	//id is needed to find the element to regain focus after widget is updated. see updateWidget in Control.JSDialogBuilder.js
	entryContainer.id = parentData.id + '_' + entry.row;

	entryContainer.setAttribute('role', 'option');
	// By default `aria-selected` should be false
	entryContainer.setAttribute('aria-selected', 'false');

	if (entry.selected && entry.selected === true) {
		$(entryContainer).addClass('selected');
		entryContainer.setAttribute('aria-selected', 'true');
	}

	if (entry.ondemand) {
		const placeholder = window.L.DomUtil.create(
			'span',
			builder.options.cssClass,
			entryContainer,
		);
		placeholder.innerText = entry.text ? entry.text : '';
		if (entry.tooltip) placeholder.title = entry.tooltip;
		else if (entry.text) placeholder.title = entry.text;
		else placeholder.title = '';

		// Add tabindex attribute for accessibility, enabling keyboard navigation in the icon preview
		entryContainer.setAttribute('tabindex', '0');
		(parentContainer as any).requestRenders(entry, placeholder, entryContainer);
	} else {
		_createEntryImage(entryContainer, builder, entry, entry.image);
	}

	if (hasText) _createEntryText(entryContainer, entry);

	if (!disabled) {
		const singleClick = parentData.singleclickactivate === true;
		$(entryContainer).click(function () {
			entryContainer.setAttribute('tabindex', '0');
			entryContainer.focus();
			//avoid re-selecting already selected entry
			if ($(entryContainer).hasClass('selected')) return;

			$('#' + parentData.id + ' .ui-iconview-entry').each(function () {
				$(this).removeClass('selected');
				this.setAttribute('aria-selected', 'false');
			});

			(parentContainer as any).builderCallback(
				'iconview',
				'select',
				entry.row,
				builder,
			);
			$(entryContainer).addClass('selected');
			entryContainer.setAttribute('aria-selected', 'true');

			if (singleClick) {
				(parentContainer as any).builderCallback(
					'iconview',
					'activate',
					entry.row,
					builder,
				);
			}
		});

		entryContainer.addEventListener('contextmenu', function (e: Event) {
			$('#' + parentData.id + ' .ui-iconview-entry').each(function () {
				$(this).removeClass('selected');
				this.setAttribute('aria-selected', 'false');
			});

			(parentContainer as any).builderCallback(
				'iconview',
				'select',
				entry.row,
				builder,
			);
			$(entryContainer).addClass('selected');
			entryContainer.setAttribute('aria-selected', 'true');

			(parentContainer as any).builderCallback(
				'iconview',
				'contextmenu',
				entry.row,
				builder,
			);
			e.preventDefault();
		});

		if (!singleClick) {
			$(entryContainer).dblclick(function () {
				(parentContainer as any).builderCallback(
					'iconview',
					'activate',
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
	builder: JSBuilder,
) {
	const iconview = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview',
		parentContainer,
	);

	iconview.id = data.id;
	iconview.setAttribute('role', 'listbox');

	if (data.labelledBy)
		iconview.setAttribute('aria-labelledby', data.labelledBy);

	const disabled = data.enabled === false;
	if (disabled) window.L.DomUtil.addClass(iconview, 'disabled');

	// Do not animate on creation - eg. when opening sidebar with icon view it might move the app
	const firstSelected = $(iconview).children('.selected').get(0);
	if (firstSelected) {
		const offsetTop = firstSelected.offsetTop;
		iconview.scrollTop = offsetTop;
	}

	iconview.updateSelectionImpl = (
		position: number,
		iconViewData: IconViewJSON,
	) => {
		for (const entry of iconViewData.entries) {
			entry.selected = false;
		}

		if (iconViewData.entries.length > position) {
			iconViewData.entries[position].selected = true;
		}
	};

	iconview.updateSelection = (position: number) => {
		iconview.updateSelectionImpl(position, data);
	};

	iconview.onSelect = (position: number) => {
		$(iconview)
			.children('.selected')
			.each(function () {
				$(this).removeClass('selected');
				this.setAttribute('aria-selected', 'false');
			});

		const entry =
			iconview.children.length > position ? iconview.children[position] : null;

		iconview.updateSelection(position);

		if (entry) {
			window.L.DomUtil.addClass(entry, 'selected');
			entry.setAttribute('aria-selected', 'true');

			if (builder.options.useScrollAnimation !== false) {
				const blockOption = JSDialog.ScrollIntoViewBlockOption('nearest');
				entry.scrollIntoView({
					behavior: 'smooth',
					block: blockOption,
					inline: 'nearest',
				});
			} else {
				const offsetTop = entry.offsetTop;
				iconview.scrollTop = offsetTop;
			}
		} else if (position != -1)
			app.console.warn(
				'not found entry: "' + position + '" in: "' + iconview.id + '"',
			);
	};

	iconview.requestRendersImpl = (
		id: string,
		entry: IconViewEntry,
		placeholder: Element,
		entryContainer: Element,
	) => {
		JSDialog.OnDemandRenderer(
			builder,
			id,
			'iconview',
			entry.row,
			placeholder,
			entryContainer,
			entry.text,
		);
	};

	iconview.requestRenders = (
		entry: IconViewEntry,
		placeholder: Element,
		entryContainer: Element,
	) => {
		iconview.requestRendersImpl(data.id, entry, placeholder, entryContainer);
	};

	iconview.updateRendersImpl = (
		pos: number,
		id: string,
		where: HTMLElement,
	) => {
		const dropdown = where.querySelectorAll(
			'.ui-iconview-entry, .ui-iconview-separator',
		);
		if (dropdown[pos]) {
			let container = dropdown[pos] as HTMLElement;
			const entry = data.entries[pos];
			const image = builder.rendersCache[id].images[pos];
			const hasText = entry.text && data.textWithIconEnabled;

			container.replaceChildren();
			if (hasText) {
				container = window.L.DomUtil.create(
					'div',
					builder.options.cssClass,
					dropdown[pos],
				);
			}

			_createEntryImage(container, builder, entry, image);
			if (hasText) _createEntryText(container, entry);
		} else {
			app.console.debug('IconView: not found entry: ' + pos);
		}
	};

	iconview.builderCallback = (
		objectType: string,
		eventType: string,
		entryData: any,
		builder: JSBuilder,
	) => {
		builder.callback(objectType, eventType, data, entryData, builder);
	};

	iconview.updateRenders = (pos: number) => {
		iconview.updateRendersImpl(pos, data.id, iconview);
	};

	JSDialog.KeyboardGridNavigation(iconview);
	iconview.addEventListener('keydown', function (e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ' && e.code !== 'Space') return;

		const active = document.activeElement as HTMLElement;
		if (!active || !active.classList.contains('ui-iconview-entry')) return;

		const iconViewEntries = Array.from(
			iconview.querySelectorAll('.ui-iconview-entry'),
		);
		const selectedIndex = iconViewEntries.indexOf(active);

		if (selectedIndex === -1) return;

		if (e.key === ' ' || e.code === 'Space')
			iconview.builderCallback('iconview', 'select', selectedIndex, builder);
		else if (e.key === 'Enter')
			iconview.builderCallback('iconview', 'activate', selectedIndex, builder);
	});

	// ensures that aria-selected is updated on initial focus on iconview entries
	iconview.addEventListener('focusin', function (e: FocusEvent) {
		const target = e.target as HTMLElement;

		/*
		 * when the iconview is shown in a dropdown and is the first
		 * child of the dropdown, it gets selected by default which
		 * is not desirable as that shows a blue frame around the
		 * iconview.
		 */
		if (target === iconview) {
			target.setAttribute('tabindex', '-1');
			return;
		}

		if (
			!target.classList.contains('ui-iconview-entry') ||
			target.getAttribute('aria-selected') === 'true'
		)
			return;

		// remove aria-selected from previously selected entry
		const previouslySelected = iconview.querySelector(
			'.ui-iconview-entry[aria-selected="true"]',
		);
		if (previouslySelected) {
			previouslySelected.setAttribute('aria-selected', 'false');
		}

		// set aria-selected on focused entry
		target.setAttribute('aria-selected', 'true');
	});

	app.layoutingService.appendLayoutingTask(() => {
		for (const i in data.entries) {
			_iconViewEntry(iconview, data, data.entries[i], builder);
		}

		// Do not animate on creation - eg. when opening sidebar with icon view it might move the app
		const firstSelected = $(iconview).children('.selected').get(0);
		if (firstSelected) {
			const offsetTop = firstSelected.offsetTop;
			iconview.scrollTop = offsetTop;
		}
	});

	return false;
};
