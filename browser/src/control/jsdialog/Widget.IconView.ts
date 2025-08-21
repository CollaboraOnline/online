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
	const img = L.DomUtil.create('img', builder.options.cssClass, parent);
	if (image) img.src = image;

	if (entryData.text) {
		img.alt = entryData.text;
	} else if (entryData.tooltip) {
		img.alt = entryData.tooltip;
	} else {
		img.alt = '';
	}

	if (entryData.tooltip) img.title = entryData.tooltip;
	else img.title = entryData.text;
}

function _createEntryText(parent: HTMLElement, entryData: IconViewEntry) {
	// Add text below Icon
	L.DomUtil.addClass(parent, 'icon-view-item-container');
	const placeholder = L.DomUtil.create(
		'span',
		'ui-iconview-entry-title',
		parent,
	);
	placeholder.innerText = entryData.text;
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

	//id is needed to find the element to regain focus after widget is updated. see updateWidget in Control.JSDialogBuilder.js
	entryContainer.id = parentData.id + '_' + entry.row;

	// By default `aria-presed` should be false
	entryContainer.setAttribute('aria-pressed', 'false');

	if (entry.selected && entry.selected === true) {
		$(entryContainer).addClass('selected');
		entryContainer.setAttribute('aria-pressed', 'true');
	}

	if (entry.ondemand) {
		const placeholder = L.DomUtil.create(
			'span',
			builder.options.cssClass,
			entryContainer,
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

			$('#' + parentData.id + ' .ui-iconview-entry').removeClass('selected');
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
			$('#' + parentData.id + ' .ui-iconview-entry').removeClass('selected');
			builder.callback('iconview', 'select', parentData, entry.row, builder);
			$(entryContainer).addClass('selected');
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
	const commonContainer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-window',
		parentContainer,
	);
	commonContainer.id = data.id;

	const container = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview',
		commonContainer,
	);
	container.id = data.id + '-iconview';

	// but there's another problem. iconview is not just used by the notebookbar,
	// but also by the sidebar, and the sidebar is now showing these buttons which is
	// wierd. so maybe removing the scrools is not that bad of an idea and instead
	// i should focus on making the stylesview expandable first.
	//
	// there would be some specification needed then, things like which iconview
	// is expandable and which is not and when. and why the hell is this conditional
	// not working. in the third call to this iconview constructor, there's
	// no isExpandable property passed in, i wonder why.

	if ((data as any).isExpandable === 'true') {
		builder.build(
			commonContainer,
			[
				{
					id: data.id + '-btn',
					type: 'container',
					children: [
						{
							id: data.id + '-expand',
							type: 'customtoolitem',
							text: _('Expand'),
							icon: 'lc_searchnext.svg',
						},
					],
					vertical: 'true',
				} as WidgetJSON,
			],
			false,
		);
	} else {
		builder.build(
			commonContainer,
			[
				{
					id: data.id + '-btn',
					type: 'container',
					children: [
						{
							id: data.id + '-scroll-up',
							type: 'customtoolitem',
							text: _('Scroll up'),
							icon: 'lc_searchprev.svg',
						},
						// these two will be handled internally, the third one
						// would come from the iconview, it tells us what command
						// to use for the externalInterface
						{
							id: data.id + '-scroll-down',
							type: 'customtoolitem',
							text: _('Scroll down'),
							icon: 'lc_searchnext.svg',
						},
						{
							id: data.id + '-external-ui-button',
							type: 'customtoolitem',
							text: _('Style list'),
							command: (data as any).externalUICmd,
							icon: 'lc_stylepreviewmore.svg',
						},
					],
					vertical: 'true',
				} as WidgetJSON,
			],
			false,
		);

		const scroll_up = document.getElementById(data.id + '-scroll-up');
		if (scroll_up) {
			scroll_up.onclick = function () {
				app.dispatcher.dispatch('scrolliconviewup', container.id);
			};
		}

		const scroll_down = document.getElementById(data.id + '-scroll-down');
		if (scroll_down) {
			scroll_down.onclick = function () {
				app.dispatcher.dispatch('scrolliconviewdown', container.id);
			};
		}
	}

	const disabled = data.enabled === false;
	if (disabled) L.DomUtil.addClass(container, 'disabled');

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

	// update indexes on resize
	const resizeObserver = new ResizeObserver(() => {
		updateAllIndexes();
	});
	resizeObserver.observe(container);

	// Do not animate on creation - eg. when opening sidebar with icon view it might move the app
	const firstSelected = $(container).children('.selected').get(0);
	if (firstSelected) {
		const offsetTop = firstSelected.offsetTop;
		container.scrollTop = offsetTop;
	}

	container.onSelect = (position: number) => {
		$(container).children('.selected').removeClass('selected');

		const entry =
			container.children.length > position
				? container.children[position]
				: null;

		if (entry) {
			L.DomUtil.addClass(entry, 'selected');
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
			console.warn(
				'not found entry: "' + position + '" in: "' + container.id + '"',
			);
	};

	// this is the function which adds rendered images to the iconview
	// through the calls to _createEntryText. this should be linked with
	// the new parent that we are creating. looking around the code and
	// asking, wait... how does that happen helps
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
				container = L.DomUtil.create(
					'div',
					builder.options.cssClass,
					dropdown[pos],
				);
			}

			_createEntryImage(container, builder, entry, image);
			if (hasText) _createEntryText(container, entry);
		}
	};

	// this is never called, but why?

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

	commonContainer.updateRenders = container.updateRenders;
	commonContainer.onSelect = container.onSelect;

	return false;
};
