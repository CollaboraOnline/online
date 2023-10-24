/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/*
 * Util.Dropdown - helper to create dropdown menus for JSDialogs
 */

/* global JSDialog */

function _createDropdownId(id) {
	return id + '-dropdown';
}

JSDialog.OpenDropdown = function (id, popupParent, entries, innerCallback) {
	var dropdownWindowId = _createDropdownId(id);
	var json = {
		id: dropdownWindowId,
		type: 'dropdown',
		jsontype: 'dialog',
		popupParent: popupParent,
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

	for (var i in entries) {
		var entry = {
			id: id + '-entry-' + i,
			type: 'comboboxentry',
			customRenderer: entries[i].customRenderer,
			comboboxId: id,
			pos: i,
			text: entries[i].text,
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

	var generateCallback = function (targetEntries) {
		return function(objectType, eventType, object, data) {
			if (eventType === 'selected') {
				var pos = parseInt(data.substr(0, data.indexOf(';')));
				if (targetEntries[pos].items) {
					// open submenu
					var dropdown = JSDialog.GetDropdown(object.id);
					var targetEntry = dropdown.querySelectorAll('.ui-grid-cell')[pos + 1];
					JSDialog.OpenDropdown(object.id + '-' + pos, targetEntry, targetEntries[pos].items,
						generateCallback(targetEntries[pos].items));
					return;
				}
			}

			// for multi-level menus last parameter should be used to handle event (it contains selected entry)
			if (innerCallback && innerCallback(objectType, eventType, object, data, targetEntries[pos]))
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

JSDialog.GetDropdown = function (id) {
	return document.body.querySelector('#' + _createDropdownId(id));
};
