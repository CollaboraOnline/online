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
 * JSDialog.TreeView - tree view widget with or without header
 *
 * Example JSON:
 * a) without header
 * {
 *     id: 'id',
 *     type: 'treelistbox',
 *     entries: [
 *         { row: 0, text: 'first entry', collapsed: true, children: [ { row: 1, text: 'first subentry' } ] },
 *         { row: 2, text: 'second entry', selected: true, state: false, ondemand: true }
 *     ]
 *     hideIfEmpty: true // hide treelistbox if entries array is empty
 * }
 *
 * b) with headers
 * {
 *     id: 'id',
 *     type: 'treelistbox',
 *     headers: [ { text: 'first column' }, { text: 'second' }],
 *     entries: [
 *         { row: 0, columns [ { text: 'a' }, { collapsed: 'collapsedIcon.svg' }, { collapsedimage: '<BASE64 encoded PNG>' } ] },
 *         { row: 1, columns [ { link: 'http://example.com' }, { expanded: 'expandedIcon.svg' }, selected: true ]}
 *     ]
 * }
 *
 * c) with header and is a tree, not a list
 * {
 *     id: 'id',
 *     type: 'treelistbox',
 *     headers: [ { text: 'first column' }, { text: 'second' }],
 *     entries: [
 *         { row: 0, columns [ { text: 'a' }, { collapsed: 'collapsedIcon.svg' } ] },
 *         { row: 1, columns [ { text: 'a' }, { collapsed: 'collapsedIcon.svg' }, { expandedimage: '<BASE64 encoded PNG>' } ],
 * 			   children: [
 *                 { row: 2, columns [ { text: 'a2' }, { expanded: 'expandedIcon.svg' }, selected: true ]}
 *             ]
 *         },
 *     ]
 * }
 *
 * 'row' property is used in the callback to differentiate entries
 * 'state' property defines if entry has the checkbox (false/true), when is missing - no checkbox
 * 'enabled' property defines if entry checkbox is enabled
 * 'ondemand' property can be set to provide nodes lazy loading
 * 'collapsed' property means, this entry have childrens, but they are not visible, because
 *             this branch is collapsed.
 */

/* global $ _ JSDialog */

var treeType = '';

function _findEntryWithRow(entries, row) {
	for (var i in entries) {
		if (i == row)
			return entries[i];
		else if (entries[i].children) {
			var found = _findEntryWithRow(entries[i].children, row);
			if (found)
				return found;
		}
	}

	return null;
}

function _createCheckbox(parentContainer, treeViewData, builder, entry) {
	var checkbox = L.DomUtil.create('input', builder.options.cssClass + ' ui-treeview-checkbox', parentContainer);
	checkbox.type = 'checkbox';
	checkbox.tabIndex = -1;

	if (entry.state === 'true' || entry.state === true)
		checkbox.checked = true;

	if (entry.enabled === false || entry.enabled === "false") {
		checkbox.disabled = true;
	}
	else if (treeViewData.enabled !== false && treeViewData.enabled !== 'false') {
		$(checkbox).change(function() {
			_changeCheckboxStateOnClick(this, treeViewData, builder, entry);
		});
	}

	return checkbox;
}

function _createRadioButton(parentContainer, treeViewData, builder, entry) {
	var radioButton = L.DomUtil.create('input', builder.options.cssClass + ' ui-treeview-checkbox', parentContainer);
	radioButton.type = 'radio';
	radioButton.tabIndex = -1;

	if (entry.state === 'true' || entry.state === true)
		radioButton.checked = true;

	return radioButton;
}

function _createImageColumn(parentContainer, builder, imageUrl) {
	var colorPreviewButton = L.DomUtil.create('img', builder.options.cssClass + ' ui-treeview-checkbox', parentContainer);
	colorPreviewButton.src = imageUrl
	colorPreviewButton.style.setProperty('outline', '1px solid var(--color-btn-border)');
	colorPreviewButton.style.setProperty('vertical-align', 'middle');

	return colorPreviewButton;
}

function _changeCheckboxStateOnClick(checkbox, treeViewData, builder, entry) {
	if (checkbox.checked) {
		var foundEntry = _findEntryWithRow(treeViewData.entries, entry.row);
		if (foundEntry)
			foundEntry.state = true;
		builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: true}, builder);
	} else {
		var foundEntry = _findEntryWithRow(treeViewData.entries, entry.row);
		if (foundEntry)
			foundEntry.state = false;
		builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: false}, builder);
	}
}

function _selectEntry(span, checkbox) {
	L.DomUtil.addClass(span, 'selected');
	span.setAttribute('aria-selected', true);
	span.tabIndex = 0;
	if (checkbox)
		checkbox.removeAttribute('tabindex');
}

function _unselectEntry(item) {
	L.DomUtil.removeClass(item, 'selected');
	item.removeAttribute('aria-selected');
	item.removeAttribute('tabindex');
	var itemCheckbox = item.querySelector('input');
	if (itemCheckbox)
		itemCheckbox.tabIndex = -1;
}

function _createClickFunction(entryClass, parentContainer, span, checkbox, select, activate,
	builder, treeViewData, entry) {
	return function () {
		parentContainer.querySelectorAll(entryClass)
			.forEach(function (item) { _unselectEntry(item); });

		_selectEntry(span, checkbox);
		if (checkbox) {
			checkbox.checked = !checkbox.checked;
			_changeCheckboxStateOnClick(checkbox, treeViewData, builder, entry);
		}

		if (select)
			builder.callback('treeview', 'select', treeViewData, entry.row, builder);

		if (activate)
			builder.callback('treeview', 'activate', treeViewData, entry.row, builder);
	};
}

