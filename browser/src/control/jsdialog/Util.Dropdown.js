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
 * Util.Dropdown - helper to create dropdown menus for JSDialogs
 */

/* global JSDialog app */

function _createDropdownId(id) {
	return id + '-dropdown';
}

JSDialog.CreateDropdownEntriesId = function(id) {
	return id + '-entries';
}

JSDialog.OpenDropdown = function (id, popupParent, entries, innerCallback, popupAnchor, isSubmenu) {
	var json = {
		id: _createDropdownId(id),
		type: 'dropdown',
		isSubmenu: isSubmenu,
		jsontype: 'dialog',
		popupParent: popupParent,
		popupAnchor: popupAnchor,
		gridKeyboardNavigation: false,
		cancellable: true,
		children: [
			{
				id: JSDialog.CreateDropdownEntriesId(id),
				type: 'grid',
				allyRole: 'listbox',
				cols: 1,
				rows: entries.length,
				tabIndex: 0,
				children: []
			}
		]
	};

	if (popupParent && typeof popupParent._onDropDown === 'function') {
		popupParent._onDropDown(true);
	}

	var isChecked = function (unoCommand) {
		var items = window.L.Map.THIS['stateChangeHandler'];
		var val = items.getItemValue(unoCommand);

		if (val && (val === true || val === 'true'))
			return true;
		else
			return false;
	};

	const shouldSelectFirstEntry = entries.length > 0 ? !entries.some(entry => entry.selected === true) : false;

	let initialSelectedId;

	for (let i = 0; i < entries.length; i++) {
		var checkedValue = (entries[i].checked === undefined)
			? undefined : (entries[i].uno && isChecked('.uno' + entries[i].uno));

		var entry;

		switch (entries[i].type) {
			// DEPRECACTED: legacy plain HTML adapter
			case 'html':
				entry = {
					id: id + '-entry-' + i,
					type: 'htmlcontent',
					htmlId: entries[i].htmlId,
					closeCallback: function () { JSDialog.CloseDropdown(id); }
				};
				json.gridKeyboardNavigation = true;
			break;

			// dropdown is a colorpicker
			case 'colorpicker':
				entry = entries[i];
				// for color picker we have a "KeyboardGridNavigation" function defined separately to handle custom cases
				json.gridKeyboardNavigation = true;
			break;

			// allows to put regular JSDialog JSON into popup
			case 'json':
				entry = entries[i].content;
				initialSelectedId = entry.initialSelectedId;
				if (entry.type === 'grid') json.gridKeyboardNavigation = true;
			break;

			// horizontal separator in menu
			case 'separator':
				entry = {
					id: id + '-entry-' + i,
					type: 'separator',
					orientation: 'horizontal'
				};
			break;

			// menu and submenu entry
			case 'action':
			case 'menu':
			default:
				entry = {
					id: id + '-entry-' + i,
					type: 'comboboxentry',
					customRenderer: entries[i].customRenderer,
					comboboxId: id,
					pos: i,
					text: entries[i].text,
					hint: entries[i].hint,
					w2icon: entries[i].icon, // FIXME: DEPRECATED
					icon: entries[i].img,
					checked: entries[i].checked || checkedValue,
					selected: (i === 0 && shouldSelectFirstEntry) ? true : entries[i].selected,
					hasSubMenu: !!entries[i].items
				};
				if (entry.selected) initialSelectedId = entry.id;
			break;
		}

		json.children[0].children.push(entry);
	}

	if (initialSelectedId) {
		json.init_focus_id = initialSelectedId;
		json.children[0].initialSelectedId = initialSelectedId;
	}

	var generateCallback = function (targetEntries) {
		let lastSubMenuOpened = null;
		const closeLastSubMenu = () => {
			if (!lastSubMenuOpened) return;
			JSDialog.CloseDropdown(lastSubMenuOpened);
			lastSubMenuOpened = null;
		};

		return function(objectType, eventType, object, data, builder) {
			if (typeof data == 'number') var pos = data;
			else var pos = data ? parseInt(data.substr(0, data.indexOf(';'))) : null;
			var entry = targetEntries && pos !== null ? targetEntries[pos] : null;
			var subMenuId = object.id + '-' + pos;

			if (eventType === 'selected' || eventType === 'showsubmenu') {
				if (entry && entry.items) {
					closeLastSubMenu();

					// open submenu
					var dropdown = JSDialog.GetDropdown(object.id);
					var targetEntry = dropdown.querySelectorAll('.ui-grid-cell')[pos + 1];
					JSDialog.OpenDropdown(subMenuId, targetEntry, entry.items,
						generateCallback(entry.items), 'top-end', true);
					lastSubMenuOpened = subMenuId;

					app.layoutingService.appendLayoutingTask(() => {
						var dropdown = JSDialog.GetDropdown(subMenuId);
						if (!dropdown) {
							console.debug('Dropdown: missing :' + subMenuId);
							return;
						}
						var container = dropdown.querySelector('.ui-grid');
						JSDialog.MakeFocusCycle(container);
						var focusables = JSDialog.GetFocusableElements(container);
						if (focusables && focusables.length)
							focusables[0].focus();
					});

					return;
				} else if (eventType === 'selected' && entry && entry.uno) {
					var uno = (entry.uno.indexOf('.uno:') === 0) ? entry.uno : '.uno:' + entry.uno;
					window.L.Map.THIS.sendUnoCommand(uno);
					JSDialog.CloseDropdown(id);
					return;
				}
			} else if (eventType === 'hidedropdown') {
				closeLastSubMenu();
				JSDialog.CloseDropdown(id);
				return;
			}

			// for multi-level menus last parameter should be used to handle event (it contains selected entry)
			// usually last param is builder see: JSDialogCallback
			if (innerCallback && innerCallback(objectType, eventType, object, data, entry || builder))
				return;

			if (eventType === 'selected')
				JSDialog.CloseDropdown(id);
			else
				console.debug('Dropdown: unhandled action: "' + eventType + '"');
		};
	};
	window.L.Map.THIS.fire('closepopups'); // close popups if a dropdown menu is opened
	window.L.Map.THIS.fire('jsdialog', {data: json, callback: generateCallback(entries)});
};

JSDialog.CloseDropdown = function (id) {
	window.L.Map.THIS.fire('jsdialog', {data: {
		id: _createDropdownId(id),
		jsontype: 'dialog',
		action: 'close'
	}});
};

JSDialog.CloseAllDropdowns = function () {
	window.L.Map.THIS.jsdialog.closeAllDropdowns();
};

JSDialog.GetDropdown = function (id) {
	// remember it can get some random numbers due to JSDialog.MakeIdUnique
	// TODO: use some register for it
	return document.body.querySelector('[id^="' + id + '"].modalpopup');
};
