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

/* global JSDialog */

function _createDropdownId(id) {
	return id + '-dropdown';
}

JSDialog.OpenDropdown = function (id, popupParent, entries, innerCallback, popupAnchor, isSubmenu) {
	var dropdownWindowId = _createDropdownId(id);
	var json = {
		id: dropdownWindowId,
		type: 'dropdown',
		isSubmenu: isSubmenu,
		jsontype: 'dialog',
		popupParent: popupParent,
		popupAnchor: popupAnchor,
		cancellable: true,
		children: [
			{
				id: id + '-entries',
				type: 'grid',
				cols: 1,
				rows: entries.length,
				children: []
			}
		]
	};

	var isChecked = function (unoCommand) {
		var items = L.Map.THIS['stateChangeHandler'];
		var val = items.getItemValue(unoCommand);

		if (val && (val === true || val === 'true'))
			return true;
		else
			return false;
	};

	for (var i in entries) {
		var checkedValue = (entries[i].checked === undefined)
			? undefined : (entries[i].uno && isChecked('.uno' + entries[i].uno));

		var entry = entries[i].type === 'html' ?
			// custom html content
			{
				id: id + '-entry-' + i,
				type: 'htmlcontent',
				htmlId: entries[i].htmlId
			}
			: // regular entry
			{
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
			selected: entries[i].selected,
			hasSubMenu: !!entries[i].items
		};

		if (entries[i].type === 'separator') {
			entry = {
				id: id + '-entry-' + i,
				type: 'separator',
				orientation: 'horizontal'
			};
		}

		json.children[0].children.push(entry);
	}

	var lastSubMenuOpened = null;
	var generateCallback = function (targetEntries) {
		return function(objectType, eventType, object, data) {
			var pos = data ? parseInt(data.substr(0, data.indexOf(';'))) : null;
			var entry = targetEntries && pos !== null ? targetEntries[pos] : null;

			if (eventType === 'selected' || eventType === 'showsubmenu') {
				if (entry.items) {
					if (lastSubMenuOpened) {
						var submenu = JSDialog.GetDropdown(lastSubMenuOpened);
						if (submenu) {
							JSDialog.CloseDropdown(lastSubMenuOpened);
							lastSubMenuOpened = null;
						}
					}

					// open submenu
					var dropdown = JSDialog.GetDropdown(object.id);
					var subMenuId = object.id + '-' + pos;
					var targetEntry = dropdown.querySelectorAll('.ui-grid-cell')[pos + 1];
					JSDialog.OpenDropdown(subMenuId, targetEntry, entry.items,
						generateCallback(entry.items), 'top-end', true);
					lastSubMenuOpened = subMenuId;

					var dropdown = JSDialog.GetDropdown(subMenuId);
					var container = dropdown.querySelector('.ui-grid');
					JSDialog.MakeFocusCycle(container);
					var focusables = JSDialog.GetFocusableElements(container);
					if (focusables && focusables.length)
						focusables[0].focus();
				} else if (eventType === 'selected' && entry.uno) {
					L.Map.THIS.sendUnoCommand(entry.uno);
					JSDialog.CloseDropdown(id);
				}
			} else if (!lastSubMenuOpened && eventType === 'hidedropdown') {
				JSDialog.CloseDropdown(id);
			}

			// for multi-level menus last parameter should be used to handle event (it contains selected entry)
			if (innerCallback && innerCallback(objectType, eventType, object, data, entry))
				return;

			if (eventType === 'selected')
				JSDialog.CloseDropdown(id);
		};
	};

	L.Map.THIS.fire('jsdialog', {data: json, callback: generateCallback(entries)});
};

JSDialog.CloseDropdown = function (id) {
	L.Map.THIS.fire('jsdialog', {data: {
		id: _createDropdownId(id),
		jsontype: 'dialog',
		action: 'close'
	}});
};

JSDialog.CloseAllDropdowns = function () {
	L.Map.THIS.jsdialog.closeAllDropdowns();
};

JSDialog.GetDropdown = function (id) {
	return document.body.querySelector('#' + _createDropdownId(id));
};