function _getCellIconId(cellData) {
	var iconId = cellData.collapsed ? cellData.collapsed : cellData.expanded;
	var newLength = iconId.lastIndexOf('.');
	if (newLength > 0)
		iconId = iconId.substr(0, newLength).replaceAll('/', '');
	else
		iconId = iconId.replaceAll('/', '');
	return iconId;
}

var lastClickHelperRow = -1;
var lastClickHelperId = '';
function _treelistboxEntry(parentContainer, treeViewData, entry, builder, isTreeView, treeRoot) {
	if (entry.text == '<dummy>')
		return;

	treeRoot = treeRoot ? treeRoot : parentContainer;

	var disabled = treeViewData.enabled === 'false' || treeViewData.enabled === false || entry.enabled === false || entry.enabled === 'false';

	var li = L.DomUtil.create('li', builder.options.cssClass, parentContainer);
	if (_isSeparator(entry)) {
		L.DomUtil.addClass(li,'context-menu-separator');
	}

	if (!disabled && entry.state == null) {
		li.draggable = treeType === 'navigator' ? false: true;

		li.ondragstart = function drag(ev) {
			ev.dataTransfer.setData('text', entry.row);
			builder.callback('treeview', 'dragstart', treeViewData, entry.row, builder);

			document.querySelectorAll('.ui-treeview')
				.forEach(function (item) { L.DomUtil.addClass(item, 'droptarget'); });
		};

		li.ondragend = function () {
			document.querySelectorAll('.ui-treeview')
				.forEach(function (item) { L.DomUtil.removeClass(item, 'droptarget'); });
		};
		li.ondragover = function (event) { event.preventDefault(); };
	}

	var span = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-entry ' + (entry.children ? ' ui-treeview-expandable' : 'ui-treeview-notexpandable'), li);
	span.setAttribute('role', isTreeView ? 'treeitem' : 'option');
	if (entry.enabled === false || entry.enabled === 'false') {
		L.DomUtil.addClass(span, 'disabled');
	}

	var expander = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview-expander ', span);

	if (entry.state !== undefined)
		var selectionElement = _createSelectionElement(span, treeViewData, entry,builder);

	if (entry.selected && (entry.selected === 'true' || entry.selected === true))
		_selectEntry(span, selectionElement);

	var text = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell', span);
	for (var i in entry.columns) {
		var pngImage = entry.columns[i].collapsedimage ? entry.columns[i].collapsedimage : entry.columns[i].expandedimage;
		if (pngImage) {
			_createImageColumn(text, builder, pngImage);
		} else if (entry.columns[i].collapsed || entry.columns[i].expanded) {
			var icon = L.DomUtil.create('img', 'ui-listview-icon', text);

			if (treeType === 'navigator')
				icon.draggable = false;

			var iconId = _getCellIconId(entry.columns[i]);
			L.DomUtil.addClass(icon, iconId + 'img');
			var iconName = builder._createIconURL(iconId, true);
			L.LOUtil.setImage(icon, iconName, builder.map);
			L.DomUtil.addClass(span, 'ui-listview-expandable-with-icon');
		} else if (entry.columns[i].link && !_isSeparator(entry.columns[i])) {
			var innerText = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell-text', text);
			var link = L.DomUtil.create('a', '', innerText);
			link.href = entry.columns[i].link || entry.columns[i].text;
			link.innerText = entry.columns[i].text || entry.text;
		} else if (entry.columns[i].text && !_isSeparator(entry.columns[i])) {
			var innerText = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell-text', text);
			innerText.innerText = entry.columns[i].text || entry.text;
		}
	}

	var toggleFunction = function() {
		if (L.DomUtil.hasClass(span, 'collapsed'))
			builder.callback('treeview', 'expand', treeViewData, entry.row, builder);
		else
			builder.callback('treeview', 'collapse', treeViewData, entry.row, builder);
		$(span).toggleClass('collapsed');
	};

	var expandFunction = function () {
		if (entry.ondemand && L.DomUtil.hasClass(span, 'collapsed'))
			builder.callback('treeview', 'expand', treeViewData, entry.row, builder);
		$(span).toggleClass('collapsed');
	};

	if (entry.children) {
		var ul = L.DomUtil.create('ul', builder.options.cssClass, li);
		if (!entry.collapsed) {
			for (var i in entry.children) {
				_treelistboxEntry(ul, treeViewData, entry.children[i], builder, isTreeView, treeRoot);
			}
		}

		if (!disabled) {
			if (entry.ondemand) {
				L.DomEvent.on(expander, 'click', expandFunction);
			} else {
				$(expander).click(toggleFunction);
			}

			// block expand/collapse on checkbox
			if (entry.state)
				$(selectionElement).click(toggleFunction);
		}

		if (entry.ondemand || entry.collapsed)
			L.DomUtil.addClass(span, 'collapsed');
	}

	if (!disabled) {
		var singleClick = _isSingleClickActivate(treeViewData);
		var clickFunction = _createClickFunction('.ui-treeview-entry', treeRoot, span, selectionElement,
			true, singleClick, builder, treeViewData, entry);
		var doubleClickFunction = _createClickFunction('.ui-treeview-entry', treeRoot, span, selectionElement,
			false, true, builder, treeViewData, entry);

		text.addEventListener('click', clickFunction);
		span.addEventListener('keydown', function onEvent(event) {
			var preventDef = false;
			if (event.key === 'Enter' || event.key === ' ') {
				if (event.key === 'Enter')
					doubleClickFunction();
				else
					clickFunction();

				if (selectionElement)
					selectionElement.click();
				preventDef = true;
			} else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
				if (entry.ondemand)
					expandFunction();
				else
					toggleFunction();
				preventDef = true;
			} else if (event.key === 'Tab') {
				if (!L.DomUtil.hasClass(span, 'selected'))
					_unselectEntry(span); // remove tabIndex

			}

			if (preventDef) {
				event.preventDefault();
				event.stopPropagation();
			}
		});

		if (!singleClick) {
			if (window.ThisIsTheiOSApp) {
				text.addEventListener('click', function() {
					if (entry.row == lastClickHelperRow && treeViewData.id == lastClickHelperId)
						doubleClickFunction();
					else {
						lastClickHelperRow = entry.row;
						lastClickHelperId = treeViewData.id;
						setTimeout(function() {
							lastClickHelperRow = -1;
						}, 300);
					}
				});
			} else {
				$(text).dblclick(doubleClickFunction);
			}
		}
	}
}

