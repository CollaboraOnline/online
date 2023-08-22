/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.Combobox - combobox widget with support for custom renders of entries
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'combobox',
 *     text: 'some text',
 *     entries: [ 'A', 'B', 'C' ],
 *     customEntryRenderer: true
 * }
 *
 * customEntryRenderer - specifies if entries have custom content which is rendered by the core
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global JSDialog */

JSDialog.comboboxEntry = function (parentContainer, data, builder) {
	var entry = L.DomUtil.create('div', 'ui-combobox-entry ' + builder.options.cssClass, parentContainer);
	entry.id = data.id;

	var content = L.DomUtil.create('span', '', entry);
	content.innerText = data.text;

	if (data.customRenderer) {
		var cachedComboboxEntries = builder.rendersCache[data.comboboxId];
		if (cachedComboboxEntries && cachedComboboxEntries[data.pos]) {
			L.DomUtil.remove(content);
			var img = L.DomUtil.create('img', '', entry);
			img.src = cachedComboboxEntries[data.pos];
			img.alt = data.text;
		} else {
			builder.callback('combobox', 'render_entry', {id: data.comboboxId}, data.pos, builder);
		}
	}

	var clickFunction = function () {
		builder.callback('combobox', 'selected', {id: data.comboboxId}, data.pos + ';' + data.text, builder);
	};

	entry.addEventListener('click', clickFunction);
	entry.addEventListener('keypress', function (event) {
		if (event.key === 'Enter')
			clickFunction();
	});

	return false;
};

JSDialog.mobileComboboxEntry = function(parentContainer, data, builder) {
	var comboboxEntry = L.DomUtil.create('p', builder.options.cssClass, parentContainer);
	comboboxEntry.textContent = builder._cleanText(data.text);

	comboboxEntry.parent = data.parent;

	if (data.style && data.style.length)
		L.DomUtil.addClass(comboboxEntry, data.style);

	comboboxEntry.addEventListener('click', function () {
		builder.refreshSidebar = true;
		if (builder.wizard)
			builder.wizard.goLevelUp();
		builder.callback('combobox', 'selected', comboboxEntry.parent, data.pos + ';' + comboboxEntry.textContent, builder);
	});

	return false;
};

JSDialog.combobox = function (parentContainer, data, builder) {
	var container = L.DomUtil.create('div', 'ui-combobox ' + builder.options.cssClass, parentContainer);
	container.id = data.id;

	var content = L.DomUtil.create('input', 'ui-combobox-content ' + builder.options.cssClass, container);
	content.value = data.text;

	var button = L.DomUtil.create('div', 'ui-combobox-button ' + builder.options.cssClass, container);
	button.tabIndex = '0';

	var arrow = L.DomUtil.create('span', builder.options.cssClass + ' ui-listbox-arrow', button);
	arrow.id = 'listbox-arrow-' + data.id;

	content.addEventListener('keyup', function () {
		builder.callback('combobox', 'change', data, this.value, builder);
	});

	var dropdownEntriesId = data.id + '-entries';
	var clickFunction = function () {
		var dropdownWindowId = data.id + '-dropdown';
		var json = {
			id: dropdownWindowId, // fake WindowId, rewritten in callback
			type: 'modalpopup',
			jsontype: 'dialog',
			popupParent: container,
			cancellable: true,
			children: [
				{
					id: dropdownEntriesId,
					type: 'grid',
					cols: 1,
					rows: data.entries.length,
					children: []
				}
			]
		};

		for (var i in data.entries) {
			var entry = {
				id: data.id + '-entry-' + i,
				type: 'comboboxentry',
				customRenderer: data.customEntryRenderer,
				comboboxId: data.id,
				pos: i,
				text: data.entries[i].toString()
			};

			json.children[0].children.push(entry);
		}

		var parentBuilder = builder;
		var callback = function(objectType, eventType, object, data, builder) {
			// send command with correct WindowId (from parent, not dropdown)
			if (eventType !== 'close')
				parentBuilder._defaultCallbackHandler(objectType, eventType, object, data, parentBuilder);

			// close after selection
			if (eventType === 'selected') {
				builder.map.fire('jsdialog', {data: {
					id: dropdownWindowId,
					jsontype: 'dialog',
					action: 'close'
				}});
			}
		};

		builder.map.fire('jsdialog', {data: json, callback: callback});
	};

	button.addEventListener('click', clickFunction);
	button.addEventListener('keypress', function (event) {
		if (event.key === 'Enter')
			clickFunction();
	});

	container.updateRenders = function (pos) {
		var dropdown = document.body.querySelectorAll('#' + dropdownEntriesId + ' .ui-combobox-entry');
		if (dropdown[pos]) {
			dropdown[pos].innerHTML = '';
			var img = L.DomUtil.create('img', '', dropdown[pos]);
			img.src = builder.rendersCache[data.id][pos];
			img.alt = data.entries[pos].toString();
		}
	};

	return false;
};
