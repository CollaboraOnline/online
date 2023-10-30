/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

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
 */

/* global JSDialog $ */

JSDialog.comboboxEntry = function (parentContainer, data, builder) {
	var entry = L.DomUtil.create('div', 'ui-combobox-entry ' + builder.options.cssClass, parentContainer);
	entry.id = data.id;

	if (data.hasSubMenu)
		L.DomUtil.addClass(entry, 'ui-has-menu');

	var content = L.DomUtil.create('span', '', entry);
	content.innerText = data.text;

	if (data.selected)
		L.DomUtil.addClass(entry, 'selected');

	if (data.customRenderer) {
		var cachedComboboxEntries = builder.rendersCache[data.comboboxId];
		var requestRender = true;

		if (cachedComboboxEntries && cachedComboboxEntries.images[data.pos]) {
			L.DomUtil.remove(content);
			content = L.DomUtil.create('img', '', entry);
			content.src = cachedComboboxEntries.images[data.pos];
			content.alt = data.text;
			requestRender = !cachedComboboxEntries.persistent;
		}

		if (requestRender) {
			// render on demand
			var onIntersection = function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						builder.callback('combobox', 'render_entry', {id: data.comboboxId},
							data.pos + ';' + Math.floor(100 * window.devicePixelRatio) + ';' + Math.floor(100 * window.devicePixelRatio),
							builder);
					}
				});
			};

			var observer = new IntersectionObserver(onIntersection, {
				root: null,
				threshold: 0.5 // percentage of visible area
			});

			observer.observe(content);
		}
	}

	var entryData = data.pos + ';' + data.text;

	var clickFunction = function () {
		builder.callback('combobox', 'selected', {id: data.comboboxId}, entryData, builder);
	};

	entry.addEventListener('click', clickFunction);
	entry.addEventListener('keypress', function (event) {
		if (event.key === 'Enter') {
			clickFunction();
			event.preventDefault();
		}
	});

	if (data.hasSubMenu) {
		entry.addEventListener('mouseover', function () {
			builder.callback('combobox', 'showsubmenu', {id: data.comboboxId}, entryData, builder);
		});
	}

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

JSDialog.mobileCombobox = function (parentContainer, data, builder) {
	var container = L.DomUtil.create('div', 'ui-explorable-entry level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', parentContainer);
	if (data && data.id)
		container.id = data.id;

	var sectionTitle = L.DomUtil.create('div', 'ui-header level-' + builder._currentDepth + ' ' + builder.options.cssClass + ' ui-widget', container);
	$(sectionTitle).css('justify-content', 'space-between');

	var leftDiv = L.DomUtil.create('div', 'ui-header-left combobox', sectionTitle);

	var editCallback = function(value) {
		builder.callback('combobox', 'change', data, value, builder);
	};
	builder._controlHandlers['edit'](leftDiv, data, builder, editCallback);

	var rightDiv = L.DomUtil.create('div', 'ui-header-right', sectionTitle);

	var arrowSpan = L.DomUtil.create('span', 'sub-menu-arrow', rightDiv);
	arrowSpan.textContent = '>';

	var contentDiv = L.DomUtil.create('div', 'ui-content level-' + builder._currentDepth + ' ' + builder.options.cssClass, container);
	contentDiv.title = data.text;

	var entries = [];
	if (data.entries) {
		for (var index in data.entries) {
			var style = 'ui-combobox-text';
			if ((data.selectedEntries && index == data.selectedEntries[0])
				|| data.entries[index] == data.text) {
				style += ' selected';
			}

			var entry = { type: 'comboboxentry', text: data.entries[index], pos: index, parent: data, style: style };
			entries.push(entry);
		}
	}

	var contentNode = {type: 'container', children: entries};

	builder._currentDepth++;
	builder.build(contentDiv, [contentNode]);
	builder._currentDepth--;

	if (!data.nosubmenu)
	{
		$(contentDiv).hide();
		if (builder.wizard) {
			$(container).click(function(event, data) {
				builder.wizard.goLevelDown(container, data);
				if (contentNode && contentNode.onshow)
					contentNode.onshow();
			});
		} else {
			window.app.console.debug('Builder used outside of mobile wizard: please implement the click handler');
		}
	}
	else
		$(container).hide();

	container.onSelect = function (pos) {
		console.error('Not implemented: select entry: ' + pos);
	};

	container.onSetText = function (text) {
		console.error('Not implemented: setText: ' + text);
	};
};

function _extractPos(selectCommandData) {
	return selectCommandData.substr(0, selectCommandData.indexOf(';'));
}

function _extractText(selectCommandData) {
	return selectCommandData.substr(selectCommandData.indexOf(';') + 1);
}

JSDialog.combobox = function (parentContainer, data, builder) {
	var container = L.DomUtil.create('div', 'ui-combobox ' + builder.options.cssClass, parentContainer);
	container.id = data.id;

	var content = L.DomUtil.create('input', 'ui-combobox-content ' + builder.options.cssClass, container);
	content.value = data.text;

	var button = L.DomUtil.create('div', 'ui-combobox-button ' + builder.options.cssClass, container);
	button.tabIndex = '0';

	var arrow = L.DomUtil.create('span', builder.options.cssClass + ' ui-listbox-arrow', button);
	arrow.id = 'listbox-arrow-' + data.id;

	if (data.selectedCount > 0)
		var selectedEntryPos = parseInt(data.selectedEntries[0]);

	// convert to dropdown entries
	var entries = [];
	for (var i in data.entries) {
		entries.push({
			text: data.entries[i].toString(),
			selected: parseInt(i) === selectedEntryPos,
			customRenderer: data.customEntryRenderer
		});
	}

	var resetSelection = function () {
		for (var i in entries) {
			entries[i].selected = false;
		}
	};

	// notebookbar a11y requires main element to have click handler for shortcuts to work
	container.addEventListener('click', function () { content.focus(); });

	content.addEventListener('keyup', function () {
		builder.callback('combobox', 'change', data, this.value, builder);

		// update selection
		resetSelection();
		for (var i in entries) {
			if (entries[i] == this.value) {
				entries[i].selected = true;
				break;
			}
		}
	});

	var comboboxId = data.id;
	var clickFunction = function () {
		var parentBuilder = builder;
		var callback = function(objectType, eventType, object, data) {
			// send command with correct WindowId (from parent, not dropdown)
			if (eventType !== 'close')
				parentBuilder._defaultCallbackHandler(objectType, eventType, object, data, parentBuilder);

			// close after selection
			if (eventType === 'selected') {
				container.onSelect(_extractPos(data));
				container.onSetText(_extractText(data));

				JSDialog.CloseDropdown(comboboxId);
			}

			return true;
		};

		JSDialog.OpenDropdown(data.id, container, entries, callback);
	};

	button.addEventListener('click', clickFunction);
	button.addEventListener('keypress', function (event) {
		if (event.key === 'Enter')
			clickFunction();
	});

	container.updateRenders = function (pos) {
		var dropdownRoot = JSDialog.GetDropdown(data.id);
		if (!dropdownRoot)
			return;

		var dropdown = dropdownRoot.querySelectorAll('.ui-combobox-entry');
		if (dropdown[pos]) {
			dropdown[pos].innerHTML = '';
			var img = L.DomUtil.create('img', '', dropdown[pos]);
			img.src = builder.rendersCache[data.id].images[pos];
			img.alt = entries[pos].text;
		}
	};

	container.onSelect = function (pos) {
		resetSelection();
		if (pos >= 0)
			entries[pos].selected = true;
	};

	container.onSetText = function (text) {
		content.value = text;
	};

	return false;
};
