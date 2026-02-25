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

declare var JSDialog: any;

function _createButtonForNotebookbarIconview(
	parentContainer: Element,
	id: string,
	buttonClass: string,
	icon: string,
	ariaLabel: string,
	builder: JSBuilder,
	onClickCallback: any,
	accessibility?: NotebookbarAccessibilityDescriptor,
) {
	const container = window.L.DomUtil.create(
		'div',
		builder.options.cssClass +
			' unotoolbutton ui-content unospan no-label ui-iconview-button',
		parentContainer,
	);
	container.id = id;

	// create the button
	const button = window.L.DomUtil.create(
		'button',
		'ui-content unobutton ' + buttonClass,
		container,
	);
	button.id = id + '-button';
	if (accessibility?.combination) button.accessKey = accessibility?.combination;

	const a11yData: WidgetJSON = {
		id: id,
		type: 'iconview-button',
		aria: {
			label: ariaLabel,
		},
	};
	JSDialog.SetupA11yLabelForNonLabelableElement(button, a11yData, builder);

	// add the icon
	const buttonImage = window.L.DomUtil.create(
		'img',
		'ui-iconview-button-icon',
		button,
	);
	buttonImage.alt = '';
	app.LOUtil.setImage(buttonImage, icon, builder.map);

	// set the onclick callback
	button.onclick = onClickCallback;
}

function _getDropdownContent(data: any) {
	const dropdownContent = [{ type: 'json', content: data }];
	if (data.id === 'stylesview') {
		dropdownContent.push(
			{
				type: 'json',
				content: {
					type: 'separator',
					id: 'iconview-button-separator',
					orientation: 'horizontal',
				},
			},
			{
				type: 'json',
				content: {
					id: 'format-style-list-dialog',
					type: 'customtoolitem',
					text: _('Open Styles Sidebar'),
					command: 'showstylelistdeck',
					icon: 'lc_stylepreviewmore.svg',
				},
			},
		);
	}

	return dropdownContent;
}

JSDialog.notebookbarIconView = function (
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

	/*
		deep copy to not repeat id. below we override
		`iconview.requestRenders` and `iconview.updateRenders`
		because core knows this iconview by the id
		without `-iconview` at the end and thus any
		updates/requests should be sent with that `id`.
	*/
	let innerData: IconViewJSON | null = null;
	if (window.structuredClone) {
		try {
			innerData = window.structuredClone(data);
			innerData.id = innerData.id + '-iconview';
		} catch (e) {
			app.console.debug('NotebookbarIconView: ' + e);
			return false;
		}
	}

	// create the inner iconview
	JSDialog.iconView(commonContainer, innerData, builder);
	const iconview = commonContainer.querySelector('.ui-iconview') as any;

	// create the button's container
	const buttonsContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-buttons-container',
		parentContainer,
	);
	buttonsContainer.id = data.id + '-buttons-container';

	const scrollUpCallback = () => {
		iconview.scrollBy({
			top: -iconview.offsetHeight,
			behavior: 'smooth',
		});
	};

	const scrollDownCallback = () => {
		iconview.scrollBy({
			top: iconview.offsetHeight,
			behavior: 'smooth',
		});
	};

	const notebookbarIconViewCallback = (
		objectType: string,
		eventType: string,
		object: any,
		entry_data: string,
	) => {
		builder.callback(objectType, eventType, object, entry_data, builder);
		/*
			the dropdown can have controls to trigger dialogs
			or sidebars. when that happens, we want the dropdown
			to move out of our way.
		*/
		if (objectType !== 'iconview') JSDialog.CloseAllDropdowns();
	};

	const expanderCallback = () => {
		JSDialog.OpenDropdown(
			data.id,
			commonContainer,
			_getDropdownContent(data),
			notebookbarIconViewCallback,
		);
		bIsExpanded = true;
	};

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.id + '-scroll-up',
		'ui-iconview-scroll-up-button',
		'lc_searchprev.svg',
		_('Scroll up'),
		builder,
		scrollUpCallback,
	);

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.id + '-scroll-down',
		'ui-iconview-scroll-down-button',
		'lc_searchnext.svg',
		_('Scroll down'),
		builder,
		scrollDownCallback,
	);

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.id + '-expand',
		'ui-iconview-expander-button',
		'lc_iconviewexpander.svg',
		_('More options'),
		builder,
		expanderCallback,
		{ focusBack: true, combination: 'SD', de: null },
	);

	commonContainer.appendChild(buttonsContainer);

	commonContainer._onDropDown = function (opened: boolean) {
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

	const updateAllIndexes = () => {
		// Example: if gridTemplateColumns = "96px 96px 96px"
		// Step 1: Split the string by spaces:           ["96px", "96px", "96px"]
		// Step 2: Remove any empty entries (if any):    ["96px", "96px", "96px"]
		// Step 3: The length of this array is the number of columns in the grid.
		const gridTemplateColumns = getComputedStyle(iconview).gridTemplateColumns;
		const columns = gridTemplateColumns.split(' ').filter(Boolean).length;

		if (columns > 0) {
			const entries = iconview.querySelectorAll('.ui-iconview-entry');
			entries.forEach((entry: HTMLElement, flatIndex: number) => {
				const row = Math.floor(flatIndex / columns);
				const column = flatIndex % columns;
				entry.setAttribute('index', row + ':' + column);
			});
		}
	};

	/*
		close dropdown when the window is resized. this
		is to prevent dropdown from hanging in the corner
		when the overflowgroups collapse displacing the
		underlying iconview.
	*/
	let bIsExpanded = false;

	// update indexes on resize
	const resizeObserver = new ResizeObserver(() => {
		updateAllIndexes();
		if (bIsExpanded) JSDialog.CloseDropdown(data.id);
	});

	/*
	 * NOTE: `resizeObserver` observes the iconview, not the dropdown.
	 * and since the iconview grid is always max height (with overflow),
	 * height changes do not trigger the observer as only the container's
	 * height changes and it looks as if the iconview's dimentions
	 * changd.
	 */
	resizeObserver.observe(iconview);

	// Do not animate on creation - eg. when opening sidebar with icon view it might move the app
	const firstSelected = $(iconview).children('.selected').get(0);
	if (firstSelected) {
		const offsetTop = firstSelected.offsetTop;
		iconview.scrollTop = offsetTop;
	}

	commonContainer.updateRenders = iconview.updateRenders = (pos: number) => {
		iconview.updateRendersImpl(pos, data.id, iconview);

		// also update the dropdown (if any);
		const dropdownContainer = JSDialog.GetDropdown(data.id);
		if (dropdownContainer)
			iconview.updateRendersImpl(pos, data.id, dropdownContainer);
	};

	iconview.updateSelection = (position: number) => {
		iconview.updateSelectionImpl(position, data);
	};

	/*
		we need to override `iconview.requestRenders` because `iconview` is created
		with an `id = data.id + '-iconview'` which core doesn't recoganize. so
		we pass the original widget's id while requesting icons.
	*/
	iconview.requestRenders = (
		entry: IconViewEntry,
		placeholder: Element,
		entryContainer: Element,
	) => {
		iconview.requestRendersImpl(data.id, entry, placeholder, entryContainer);
	};

	/*
		we override this for the same reason for which we
		override `iconview.requestRenders` above.
	*/
	iconview.builderCallback = (
		objectType: string,
		eventType: string,
		entry: any,
		builder: JSBuilder,
	) => {
		builder.callback(objectType, eventType, data, entry, builder);
	};

	commonContainer.onSelect = iconview.onSelect;
	return false;
};