function _getLevel(element) {
	return element.getAttribute('aria-level');
}

function _isSeparator(element) {
	if (!element.text)
		return false;
	return element.text.toLowerCase() === 'separator';
}
function _expandTreeGrid(element) {
	var wasExpanded = element.getAttribute('aria-expanded') === 'true';
	var level = _getLevel(element);

	element.setAttribute('aria-expanded', wasExpanded ? false : true);

	// show/hide sub entries
	var sibling = element.nextSibling;
	while (sibling && _getLevel(sibling) > level) {
		if (wasExpanded)
			L.DomUtil.addClass(sibling, 'hidden');
		else
			L.DomUtil.removeClass(sibling, 'hidden');

		sibling = sibling.nextSibling;
	}
}

function _headerlistboxEntry(parentContainer, treeViewData, entry, builder) {
	var disabled = treeViewData.enabled === 'false' || treeViewData.enabled === false;
	var singleClick = _isSingleClickActivate(treeViewData);
	var selectionElement;
	if (entry.state !== undefined) {
		var td = L.DomUtil.create('td', '', parentContainer);
		selectionElement = _createSelectionElement(td, treeViewData, entry, builder);
	}

	if (entry.selected && (entry.selected === 'true' || entry.selected === true))
		_selectEntry(parentContainer, selectionElement);

	var clickFunction = _createClickFunction('.ui-listview-entry', parentContainer.parentNode,
		parentContainer, selectionElement, true, singleClick, builder, treeViewData, entry);

	var expander = null; // present in TreeGrid

	for (var i in entry.columns) {
		var td = L.DomUtil.create('td', '', parentContainer);
		td.setAttribute('role', 'gridcell');

		// this is tree grid (tree with headers)
		if (i == 0 && entry.children) {
			var expander = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview-expander', td);
			expander.addEventListener('click', function () { _expandTreeGrid(parentContainer); });
		}
		var pngImage = entry.columns[i].collapsedimage ? entry.columns[i].collapsedimage : entry.columns[i].expandedimage;
		if (pngImage) {
			_createImageColumn(td, builder, pngImage);
		} else if (entry.columns[i].collapsed || entry.columns[i].expanded) {
			var icon = L.DomUtil.create('img', 'ui-listview-icon', td);
			var iconId = _getCellIconId(entry.columns[i]);
			L.DomUtil.addClass(icon, iconId + 'img');
			var iconName = builder._createIconURL(iconId, true);
			L.LOUtil.setImage(icon, iconName, builder.map);
		} else if (entry.columns[i].link) {
			var link = L.DomUtil.create('a', '', td);
			link.href = entry.columns[i].link || entry.columns[i].text;
			link.target = '_blank';
			link.innerText = entry.columns[i].text || entry.text;
		} else if (entry.columns[i].text) {
			td.innerText = entry.columns[i].text;
		}

		if (!disabled)
			$(td).click(clickFunction);
	}

	if (!disabled) {
		parentContainer.addEventListener('keydown', function onEvent(event) {
			if (event.key === ' ' && expander) {
				expander.click();
				parentContainer.focus();
				event.preventDefault();
				event.stopPropagation();
			} else if (event.key === 'Enter' || event.key === ' ') {
				clickFunction();
				if (selectionElement)
					selectionElement.click();
				parentContainer.focus();
				event.preventDefault();
				event.stopPropagation();
			} else if (event.key === 'Tab') {
				if (!L.DomUtil.hasClass(parentContainer, 'selected'))
					_unselectEntry(parentContainer); // remove tabIndex
			}
		});
	}
}

function _hasIcon(columns) {
	for (var i in columns)
		if (columns[i].collapsed !== undefined || columns[i].expanded !== undefined
			|| columns[i].collapsedimage !== undefined || columns[i].expandedimage !== undefined)
			return true;
	return false;
}

function _createSelectionElement (parentContainer, treeViewData, entry, builder) {
	var selectionElement;
	var checkboxtype = treeViewData.checkboxtype;
	if (checkboxtype == 'radio') {
		selectionElement = _createRadioButton(parentContainer, treeViewData, builder, entry);
	}
	else {
		selectionElement = _createCheckbox(parentContainer, treeViewData, builder, entry);
	}
	return selectionElement;
}

