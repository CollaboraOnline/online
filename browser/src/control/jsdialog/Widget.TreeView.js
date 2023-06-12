/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.TreeView - tree view widget with or without header
 *
 * Example JSON:
 * a) without header
 * {
 *     id: 'id',
 *     type: 'treelistbox',
 *     entries: [
 *         { row: 0, text: 'first entry', children: [ { row: 2, text: 'first subentry' } ] },
 *         { row: 1, text: 'second entry', selected: true, state: false, ondemand: true }
 *     ]
 * }
 *
 * b) with headers
 * {
 *     id: 'id',
 *     type: 'treelistbox',
 *     headers: [ { text: 'first column' }, { text: 'second' }],
 *     entries: [
 *         { row: 0, columns [ { text: 'a' }, { collapsed: 'collapsedIcon.svg' } ] },
 *         { row: 1, columns [ { text: 'a2' }, { expanded: 'expandedIcon.svg' }, selected: true ]}
 *     ]
 * }
 *
 * 'row' property is used in the callback to differentiate entries
 * 'state' property defines if entry has the checkbox (false/true), when is missing - no checkbox
 * 'ondemand' property can be set to provide nodes lazy loading
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global $ _ JSDialog */

var treeType = '';

function _createCheckbox(parentContainer, treeViewData, builder, entry) {
	var checkbox = L.DomUtil.create('input', builder.options.cssClass + ' ui-treeview-checkbox', parentContainer);
	checkbox.type = 'checkbox';
	checkbox.tabIndex = -1;

	if (entry.state === 'true' || entry.state === true)
		checkbox.checked = true;

	if (treeViewData.enabled !== false && treeViewData.enabled !== 'false') {
		$(checkbox).change(function() {
			if (this.checked) {
				treeViewData.entries[entry.row].state = true;
				builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: true}, builder);
			} else {
				treeViewData.entries[entry.row].state = false;
				builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: false}, builder);
			}
		});
	}

	return checkbox;
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

