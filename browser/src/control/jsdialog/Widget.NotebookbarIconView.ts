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
	builder: JSBuilder,
	onClickCallback: any,
) {
	const container = window.L.DomUtil.create(
		'div',
		builder.options.cssClass +
			' unotoolbutton ui-content unospan no-label ui-iconview-button',
		parentContainer,
	);
	container.id = id;

	// create the button
	const button = document.createElement('button');
	button.id = id + '-button';
	button.className = 'ui-content unobutton ' + buttonClass;
	container.appendChild(button);
	parentContainer.appendChild(container);

	// add the icon
	const buttonImage = window.L.DomUtil.create('img', '', button);
	buttonImage.className = 'ui-iconview-button-icon';
	app.LOUtil.setImage(buttonImage, icon, builder.map);

	// set the onclick callback
	button.onclick = onClickCallback;
}

function _getDropdownContent(iconviewsWrapper: IconViewWrapper) {
	 return Array.from(iconviewsWrapper.querySelectorAll('.ui-iconview'))
			.flatMap(item => {
				const itemData = (item as any).data;
				const baseElement = {
					type: 'json',
					content: itemData
				};
				if (itemData && itemData.id === 'stylesview') {
					return [
						baseElement,
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
						}
					];
				}
				return baseElement;
			});
}

JSDialog.notebookbarIconView = function (
	parentContainer: Element,
	data: IconViewJSON,
	builder: JSBuilder,
) {
	const iconviewlistdata = {
		id : data.id + 'list',
		type: 'iconviewlist',
		items: [data]
	}
	JSDialog.notebookbarIconViewList(parentContainer, iconviewlistdata, builder);
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
	const iconviewsWrapper = window.L.DomUtil.create(
		'div',
		builder.options.cssClass,
		commonContainer,
	);
	iconviewsWrapper.id = 'masterpage_icons-wrapper';
	for( let i = 0; i < data.items.length; i++)
			JSDialog.iconView(iconviewsWrapper, data.items[i], builder);

	const buttonsContainer = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview-buttons-container',
		commonContainer,
	);

	buttonsContainer.id = data.id + '-buttons-container';

	const scrollUpCallback = () => {
		iconviewsWrapper.scrollBy({
			top: -iconviewsWrapper.offsetHeight,
			behavior: 'smooth',
		});
	};

	const scrollDownCallback = () => {
		iconviewsWrapper.scrollBy({
			top: iconviewsWrapper.offsetHeight,
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
		const dropdowndata = _getDropdownContent(iconviewsWrapper);
		JSDialog.OpenDropdown(
			data.id,
			iconviewsWrapper,
			dropdowndata,
			iconViewListCallback,
		);
	};

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.id + '-scroll-up',
		'ui-iconview-scroll-up-button',
		'lc_searchprev.svg',
		builder,
		scrollUpCallback,
	);

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.id + '-scroll-down',
		'ui-iconview-scroll-down-button',
		'lc_searchnext.svg',
		builder,
		scrollDownCallback,
	);

	_createButtonForNotebookbarIconview(
		buttonsContainer,
		data.id + '-expand',
		'ui-iconview-expander-button',
		'lc_iconviewexpander.svg',
		builder,
		expanderCallback,
	);

	iconviewsWrapper._onDropDown = function (opened: boolean) {
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
					for( let i = 0; i < data.items.length; i++) {
						const item = data.items[i];
						const iconview = expander.querySelector('[id=\'' + item.id + '\']');
						if (item && iconview) {
							const label = window.L.DomUtil.create('span', builder.options.cssClass);
							label.textContent = item.label;
							iconview.parentNode.insertBefore(label, iconview);
						}
					}
				});
			});
		}
	};

	iconviewsWrapper.updateDropdown = function (id : string, pos : number) {
		const expander = JSDialog.GetDropdown(data.id);
		if (!expander) {
			return;
		}
		const iconview = expander.querySelector('[id=\'' + id + '\']');
		iconview.updateRenders(pos);
	}

	return false;
	}