function _isSingleClickActivate (treeViewData) {
	return treeViewData.singleclickactivate === 'true' || treeViewData.singleclickactivate === true;
}
// returns 0 in case of flat list
function _calulateTreeDepth(entries) {
	var depth = 0;
	for (var i in entries) {
			var entry = entries[i];
			if (entry.children && entry.children.length) {
					var entryDepth = _calulateTreeDepth(entry.children) + 1;
					if (entryDepth > depth)
							depth = entryDepth;
			}
	}
	return depth;
}

// children are moved to the root level and have depth parameter added
function _makeTreeFlat(entries, depth) {
	var flatList = [];
	for (var i in entries) {
		var entry = entries[i];
		entry.depth = depth;
		flatList.push(entry);

		if (entry.children && entry.children.length) {
			var flatChildren = _makeTreeFlat(entry.children, depth + 1);
			flatList = flatList.concat(flatChildren);
		}
	}
	return flatList;
}

function _createHeaders(tbody, data, builder, depth) {
	var headers = L.DomUtil.create('tr', builder.options.cssClass + ' ui-treeview-header', tbody);
	headers.setAttribute('role', 'row');
	var hasCheckboxes = data.entries && data.entries.length && data.entries[0].state !== undefined;
	if (hasCheckboxes)
		data.headers = [{ text: '' }].concat(data.headers);
	var hasIcons = data.entries && data.entries.length && _hasIcon(data.entries[0].columns);
	if (hasIcons)
		data.headers = [{ text: '' }].concat(data.headers);
	var isTreeGrid = depth > 0;

	for (var h in data.headers) {
		var header = L.DomUtil.create('th', builder.options.cssClass, headers);
		header.setAttribute('role', 'columnheader');
		var headerText = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-header-text', header);
		headerText.innerText = data.headers[h].text;
		var headerSortIcon = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-header-sort-icon', header);

		var sortByColumn = function (columnIndex, up) {
			var compareFunction = function (a, b) {
				if (!a || !b)
					return 0;

				var tda = a.querySelectorAll('td').item(columnIndex);
				var tdb = b.querySelectorAll('td').item(columnIndex);

				if (tda.querySelector('input')) {
					if (tda.querySelector('input').checked === tdb.querySelector('input').checked)
						return 0;
					if (up) {
						if (tda.querySelector('input').checked > tdb.querySelector('input').checked)
							return 1;
						else
							return -1;
					} else if (tdb.querySelector('input').checked > tda.querySelector('input').checked)
						return 1;
					else
						return -1;
				}

				if (up)
					return tdb.innerText.toLowerCase().localeCompare(tda.innerText.toLowerCase());
				else
					return tda.innerText.toLowerCase().localeCompare(tdb.innerText.toLowerCase());
			};

			var toSort = [];

			tbody.querySelectorAll('.jsdialog.ui-listview-entry')
				.forEach(function (item) { toSort.push(item); tbody.removeChild(item); });

			toSort.sort(compareFunction);

			toSort.forEach(function (item) { tbody.insertBefore(item, tbody.lastChild.nextSibling); });
		};

		var clickFunction = function (columnIndex, icon) {
			var clearSorting = function () {
				var icons = headers.querySelectorAll('.ui-treeview-header-sort-icon');
				icons.forEach(function (icon) {
					L.DomUtil.removeClass(icon, 'down');
					L.DomUtil.removeClass(icon, 'up');
				});
			};

			return function () {
				if (L.DomUtil.hasClass(icon, 'down')) {
					clearSorting();
					L.DomUtil.addClass(icon, 'up');
					sortByColumn(columnIndex, true);
				} else {
					clearSorting();
					L.DomUtil.addClass(icon, 'down');
					sortByColumn(columnIndex, false);
				}
			};
		};

		if (!isTreeGrid)
			header.onclick = clickFunction(h, headerSortIcon);
	}
}

function _changeFocusedRow(listElements, fromIndex, toIndex) {
	var nextElement = listElements.eq(toIndex).get(0);
	nextElement.tabIndex = 0;
	nextElement.focus();

	var nextInput = listElements.eq(toIndex).find('td input');
	if (nextInput && nextInput.length)
		nextInput.get(0).removeAttribute('tabindex');

	if (fromIndex >= 0) {
		var oldElement = listElements.eq(fromIndex).get(0);
		if (L.DomUtil.hasClass(oldElement, 'selected'))
			return;

		oldElement.removeAttribute('tabindex');
		var oldInput = listElements.eq(fromIndex).find('td input');
		if (oldInput && oldInput.length)
			oldInput.get(0).tabIndex = -1;
	}
}

function _getCurrentEntry(listElements) {
	var focusedElement = document.activeElement;
	// tr - row itself
	var currIndex = listElements.index(focusedElement);
	// input - child of a row
	if (currIndex < 0)
		currIndex = listElements.index(focusedElement.parentNode.parentNode);
	// no focused entry - try with selected one
	if (currIndex < 0) {
		var selected = listElements.filter('.selected');
		if (selected && selected.length)
			currIndex = listElements.index(selected.get(0));
	}
	if (currIndex < 0) {
		for (var i in listElements) {
			var parent = listElements[i].parentNode;

			if (parent)
				parent = parent.parentNode;
			else
				break;

			if (parent && L.DomUtil.hasClass(parent, 'selected')) {
				currIndex = listElements.index(listElements[i]);
				break;
			}
		}
	}

	return currIndex;
}

