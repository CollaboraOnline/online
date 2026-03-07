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
	opensPopup?: boolean,
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

	if (opensPopup) button.setAttribute('aria-haspopup', 'dialog');

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

function _getDropdownContent(data: IconViewListJSON, builder: JSBuilder) {
	const dropdownContent: Array<MenuDefinition> = [];
	for (const child of data.children) {
		// only first was visible in the notebookbar
		child.visible = true;

		// get up-to-date copy from model, TODO: more clean way to do that
		const childData = (
			builder?.options?.mobileWizard as any
		)?.getWidgetSnapshot(child.id);

		dropdownContent.push({
			id: 'dropdown-entry-' + child.id,
			type: 'json',
			content: childData ? childData : undefined,
		});
	}

	if (data.children.length === 1 && data.children[0].id === 'stylesview') {
		dropdownContent.push(
			{
				id: 'dropdown-entry-stylesview',
				type: 'json',
				content: {
					type: 'separator',
					id: 'iconview-button-separator',
					orientation: 'horizontal',
				} as SeparatorWidgetJSON,
			},
			{
				id: 'dropdown-entry-more',
				type: 'json',
				content: {
					id: 'format-style-list-dialog',
					type: 'customtoolitem',
					text: _('Open Styles Sidebar'),
					command: 'showstylelistdeck',
					icon: 'lc_stylepreviewmore.svg',
				} as ToolItemWidgetJSON,
			},
		);
	}

	return dropdownContent;
}

JSDialog.notebookbarIconViewList = function (
	parentContainer: Element,
	data: IconViewListJSON,
	builder: JSBuilder,
) {
	const rootNode = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-root',
		parentContainer,
	);
	rootNode.id = data.id;

	const commonContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-window',
		rootNode,
	);
	commonContainer.id = data.id + '-window';

	// we insert into DOM only the first iconview (rest is accessible only in the dropdown)
	JSDialog.iconView(commonContainer, data.children[0], builder);
	// builder will not do it for us - we manage children (return is false in this handler)
	builder.postProcess(commonContainer, data.children[0]);

	const iconViews = commonContainer.querySelectorAll('.ui-iconview');
	const iconview = iconViews.length ? iconViews[0] : null;
	if (!iconview) {
		app.console.error('IconView cannot be created: ' + data.id);
		return false;
	}

	const buttonsContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-buttons-container',
		rootNode,
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
			_getDropdownContent(data, builder),
			notebookbarIconViewCallback,
		);
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
		true /* opensPopup */,
	);

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

	// update indexes on resize
	const resizeObserver = new ResizeObserver(() => {
		updateAllIndexes();
		const dropdown = JSDialog.GetDropdown(data.id);
		if (dropdown) JSDialog.CloseDropdown(data.id);
	});

	resizeObserver.observe(rootNode);

	// Do not animate on creation - eg. when opening sidebar with icon view it might move the app
	const firstSelected = $(iconview).children('.selected').get(0);
	if (firstSelected) {
		const offsetTop = firstSelected.offsetTop;
		iconview.scrollTop = offsetTop;
	}

	rootNode.updateRenders = iconview.updateRenders = (pos: number) => {
		iconview.updateRendersImpl(pos, data.children[0].id, iconview);

		// also update the dropdown (if any);
		const dropdownContainer = JSDialog.GetDropdown(data.id);
		if (dropdownContainer)
			iconview.updateRendersImpl(pos, data.children[0].id, dropdownContainer);
	};

	rootNode.updateSelection = (position: number) => {
		iconview.updateSelectionImpl(position, data.children[0]);
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
		iconview.requestRendersImpl(
			data.children[0].id,
			entry,
			placeholder,
			entryContainer,
		);
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
		builder.callback(objectType, eventType, data.children[0], entry, builder);
	};

	commonContainer.onSelect = iconview.onSelect;
	return false;
};
