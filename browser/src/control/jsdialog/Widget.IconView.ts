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
		JSDialog.OnDemandRenderer(
			builder,
			parentData.id,
			'iconview',
			entry.row,
			placeholder,
			entryContainer,
			entry.text,
		);
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

		entryContainer.addEventListener('contextmenu', function (e: Event) {
			$('#' + parentData.id + ' .ui-iconview-entry').each(function () {
				$(this).removeClass('selected');
				this.setAttribute('aria-selected', 'false');
			});

			builder.callback('iconview', 'select', parentData, entry.row, builder);
			$(entryContainer).addClass('selected');
			entryContainer.setAttribute('aria-selected', 'true');

			builder.callback(
				'iconview',
				'contextmenu',
				parentData,
				entry.row,
				builder,
			);
			e.preventDefault();
		});

		if (!singleClick) {
			$(entryContainer).dblclick(function () {
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
	builder: JSBuilder,
) {
	const commonContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-window',
		parentContainer,
	);
	commonContainer.id = data.id;

	const container = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview',
		commonContainer,
	);
	container.id = data.id + '-iconview';

	container.setAttribute('role', 'listbox');

	if (data.labelledBy)
		container.setAttribute('aria-labelledby', data.labelledBy);

	if (data.isExpandable === true) {
		const button = document.createElement('button');
		button.id = data.id + '-button';
		button.className = 'ui-content unobutton ui-iconview-expander-button';
		commonContainer.appendChild(button);

		const buttonImage = window.L.DomUtil.create('img', '', button);
		app.LOUtil.setImage(buttonImage, 'lc_searchnext.svg', builder.map);

		button.onclick = () => {
			// the iconview in the dropdown should not have the expander button
			const isExpandable = data.isExpandable;
			data.isExpandable = false;

			JSDialog.OpenDropdown(
				data.id,
				commonContainer,
				[{ type: 'json', content: data }],
				// TODO: below we need custom callback which will translate used windowId to the original
				// windowId of the "builder" instance from this scope (numric value)
				builder._defaultCallbackHandlerSendMessage.bind(builder),
			);
			bIsExpanded = true;
			data.isExpandable = isExpandable;
		};

		container._onDropDown = function (opened: boolean) {
			if (opened) {
				app.layoutingService.appendLayoutingTask(() => {
					app.layoutingService.appendLayoutingTask(() => {
						const expander = JSDialog.GetDropdown(data.id);
						if (!expander) {
							app.console.error(
								'iconview._onDropDown: expander missing: "' + data.id + '"',
							);
							return;
						}
						const overlay = expander.parentNode;
						overlay.style.position = 'fixed';
						overlay.style.zIndex = '20000';
						commonContainer.appendChild(overlay);
					});
				});
			}
		};
		commonContainer._onDropDown = container._onDropDown;
	}

	const disabled = data.enabled === false;
	if (disabled) window.L.DomUtil.addClass(container, 'disabled');

	for (const i in data.entries) {
		_iconViewEntry(container, data, data.entries[i], builder);
	}

	const updateAllIndexes = () => {
		// Example: if gridTemplateColumns = "96px 96px 96px"
		// Step 1: Split the string by spaces:           ["96px", "96px", "96px"]
		// Step 2: Remove any empty entries (if any):    ["96px", "96px", "96px"]
		// Step 3: The length of this array is the number of columns in the grid.
		const gridTemplateColumns = getComputedStyle(container).gridTemplateColumns;
		const columns = gridTemplateColumns.split(' ').filter(Boolean).length;

		if (columns > 0) {
			const entries = container.querySelectorAll('.ui-iconview-entry');
			entries.forEach((entry: HTMLElement, flatIndex: number) => {
				const row = Math.floor(flatIndex / columns);
				const column = flatIndex % columns;
				entry.setAttribute('index', row + ':' + column);
			});
		}
	};

	// close dropdown when the window is resized. this
	// is to prevent dropdown from hanging in the corner
	// when the overflowgroups collapse displacing the
	// underlying iconview.
	let bIsExpanded = false;

	// update indexes on resize
	const resizeObserver = new ResizeObserver(() => {
		updateAllIndexes();
		if (bIsExpanded) JSDialog.CloseDropdown(data.id);
	});
	resizeObserver.observe(container);

	// Do not animate on creation - eg. when opening sidebar with icon view it might move the app
	const firstSelected = $(container).children('.selected').get(0);
	if (firstSelected) {
		const offsetTop = firstSelected.offsetTop;
		container.scrollTop = offsetTop;
	}

	container.onSelect = (position: number) => {
		$(container)
			.children('.selected')
			.each(function () {
				$(this).removeClass('selected');
				this.setAttribute('aria-selected', 'false');
			});

		const entry =
			container.children.length > position
				? container.children[position]
				: null;

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
				container.scrollTop = offsetTop;
			}
		} else if (position != -1)
			app.console.warn(
				'not found entry: "' + position + '" in: "' + container.id + '"',
			);
	};

	container.updateRenders = (pos: number) => {
		const dropdown = container.querySelectorAll(
			'.ui-iconview-entry, .ui-iconview-separator',
		);
		if (dropdown[pos]) {
			let container = dropdown[pos];
			const entry = data.entries[pos];
			const image = builder.rendersCache[data.id].images[pos];
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
		}
	};

	JSDialog.KeyboardGridNavigation(container);
	container.addEventListener('keydown', function (e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ' && e.code !== 'Space') return;

		const active = document.activeElement as HTMLElement;
		if (!active || !active.classList.contains('ui-iconview-entry')) return;

		const iconViewEntries = Array.from(
			container.querySelectorAll('.ui-iconview-entry'),
		);
		const selectedIndex = iconViewEntries.indexOf(active);

		if (selectedIndex === -1) return;

		if (e.key === ' ' || e.code === 'Space')
			builder.callback('iconview', 'select', data, selectedIndex, builder);
		else if (e.key === 'Enter')
			builder.callback('iconview', 'activate', data, selectedIndex, builder);
	});

	// ensures that aria-selected is updated on initial focus on iconview entries
	commonContainer.addEventListener('focusin', function (e: FocusEvent) {
		const target = e.target as HTMLElement;

		if (
			!target.classList.contains('ui-iconview-entry') ||
			target.getAttribute('aria-selected') === 'true'
		)
			return;

		// remove aria-selected from previously selected entry
		const previouslySelected = container.querySelector(
			'.ui-iconview-entry[aria-selected="true"]',
		);
		if (previouslySelected) {
			previouslySelected.setAttribute('aria-selected', 'false');
		}

		// set aria-selected on focused entry
		target.setAttribute('aria-selected', 'true');
	});

	commonContainer.updateRenders = container.updateRenders;
	commonContainer.onSelect = container.onSelect;
	return false;
};