function _treelistboxEntry(parentContainer, treeViewData, entry, builder, isTreeView, treeRoot) {
	if (entry.text == '<dummy>')
		return;

	treeRoot = treeRoot ? treeRoot : parentContainer;

	var disabled = treeViewData.enabled === 'false' || treeViewData.enabled === false;

	var li = L.DomUtil.create('li', builder.options.cssClass, parentContainer);

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

	var expander = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview-expander ', span);

	if (entry.state !== undefined)
		var checkbox = _createCheckbox(span, treeViewData, builder, entry);

	if (entry.selected && (entry.selected === 'true' || entry.selected === true))
		_selectEntry(span, checkbox);

	var text = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell', span);
	for (var i in entry.columns) {
		if (entry.columns[i].collapsed || entry.columns[i].expanded) {
			var icon = L.DomUtil.create('img', 'ui-listview-icon', text);

			if (treeType === 'navigator')
				icon.draggable = false;

			var iconId = _getCellIconId(entry.columns[i]);
			L.DomUtil.addClass(icon, iconId + 'img');
			var iconURL = builder._createIconURL(iconId, true);
			L.LOUtil.setImage(icon, iconURL.split('/').pop(), builder.map.getDocType());
			L.DomUtil.addClass(span, 'ui-listview-expandable-with-icon');
		} else if (entry.columns[i].text) {
			var innerText = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell-text', text);
			innerText.innerText = entry.columns[i].text || entry.text;
		}
	}

	var toggleFunction = function() {
		$(span).toggleClass('collapsed');
	};

	var expandFunction = function () {
		if (entry.ondemand && L.DomUtil.hasClass(span, 'collapsed'))
			builder.callback('treeview', 'expand', treeViewData, entry.row, builder);
		toggleFunction();
	};

	if (entry.children) {
		var ul = L.DomUtil.create('ul', builder.options.cssClass, li);
		for (var i in entry.children) {
			_treelistboxEntry(ul, treeViewData, entry.children[i], builder, isTreeView, treeRoot);
		}

		if (!disabled) {
			if (entry.ondemand) {
				L.DomEvent.on(expander, 'click', expandFunction);
			} else {
				$(expander).click(toggleFunction);
			}

			// block expand/collapse on checkbox
			if (entry.state)
				$(checkbox).click(toggleFunction);
		}

		if (entry.ondemand)
			L.DomUtil.addClass(span, 'collapsed');
	}

	if (!disabled) {
		var singleClick = treeViewData.singleclickactivate === 'true' || treeViewData.singleclickactivate === true;
		var clickFunction = _createClickFunction('.ui-treeview-entry', treeRoot, span, checkbox,
			true, singleClick, builder, treeViewData, entry);
		var doubleClickFunction = _createClickFunction('.ui-treeview-entry', treeRoot, span, checkbox,
			false, true, builder, treeViewData, entry);

		text.addEventListener('click', clickFunction);
		span.addEventListener('keydown', function onEvent(event) {
			var preventDef = false;
			if (event.key === 'Enter' || event.key === ' ') {
				if (event.key === 'Enter')
					doubleClickFunction();
				else
					clickFunction();

				if (checkbox)
					checkbox.click();
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
			$(text).dblclick(doubleClickFunction);
		}
	}
}

function _headerlistboxEntry(parentContainer, treeViewData, entry, builder) {
	var disabled = treeViewData.enabled === 'false' || treeViewData.enabled === false;

	if (entry.state !== undefined) {
		var td = L.DomUtil.create('td', '', parentContainer);
		var checkbox = _createCheckbox(td, treeViewData, builder, entry);
	}

	if (entry.selected && (entry.selected === 'true' || entry.selected === true))
		_selectEntry(parentContainer, checkbox);

	var clickFunction = _createClickFunction('.ui-listview-entry', parentContainer.parentNode,
		parentContainer, checkbox, true, false, builder, treeViewData, entry);

	for (var i in entry.columns) {
		var td = L.DomUtil.create('td', '', parentContainer);
		td.setAttribute('role', 'gridcell');

		if (entry.columns[i].collapsed || entry.columns[i].expanded) {
			var icon = L.DomUtil.create('img', 'ui-listview-icon', td);
			var iconId = _getCellIconId(entry.columns[i]);
			L.DomUtil.addClass(icon, iconId + 'img');
			var iconURL = builder._createIconURL(iconId, true);
			L.LOUtil.setImage(icon, iconURL.split('/').pop(), builder.map.getDocType());
		} else if (entry.columns[i].text)
			td.innerText = entry.columns[i].text;

		if (!disabled)
			$(td).click(clickFunction);
	}

	if (!disabled) {
		parentContainer.addEventListener('keydown', function onEvent(event) {
			if (event.key === 'Enter' || event.key === ' ') {
				clickFunction();
				if (checkbox)
					checkbox.click();
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
		if (columns[i].collapsed !== undefined)
			return true;
	return false;
}

function _createHeaders(tbody, data, builder) {
	var headers = L.DomUtil.create('tr', builder.options.cssClass + ' ui-treeview-header', tbody);
	headers.setAttribute('role', 'row');
	var hasCheckboxes = data.entries && data.entries.length && data.entries[0].state !== undefined;
	if (hasCheckboxes)
		data.headers = [{ text: '' }].concat(data.headers);
	var hasIcons = data.entries && data.entries.length && _hasIcon(data.entries[0].columns);
	if (hasIcons)
		data.headers = [{ text: '' }].concat(data.headers);
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
			var parent = listElements[i].parentNode.parentNode;
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
		else if (currIndex < treeLength - 1)
			_changeFocusedRow(listElements, currIndex, currIndex + 1);

		preventDef = true;
	} else if (event.key === 'ArrowUp') {
		if (currIndex < 0)
			_changeFocusedRow(listElements, currIndex, treeLength - 1);
		else if (currIndex > 0)
			_changeFocusedRow(listElements, currIndex, currIndex - 1);

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

	var isHeaderListBox = data.headers && data.headers.length !== 0;
	if (isHeaderListBox)
		_createHeaders(tbody, data, builder);

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
		if (data.id === 'contenttree') {
			var tr = L.DomUtil.create('tr', builder.options.cssClass + ' ui-listview-entry', tbody);
			tr.setAttribute('role', 'row');
			tr.innerText = _('Headings and objects that you add to the document will appear here');
		} else {
			L.DomUtil.addClass(table, 'empty');
		}
		return false;
	}

	if (isHeaderListBox) {
		// list view with headers
		table.setAttribute('role', 'grid');

		for (var i in data.entries) {
			var tr = L.DomUtil.create('tr', builder.options.cssClass + ' ui-listview-entry', tbody);
			tr.setAttribute('role', 'row');
			_headerlistboxEntry(tr, data, data.entries[i], builder);
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

JSDialog.treeView = function (parentContainer, data, builder) {
	var id = data.parent ? (data.parent.parent ? (data.parent.parent.parent ? (data.parent.parent.parent.id ? data.parent.parent.parent.id: null): null): null): null;

	if (id && typeof(id) === 'string' && id.startsWith('Navigator'))
		treeType = 'navigator';

	var buildInnerData = _treelistboxControl(parentContainer, data, builder);
	return buildInnerData;
};