function _handleKeyEvent(event, listElements, builder, data) {
	var preventDef = false;
	var treeLength = listElements.length;
	var currIndex = _getCurrentEntry(listElements);

	if (event.key === 'ArrowDown') {
		if (currIndex < 0)
			_changeFocusedRow(listElements, currIndex, 0);
		else {
			var nextIndex = currIndex + 1;
			while (nextIndex < treeLength - 1 && listElements[nextIndex].clientHeight <= 0)
				nextIndex++;
			if (nextIndex < treeLength)
				_changeFocusedRow(listElements, currIndex, nextIndex);
		}
		preventDef = true;
	} else if (event.key === 'ArrowUp') {
		if (currIndex < 0)
			_changeFocusedRow(listElements, currIndex, treeLength - 1);
		else {
			var nextIndex = currIndex - 1;
			while (nextIndex >= 0 && listElements[nextIndex].clientHeight <= 0)
				nextIndex--;
			if (nextIndex >= 0)
				_changeFocusedRow(listElements, currIndex, nextIndex);
		}

		preventDef = true;
	} else if (data.fireKeyEvents && builder.callback('treeview', 'keydown', { id: data.id, key: event.key }, currIndex, builder)) {
		// used in mentions
		preventDef = true;
	}

	if (preventDef) {
		event.preventDefault();
		event.stopPropagation();
	}
}

function _treelistboxControl(parentContainer, data, builder) {
	var table = L.DomUtil.create('table', builder.options.cssClass + ' ui-treeview', parentContainer);
	table.id = data.id;
	table.tabIndex = 0;
	var disabled = data.enabled === 'false' || data.enabled === false;
	if (disabled)
		L.DomUtil.addClass(table, 'disabled');

	var tbody = L.DomUtil.create('tbody', builder.options.cssClass + ' ui-treeview-body', table);

	var depth = _calulateTreeDepth(data.entries);
	var isHeaderListBox = data.headers && data.headers.length !== 0;
	if (isHeaderListBox)
		_createHeaders(tbody, data, builder, depth);

	if (!disabled) {
		tbody.ondrop = function (ev) {
			ev.preventDefault();
			var row = ev.dataTransfer.getData('text');
			builder.callback('treeview', 'dragend', data, row, builder);
			document.querySelectorAll('.ui-treeview')
				.forEach(function (item) { L.DomUtil.removeClass(item, 'droptarget'); });
		};

		tbody.ondragover = function (event) { event.preventDefault(); };
	}

	if (!data.entries || data.entries.length === 0) {
		// contentbox and tree can never be empty, 1 page or 1 sheet always exists
		if (data.id === 'contenttree') {
			var tr = L.DomUtil.create('tr', builder.options.cssClass + ' ui-listview-entry', tbody);
			tr.setAttribute('role', 'row');
			tr.innerText = _('Headings and objects that you add to the document will appear here');
		} else {
			L.DomUtil.addClass(table, 'empty');
			if (data.hideIfEmpty)
				L.DomUtil.addClass(table, 'hidden');
		}
		return false;
	}

	if (isHeaderListBox) {
		// list view with headers
		table.setAttribute('role', 'grid');

		var flatEntries = _makeTreeFlat(data.entries, 0);

		for (var i in flatEntries) {
			var tr = L.DomUtil.create('tr', builder.options.cssClass + ' ui-listview-entry', tbody);
			tr.setAttribute('role', 'row');
			var entry = flatEntries[i];
			if (depth > 0)
				tr.setAttribute('aria-level', entry.depth + 1);
			if (entry.children && entry.children.length)
				tr.setAttribute('aria-expanded', true);
			_headerlistboxEntry(tr, data, entry, builder);
		}

		table.addEventListener('keydown', function onEvent(event) {
			var listElements = $(tbody).children('.ui-listview-entry');
			_handleKeyEvent(event, listElements, builder, data);
		});

		var firstSelected = tbody.querySelector('.ui-listview-entry.selected');
	} else {
		// tree view
		var isRealTreeView = false;
		for (i in data.entries) {
			if (data.entries[i].children && data.entries[i].children.length) {
				isRealTreeView = true;
				break;
			}
		}
		table.setAttribute('role', isRealTreeView ? 'tree' : 'listbox');

		var ul = L.DomUtil.create('ul', builder.options.cssClass, tbody);

		for (i in data.entries) {
			_treelistboxEntry(ul, data, data.entries[i], builder, isRealTreeView);
		}

		table.addEventListener('keydown', function onEvent(event) {
			var listElements = $(ul).find(isRealTreeView ? '.ui-treeview-cell-text' : '.ui-treeview-entry');
			_handleKeyEvent(event, listElements, builder, data);
		});

		firstSelected = tbody.querySelector('.ui-treeview-entry.selected');
	}

	if (firstSelected) {
		var observer = new IntersectionObserver(function (entries, observer) {
			var offsetTop;
			if (isHeaderListBox)
				offsetTop = firstSelected.offsetTop;
			else
				offsetTop = firstSelected.parentNode.offsetTop;

			var scrollNeeded = offsetTop - tbody.offsetTop;

			// scroll only if the selected line is not visible
			// and scroll the minimum required to make the selected line fully visible
			if (table.scrollTop > scrollNeeded) {
				table.scrollTop = scrollNeeded;
			} else if (table.scrollTop + table.clientHeight - firstSelected.clientHeight < scrollNeeded) {
				table.scrollTop = scrollNeeded - table.clientHeight + firstSelected.clientHeight;
			}

			observer.disconnect();
		});
		observer.observe(tbody);
	}

	table.filterEntries = function (filter) {
		if (table.filterTimer)
			clearTimeout(table.filterTimer);

		if (isHeaderListBox)
			var selector = '.ui-listview-entry';
		else
			selector = '.ui-treeview-entry';

		var entriesToHide = [];
		var allEntries = tbody.querySelectorAll(selector);

		filter = filter.trim();

		allEntries.forEach(function (entry) {
			if (filter === '')
				return;

			var cells = entry.querySelectorAll('td');
			for (var i in cells) {
				var entryText = cells[i].innerText;
				if (entryText && entryText.toLowerCase().indexOf(filter.toLowerCase()) >= 0) {
					return;
				}
			}

			entriesToHide.push(entry);
		});

		table.filterTimer = setTimeout(function() {
			allEntries.forEach(function (entry) {
				L.DomUtil.removeClass(entry, 'hidden');
			});

			entriesToHide.forEach(function (entry) {
				L.DomUtil.addClass(entry, 'hidden');
			});
		}, 100);
	};

	return false;
}

