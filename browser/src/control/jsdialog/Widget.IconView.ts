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

	const iconview = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-iconview',
		commonContainer,
	);
	iconview.id = data.id + '-iconview';
	iconview.setAttribute('role', 'listbox');

	if (data.labelledBy)
		iconview.setAttribute('aria-labelledby', data.labelledBy);

	// cleanup
	// // i think builder id here was more important than above as
	// this is sent to core and we retreive the icons from the render
	// cache anyways
	const customCallbackHandlerSendMessage = (
		objectType: string,
		eventType: string,
		object: any,
		entry_data: string,
	) => {
		// this just works! need to check how to not highlght the button
		if (objectType !== 'iconview')  {
			builder.callback(objectType, eventType, object, entry_data, builder);
			// we close the dropdown after the action
			// close the dropdown if exists

		    // this callback is inside the iconview
			// and this callback is handling something other than an iconview
			// so we handle that with the default handler
			// and we close the dropdown here.
			JSDialog.CloseAllDropdowns();
		}

		// TODO: this probably can also be refactored into separate helper function
		switch (typeof entry_data) {
			case 'string':
				// escape backspaces, quotes, newlines, and so on; remove added quotes
				entry_data = JSON.stringify(entry_data).slice(1, -1);
				break;
			case 'object':
				entry_data = encodeURIComponent(JSON.stringify(entry_data));
				break;
		}
		// FROM HERE

		// if (objectType == 'toolbutton' && eventType == 'click' && entry_data.indexOf('.uno:') >= 0) {
		// 	// encode spaces
		// 	var encodedCommand = entry_data.replace(' ', '%20');
		// 	builder.map.sendUnoCommand(encodedCommand);
		// }

		const builderWindowId: number = builder && (builder as any).windowId;
		const windowId = builderWindowId; // add those other conditions here

		// TODO: later add other checks to the above statement
		// const windowId = builder && builder.windowId !== null && builder.windowId !== undefined ? builder.windowId :
		// 	(window.mobileDialogId !== undefined ? window.mobileDialogId :
		// 		(window.sidebarId !== undefined ? window.sidebarId : -1));

		if (typeof windowId !== 'number') {
			window.app.console.error(
				'JSDialog.IconView: windowId "' +
					windowId +
					'" is not valid. Use a number.',
			);
			return; // core will fail parsing the command, it is a mistake most probably
		}

		// TODO: probably i can refactor the original builder callback to separate
		// out this send mechanism into separate function.
		// FROM HERE
		var message =
			'dialogevent ' +
			windowId +
			' {"id":"' +
			object.id +
			'", "cmd": "' +
			eventType +
			'", "data": "' +
			entry_data +
			'", "type": "' +
			objectType +
			'"}';
		app.socket.sendMessage(message);
		(window as any)._firstDialogHandled = true;
		// TILL HERE
	};

	if (data.isExpandable === true) {
		/*
			TODO: create a common container here then
				  to that common container, add the buttons
				  and add that container next to the iconview
				  to the parent container.

				  then as this works, create a separate function
				  which does all this and call that function from
				  here.
		*/

		// create the button's container
		const buttonsContainer = window.L.DomUtil.create(
			'div',
			builder.options.cssClass + ' ui-iconview-buttons-container',
			parentContainer,
		);
		buttonsContainer.id = data.id + '-buttons-container';

		// create the scroll up button
		const scrollUpButton = document.createElement('button');
		scrollUpButton.id = data.id + '-scroll-up-button';
		scrollUpButton.className =
			'ui-content unobutton ui-iconview-expander-button';
		buttonsContainer.appendChild(scrollUpButton);
		const scrollUpButtonImage = window.L.DomUtil.create(
			'img',
			'',
			scrollUpButton,
		);
		scrollUpButtonImage.className = 'ui-iconview-button-icon';
		app.LOUtil.setImage(scrollUpButtonImage, 'lc_searchprev.svg', builder.map);

		// create the scroll down button
		const scrollDownButton = document.createElement('button');
		scrollDownButton.id = data.id + '-scroll-up-button';
		scrollDownButton.className =
			'ui-content unobutton ui-iconview-expander-button';
		buttonsContainer.appendChild(scrollDownButton);
		const scrollDownButtonImage = window.L.DomUtil.create(
			'img',
			'',
			scrollDownButton,
		);
		scrollDownButtonImage.className = 'ui-iconview-button-icon';
		app.LOUtil.setImage(
			scrollDownButtonImage,
			'lc_searchnext.svg',
			builder.map,
		);

		// create the expander button
		const expanderButton = document.createElement('button');
		expanderButton.id = data.id + '-expander-button';
		expanderButton.className =
			'ui-content unobutton ui-iconview-expander-button';
		buttonsContainer.appendChild(expanderButton);
		const expanderButtonImage = window.L.DomUtil.create(
			'img',
			'',
			expanderButton,
		);
		expanderButtonImage.className = 'ui-iconview-button-icon';
		app.LOUtil.setImage(expanderButtonImage, 'lc_searchnext.svg', builder.map);

		commonContainer.appendChild(buttonsContainer);

		scrollUpButton.onclick = () => {
			iconview.scrollBy({
				top: -iconview.offsetHeight,
				behavior: 'smooth',
			});
		};

		scrollDownButton.onclick = () => {
			iconview.scrollBy({
				top: iconview.offsetHeight,
				behavior: 'smooth',
			});
		};

		expanderButton.onclick = () => {
			// the iconview in the dropdown should not have the expander button
			const isExpandable = data.isExpandable;
			data.isExpandable = false;

			JSDialog.OpenDropdown(
				data.id,
				commonContainer,
				[
					// NOTE: this should be changed such that we take
					//       expanderItems json from the child and just
					//       pass that as the second child here. so that
					//       the second child can be any number of childs
					//       and we don't have to do anything about that
					//       here.

					{ type: 'json', content: data },
					{ type: 'json', content: data.dropdownChildren },
					// these expanderWidgets can also be other iconviews,
					// so one has to make sure that the content doesn't have any
					// other expandable iconviews and if it does then we
					// set the isExpandable property false first.
					// we also need a separator between the origional iconview
					// and the other iconviews.
					// maybe we can emit a warning if children have an iconview?
					// that would be quicker for the time being.

					// { type: 'separator', id: 'anything-change-later', orientation: 'horizontal' },
				 //    {
					// 	// QUETION: how does this work when it's just a single
					// 	// 			button? like this, it's ending up in
					// 	// 			the callback from where we are sending message
					// 	// 			to core and getting nothing in return. also
					// 	// 			the click isn't handled in the dropdown.
				 //        type: 'json', content: {
					// 		'id': 'format-style-list-dialog',
					// 		'type': 'toolitem',
					// 		'text': _('Style list'),
					// 		'command': '.uno:SidebarDeck.StyleListDeck',
					// 		'icon': 'lc_stylepreviewmore.svg',
					// 		// 'accessibility': { focusBack: true, combination: 'SD', de: null }
					//     },
					// }
				],
				customCallbackHandlerSendMessage,
			);
			bIsExpanded = true;
			data.isExpandable = isExpandable;
		};

		iconview._onDropDown = function (opened: boolean) {
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
		commonContainer._onDropDown = iconview._onDropDown;
	}

	const disabled = data.enabled === false;
	if (disabled) window.L.DomUtil.addClass(iconview, 'disabled');

	for (const i in data.entries) {
		_iconViewEntry(iconview, data, data.entries[i], builder);
	}

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
	resizeObserver.observe(iconview);

	// Do not animate on creation - eg. when opening sidebar with icon view it might move the app
	const firstSelected = $(iconview).children('.selected').get(0);
	if (firstSelected) {
		const offsetTop = firstSelected.offsetTop;
		iconview.scrollTop = offsetTop;
	}

	iconview.onSelect = (position: number) => {
		$(iconview)
			.children('.selected')
			.each(function () {
				$(this).removeClass('selected');
				this.setAttribute('aria-selected', 'false');
			});

		const entry =
			iconview.children.length > position ? iconview.children[position] : null;

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

	const updateIconviewRenders = (dropdown: any, pos: number) => {
		// i think this should check if this iconview has been expanded
		// into a container or not and if so then it should refresh it
		// for  the dropdown
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

	// TODO; reword it properly later
	// once the dropdown is open and it passes past this,
	// there exist two iconviews with same id but one being
	// created by a callback inside other.
	//
	// so two versions of each of these functions exist and
	// since the icons are sent back by core for the notebookbar
	// iconview, this gets called in the notebookbar version of
	// stylesview. therefore this needs to check whether the dropdown
	// is open or not and in case it is, we need to update icons on
	// that (shouldn't be an issue, the ids are same for the
	// iconviews).
	//
	/*
		WARNING: the jsdialog dropdown is also missing
				 something on the cache side such that
				 everytime i scroll, i see the incomming
				 messages from core. this doesn't happen
				 in the iconview on the notebookbar.

		Question: Why doesn't core send the icons again
				  for the notebookbar iconview.

	*/
	iconview.updateRenders = (pos: number) => {
		let dropdown = iconview.querySelectorAll(
			'.ui-iconview-entry, .ui-iconview-separator',
		);
		updateIconviewRenders(dropdown, pos);
		// check in dropdown next, if it's open
		dropdown = commonContainer.querySelectorAll(
			'.jsdialog.ui-iconview-entry, .jsdialog.ui-iconview-separator',
		);
		if (dropdown && dropdown.length !== 0) updateIconviewRenders(dropdown, pos);
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
			builder.callback('iconview', 'select', data, selectedIndex, builder);
		else if (e.key === 'Enter')
			builder.callback('iconview', 'activate', data, selectedIndex, builder);
	});

	// ensures that aria-selected is updated on initial focus on iconview entries
	iconview.addEventListener('focusin', function (e: FocusEvent) {
		const target = e.target as HTMLElement;

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

	commonContainer.updateRenders = iconview.updateRenders;
	commonContainer.onSelect = iconview.onSelect;
	return false;
};

/*
    - the jsdialog shows scrollbar which it shouldn't show
    - the last item shouldn't be cut off.
*/
