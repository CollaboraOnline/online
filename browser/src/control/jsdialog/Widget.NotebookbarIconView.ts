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
	const iconviewlistdata = {
		id: data.id + '-iconview-list',
		type: 'iconviewlist',
		children: [data],
	};
	return JSDialog.notebookbarIconViewList(
		parentContainer,
		iconviewlistdata,
		builder,
	);
};

JSDialog.notebookbarIconViewList = function (
	parentContainer: Element,
	data: IconViewListJSON,
	builder: JSBuilder,
) {
	const commonContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-window',
		parentContainer,
	);
	commonContainer.id = data.id;

	for (let i = 0; i < data.children.length; i++) {
		JSDialog.iconView(commonContainer, data.children[i], builder);
	}

	const iconViews = commonContainer.querySelectorAll('.ui-iconview');

	const buttonsContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-buttons-container',
		parentContainer,
	);
	buttonsContainer.id = data.id + '-buttons-container';

	const scrollUpCallback = () => {
		iconViews[0].scrollBy({
			top: -iconViews[0].offsetHeight,
			behavior: 'smooth',
		});
	};

	const scrollDownCallback = () => {
		iconViews[0].scrollBy({
			top: iconViews[0].offsetHeight,
			behavior: 'smooth',
		});
	};

	const iconViewListCallback = (
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
			data.children[0].id,
			commonContainer,
			_getDropdownContent(data.children[0]),
			iconViewListCallback,
		);
		bIsExpanded = true;
	};

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.children[0].id + '-scroll-up',
		'ui-iconview-scroll-up-button',
		'lc_searchprev.svg',
		_('Scroll up'),
		builder,
		scrollUpCallback,
	);

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.children[0].id + '-scroll-down',
		'ui-iconview-scroll-down-button',
		'lc_searchnext.svg',
		_('Scroll down'),
		builder,
		scrollDownCallback,
	);

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.children[0].id + '-expand',
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
					const expander = JSDialog.GetDropdown(data.children[0].id);
					if (!expander) {
						app.console.error(
							'iconview._onDropDown: expander missing: "' +
								data.children[0].id +
								'"',
						);
						return;
					}
					const overlay = expander.parentNode;
					overlay.style.position = 'fixed';
					overlay.style.zIndex = '20000';
					commonContainer.appendChild(overlay);
					//for (let i = 0; i < data.items.length; i++) {
					//	const item = data.items[i];
					//	const iconview = expander.querySelector("[id='" + item.id + "']");
					//	if (item && iconview) {
					//		const label = window.L.DomUtil.create(
					//			'span',
					//			builder.options.cssClass,
					//		);
					//		label.textContent = item.label;
					//		iconview.parentNode.insertBefore(label, iconview);
					//	}
					//}
				});
			});
		}
	};

	const updateAllIndexes = () => {
		// Example: if gridTemplateColumns = "96px 96px 96px"
		// Step 1: Split the string by spaces:           ["96px", "96px", "96px"]
		// Step 2: Remove any empty entries (if any):    ["96px", "96px", "96px"]
		// Step 3: The length of this array is the number of columns in the grid.
		const gridTemplateColumns = getComputedStyle(
			iconViews[0],
		).gridTemplateColumns;
		const columns = gridTemplateColumns.split(' ').filter(Boolean).length;

		if (columns > 0) {
			const entries = iconViews[0].querySelectorAll('.ui-iconview-entry');
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
	resizeObserver.observe(commonContainer);

	// Do not animate on creation - eg. when opening sidebar with icon view it might move the app
	const firstSelected = $(iconViews[0]).children('.selected').get(0);
	if (firstSelected) {
		const offsetTop = firstSelected.offsetTop;
		iconViews[0].scrollTop = offsetTop;
	}

	commonContainer.updateRenders = iconViews[0].updateRenders = (
		pos: number,
	) => {
		iconViews[0].updateRendersImpl(pos, data.children[0].id, iconViews[0]);

		// also update the dropdown (if any);
		const dropdownContainer = JSDialog.GetDropdown(data.children[0].id);
		if (dropdownContainer)
			iconViews[0].updateRendersImpl(
				pos,
				data.children[0].id,
				dropdownContainer,
			);
	};

	iconViews[0].updateSelection = (position: number) => {
		iconViews[0].updateSelectionImpl(position, data.children[0]);
	};

	/*
		we need to override `iconview.requestRenders` because `iconview` is created
		with an `id = data.id + '-iconview'` which core doesn't recoganize. so
		we pass the original widget's id while requesting icons.
	*/
	iconViews[0].requestRenders = (
		entry: IconViewEntry,
		placeholder: Element,
		entryContainer: Element,
	) => {
		iconViews[0].requestRendersImpl(
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
	iconViews[0].builderCallback = (
		objectType: string,
		eventType: string,
		entry: any,
		builder: JSBuilder,
	) => {
		builder.callback(objectType, eventType, data.children[0], entry, builder);
	};

	commonContainer.onSelect = iconViews[0].onSelect;
	return false;
};