class TreeViewControl {

	get Container() {
		return this._container;
	}

	static countColumns(data) {
		if (!data.entries || !data.entries.length)
			return data.headers ? data.headers.length : 1;

		var maxColumns = 0;
		for (var e in data.entries) {
			const entry = data.entries[e];
			const count = entry.columns ? entry.columns.length : 0;
			if (count > maxColumns)
				maxColumns = count;
		}

		if (this.hasState(data))
			maxColumns++;

		return maxColumns;
	}

	static hasState(data) {
		for (var e in data.entries) {
			const entry = data.entries[e];
			if (entry.state !== undefined)
				return true;
		}

		return false;
	}

	static findEntryWithRow(entries, row) {
		for (let i in entries) {
			if (i == row)
				return entries[i];
			else if (entries[i].children) {
				var found = TreeViewControl.findEntryWithRow(entries[i].children, row);
				if (found)
					return found;
			}
		}

		return null;
	}

	static changeCheckboxStateOnClick(checkbox, treeViewData, builder, entry) {
		let foundEntry;
		if (checkbox.checked) {
			foundEntry = TreeViewControl.findEntryWithRow(treeViewData.entries, entry.row);
			if (foundEntry)
				foundEntry.state = true;
			builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: true}, builder);
		} else {
			foundEntry = TreeViewControl.findEntryWithRow(treeViewData.entries, entry.row);
			if (foundEntry)
				foundEntry.state = false;
			builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: false}, builder);
		}
	}

	createCheckbox(parent, treeViewData, builder, entry) {
		let checkbox = L.DomUtil.create('input', builder.options.cssClass + ' ui-treeview-checkbox', parent);
		checkbox.type = 'checkbox';
		checkbox.tabIndex = -1;

		if (entry.state === 'true' || entry.state === true)
			checkbox.checked = true;

		if (treeViewData.enabled !== false && treeViewData.enabled !== 'false') {
			$(checkbox).change(function() {
				TreeViewControl.changeCheckboxStateOnClick(this, treeViewData, builder, entry);
			});
		}

		return checkbox;
	}

	createRadioButton(parent, treeViewData, builder, entry) {
		let radioButton = L.DomUtil.create('input', builder.options.cssClass + ' ui-treeview-checkbox', parent);
		radioButton.type = 'radio';
		radioButton.tabIndex = -1;

		if (entry.state === 'true' || entry.state === true)
			radioButton.checked = true;

		return radioButton;
	}

	createSelectionElement (parent, treeViewData, entry, builder) {
		let selectionElement;
		let checkboxtype = treeViewData.checkboxtype;
		if (checkboxtype == 'radio') {
			selectionElement = this.createRadioButton(parent, treeViewData, builder, entry);
		} else {
			selectionElement = this.createCheckbox(parent, treeViewData, builder, entry);
		}
		return selectionElement;
	}

	isSeparator(element) {
		if (!element.text)
			return false;
		return element.text.toLowerCase() === 'separator';
	}

	static isSingleClickActivate (treeViewData) {
		return treeViewData.singleclickactivate === true;
	}

	isNavigator(data) {
		return data.id && typeof(data.id) === 'string' && data.id.startsWith('Navigator');
	}

	getCellIconId(cellData) {
		let iconId = cellData.collapsed ? cellData.collapsed : cellData.expanded;
		let newLength = iconId.lastIndexOf('.');
		if (newLength > 0)
			iconId = iconId.substr(0, newLength).replaceAll('/', '');
		else
			iconId = iconId.replaceAll('/', '');
		return iconId;
	}

	createImageColumn(parentContainer, builder, imageUrl) {
		let colorPreviewButton = L.DomUtil.create('img', builder.options.cssClass + ' ui-treeview-checkbox',
							  parentContainer);
		colorPreviewButton.src = imageUrl
		colorPreviewButton.style.setProperty('outline', '1px solid var(--color-btn-border)');
		colorPreviewButton.style.setProperty('vertical-align', 'middle');

		return colorPreviewButton;
	}

	isExpanded(entry) {
		for (let i in entry.columns)
			if (entry.columns[i].expanded === true)
				return true;
		return false;
	}

	fillHeader(header, builder) {
		if (!header)
			return;

		let th = L.DomUtil.create('div', builder.options.cssClass,
					  this._container._thead);
		let span = L.DomUtil.create('span', builder.options.cssClass +
					    ' ui-treeview-header-text', th);
		L.DomUtil.create('span', builder.options.cssClass +
				 ' ui-treeview-header-sort-icon', span);
		span.innerText = header.text;
	}

	fillRow(data, entry, builder, level) {
		let selectionElement;
		if (this._hasState) {
			let td = L.DomUtil.create('div', '', this._container._tbody);
			selectionElement = this.createSelectionElement(td, data, entry, builder);
			if (this._isRealTree) td.setAttribute('aria-level', level);
		}

		this.fillCells(entry, builder, data, this._container._tbody, level, selectionElement);
	}

	fillCells(entry, builder, treeViewData, tr, level, selectionElement) {
		let td, expander, span, text, img, icon, iconId, iconName, link, innerText;

		let rowElements = [];

		// check / radio
		let dummyColumns = this._columns - entry.columns.length;
		if (this._hasState)
			dummyColumns--;

		// dummy columns
		for (let index = dummyColumns; index > 0; index--) {
			td = L.DomUtil.create('div', '', tr);
			rowElements.push(td);
		}

		// regular columns
		for (let index in entry.columns) {
			td = L.DomUtil.create('div', '', tr);
			rowElements.push(td);
			td.style.display = 'flex';

			if (index == 0 && entry.children && entry.children.length)
				expander = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview-expander', td);

			span = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell', td);
			text = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell-text', span);

			if (entry.text == '<dummy>')
				continue;

			img = entry.columns[index].collapsedimage ? entry.columns[index].collapsedimage :
				entry.columns[index].expandedimage;
			if (img) {
				this.createImageColumn(text, builder, img);
			} else if (entry.columns[index].collapsed || entry.columns[index].expanded) {
				icon = L.DomUtil.create('img', 'ui-listview-icon', text);

				if (this._isNavigator)
					icon.draggable = false;

				iconId = this.getCellIconId(entry.columns[index]);
				L.DomUtil.addClass(icon, iconId + 'img');
				iconName = builder._createIconURL(iconId, true);
				L.LOUtil.setImage(icon, iconName, builder.map);
				L.DomUtil.addClass(span, 'ui-listview-expandable-with-icon');
			} else if (entry.columns[index].link && !this.isSeparator(entry.columns[index])) {
				innerText = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell-text',
							     text);
				link = L.DomUtil.create('a', '', innerText);
				link.href = entry.columns[index].link || entry.columns[index].text;
				link.innerText = entry.columns[index].text || entry.text;
			} else if (entry.columns[index].text && !this.isSeparator(entry.columns[index])) {
				innerText = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell-text',
							     text);
				innerText.innerText = entry.columns[index].text || entry.text;
			}

			for (let i in rowElements) {
				let element = rowElements[i];

				// mark row with common class
				const rowClass = 'row-' + entry.row;
				L.DomUtil.addClass(element, rowClass);

				// setup properties
				element.setAttribute('role', 'gridcell');

				if (level !== undefined && this._isRealTree) element.setAttribute('aria-level', level);

				if (entry.selected === true)
					this.selectEntry(element, selectionElement);

				const disabled = entry.enabled === false
				if (disabled)
					L.DomUtil.addClass(element, 'disabled');

				if (entry.children)
					element.setAttribute('aria-expanded', true);

				if (entry.ondemand || entry.collapsed) {
					L.DomUtil.addClass(element, 'collapsed');
					element.setAttribute('aria-expanded', false);
				}

				// setup callbacks
				var singleClick = this._singleClickActivate;
				var clickFunction = this.createClickFunction(rowClass, tr, element, selectionElement,
					true, singleClick, builder, treeViewData, entry);
				var doubleClickFunction = this.createClickFunction(rowClass, tr, element, selectionElement,
					false, true, builder, treeViewData, entry);

				element.addEventListener('click', clickFunction);

				if (!singleClick) {
					if (window.ThisIsTheiOSApp) {
						// TODO: remove this hack
						element.addEventListener('click', () => {
							if (L.DomUtil.hasClass(element, 'disabled'))
								return;

							if (entry.row == lastClickHelperRow && treeViewData.id == lastClickHelperId)
								doubleClickFunction();
							else {
								lastClickHelperRow = entry.row;
								lastClickHelperId = treeViewData.id;
								setTimeout(() => {
									lastClickHelperRow = -1;
								}, 300);
							}
						});
						// TODO: remove this hack
					} else {
						$(element).dblclick(doubleClickFunction);
					}
				}

				if (entry.children) {
					const toggleFunction =
						() => { this.toggleEntry(element, treeViewData, entry, builder); };
					if (entry.ondemand) {
						L.DomEvent.on(expander, 'click',
							() => { this.expandEntry(element, treeViewData, entry, builder); });
					} else {
						$(expander).click(toggleFunction);
					}

					// block expand/collapse on checkbox
					if (entry.state)
						$(selectionElement).click(toggleFunction);
				}

				// TODO: drag & drop
			}
		}
	}

	toggleEntry (span, treeViewData, entry, builder) {
		if (entry.enabled === false)
			return;

		if (L.DomUtil.hasClass(span, 'collapsed'))
			builder.callback('treeview', 'expand', treeViewData, entry.row, builder);
		else
			builder.callback('treeview', 'collapse', treeViewData, entry.row, builder);
		$(span).toggleClass('collapsed');
	}

	expandEntry (span, treeViewData, entry, builder) {
		if (entry.enabled === false)
			return;

		if (entry.ondemand && L.DomUtil.hasClass(span, 'collapsed'))
			builder.callback('treeview', 'expand', treeViewData, entry.row, builder);
		$(span).toggleClass('collapsed');
	}

	selectEntry(span, checkbox) {
		L.DomUtil.addClass(span, 'selected');
		span.setAttribute('aria-selected', true);
		span.tabIndex = 0;
		if (checkbox)
			checkbox.removeAttribute('tabindex');
	}

	unselectEntry(item) {
		L.DomUtil.removeClass(item, 'selected');
		item.removeAttribute('aria-selected');
		item.removeAttribute('tabindex');
		var itemCheckbox = item.querySelector('input');
		if (itemCheckbox)
			itemCheckbox.tabIndex = -1;
	}

	findEntryWithRow(entries, row) {
		for (var i in entries) {
			if (i == row)
				return entries[i];
			else if (entries[i].children) {
				var found = this.findEntryWithRow(entries[i].children, row);
				if (found)
					return found;
			}
		}

		return null;
	}

	changeCheckboxStateOnClick(checkbox, treeViewData, builder, entry) {
		if (checkbox.checked) {
			var foundEntry = this.findEntryWithRow(treeViewData.entries, entry.row);
			if (foundEntry)
				foundEntry.state = true;
			builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: true}, builder);
		} else {
			var foundEntry = this.findEntryWithRow(treeViewData.entries, entry.row);
			if (foundEntry)
				foundEntry.state = false;
			builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: false}, builder);
		}
	}

	createClickFunction(entryClass, parentContainer, span, checkbox, select, activate,
		builder, treeViewData, entry) {
		return () => {
			if (L.DomUtil.hasClass(span, 'disabled'))
				return;

			parentContainer.querySelectorAll('div')
				.forEach((item) => { this.unselectEntry(item); });

			parentContainer.querySelectorAll('.' + entryClass).forEach((item) => {
				this.selectEntry(item, checkbox);
				if (checkbox) {
					checkbox.checked = !checkbox.checked;
					this.changeCheckboxStateOnClick(checkbox, treeViewData, builder, entry);
				}

				if (select)
					builder.callback('treeview', 'select', treeViewData, entry.row, builder);

				if (activate)
					builder.callback('treeview', 'activate', treeViewData, entry.row, builder);
			});
		};
	}
}

// table -> tr -> td, simple list (no children), with or no headers, columns > 1
class SimpleTableControl extends TreeViewControl {
	constructor(data, builder) {
		super(data, builder);

		this._container = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview');
		this._container.id = data.id;
		this._columns = TreeViewControl.countColumns(data);
		this._hasState = TreeViewControl.hasState(data);
		this._isNavigator = this.isNavigator(data);
		this._singleClickActivate = TreeViewControl.isSingleClickActivate(data);

		this._container._tbody = this._container;
		this._container._thead = this._container;
		this._container.setAttribute('role', 'grid');
	}
}

// complex table treegrid, with children, with or no headers, columns > 1
class ComplexTableControl extends TreeViewControl {
	static Selected = null;

	constructor(data, builder, isRealTree) {
		super(data, builder);

		this._isRealTree = isRealTree;
		this._container = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview');
		this._container.id = data.id;
		this._columns = TreeViewControl.countColumns(data);
		this._hasState = TreeViewControl.hasState(data);
		this._isNavigator = this.isNavigator(data);

		this._container._tbody = this._container;
		this._container._thead = this._container;
		this._container.setAttribute('role', 'treegrid');
	}
}

class TreeViewFactory {
	constructor(data, builder) {
		const isRealTree = this.isRealTree(data);
		if (isRealTree || this.isHeaderListBox(data))
			this._implementation = new ComplexTableControl(data, builder, isRealTree);
		else
			this._implementation = new SimpleTableControl(data, builder);
	}

	isHeaderListBox(data) { return data.headers && data.headers.length !== 0; }

	isRealTree(data) {
		let isRealTreeView = false;
		for (var i in data.entries) {
			if (data.entries[i].children && data.entries[i].children.length) {
				isRealTreeView = true;
				break;
			}
		}
		return isRealTreeView;
	}

	fillHeaders(headers, builder) {
		if (!headers)
			return;

		let dummyCells = this._implementation._columns - headers.length;
		for (let index = 0; index < dummyCells; index++)
			this._implementation.fillHeader({text: ''}, builder);

		for (let index in headers)
			this._implementation.fillHeader(headers[index], builder);
	}

	fillEntries(data, entries, builder, level, parent) {
		for (let index in entries) {
			let entry = this._implementation.fillRow(data, entries[index], builder, level, parent);
			if (entries[index].children && entries[index].children.length)
				this.fillEntries(data, entries[index].children, builder, level + 1, entry);
		}
	}

	build(data, builder, parentContainer) {
		let container = this._implementation ? this._implementation.Container._tbody : null;

		var gridStyle = 'display: grid; grid-template-columns: repeat(' + this._implementation._columns  + ', auto);';
		container.style = gridStyle;

		this.fillHeaders(data.headers, builder);
		this.fillEntries(data, data.entries, builder, 1, container);

		if (this._implementation && this._implementation.Container.hasChildNodes()) {
			console.debug('treeview: new implementation');
			parentContainer.appendChild(this._implementation.Container);
			return true;
		}

		return false;
	}
}

JSDialog.treeView = function (parentContainer, data, builder) {
	// TODO: remove this hack
	var id = data.parent ? (data.parent.parent ? (data.parent.parent.parent ? (data.parent.parent.parent.id ? data.parent.parent.parent.id: null): null): null): null;
	if (id && typeof(id) === 'string' && id.startsWith('Navigator'))
		treeType = 'navigator';
	// TODO: remove this hack

	var factory = new TreeViewFactory(data, builder);
	if (!factory.build(data, builder, parentContainer)) {
		console.debug('treeview: legacy');
		return _treelistboxControl(parentContainer, data, builder);
	}

	return false;
};

JSDialog.isDnDActive = function () {
	var dndElements = document.querySelectorAll('.droptarget');
	return (dndElements && dndElements.length);
};
