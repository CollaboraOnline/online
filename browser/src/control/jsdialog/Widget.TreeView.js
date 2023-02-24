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
 *         { row: 0, columns [ { text: 'a' }, { text: 'b' } ] },
 *         { row: 1, columns [ { text: 'a2' }, { text: 'b2' }, selected: true ]}
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

/* global $ JSDialog */

function _createCheckbox(parentContainer, treeViewData, builder, entry) {
	var checkbox = L.DomUtil.create('input', builder.options.cssClass + ' ui-treeview-checkbox', parentContainer);
	checkbox.type = 'checkbox';

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

function _treelistboxEntry(parentContainer, treeViewData, entry, builder) {
	if (entry.text == '<dummy>')
		return;
	var disabled = treeViewData.enabled === 'false' || treeViewData.enabled === false;

	var li = L.DomUtil.create('li', builder.options.cssClass, parentContainer);

	if (!disabled && entry.state == null) {
		li.draggable = true;

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

	var expander = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview-expander ', span);

	if (entry.selected && (entry.selected === 'true' || entry.selected === true))
		L.DomUtil.addClass(span, 'selected');

	if (entry.state !== undefined)
		var checkbox = _createCheckbox(span, treeViewData, builder, entry);

	var text = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell', span);
	for (var i in entry.columns) {
		if (entry.columns[i].collapsed || entry.columns[i].expanded) {
			var iconId = entry.columns[i].collapsed ? entry.columns[i].collapsed : entry.columns[i].expanded;
			var newLength = iconId.lastIndexOf('.');
			if (newLength > 0)
				iconId = iconId.substr(0, newLength).replaceAll('/', '');
			else
				iconId = iconId.replaceAll('/', '');
			var icon = L.DomUtil.create('img', 'ui-listview-icon', text);
			icon.src = builder._createIconURL(iconId, true);
		} else if (entry.columns[i].text) {
			var innerText = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell-text', text);
			innerText.innerText = entry.columns[i].text || entry.text;
			innerText.tabIndex = 0;
		}
	}

	if (entry.children) {
		var ul = L.DomUtil.create('ul', builder.options.cssClass, li);
		for (var i in entry.children) {
			_treelistboxEntry(ul, treeViewData, entry.children[i], builder);
		}

		var toggleFunction = function() {
			$(span).toggleClass('collapsed');
		};

		if (!disabled) {
			if (entry.ondemand) {
				expander.tabIndex = 0;
				L.DomEvent.on(expander, 'click', function() {
					if (entry.ondemand && L.DomUtil.hasClass(span, 'collapsed'))
						builder.callback('treeview', 'expand', treeViewData, entry.row, builder);
					toggleFunction();
				});
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

	if (!disabled && entry.state == null) {
		var singleClick = treeViewData.singleclickactivate === 'true' || treeViewData.singleclickactivate === true;
		var clickFunction = function() {
			parentContainer.querySelectorAll('.ui-treeview-entry')
				.forEach(function (item) { L.DomUtil.removeClass(item, 'selected'); });
			L.DomUtil.addClass(span, 'selected');

			builder.callback('treeview', 'select', treeViewData, entry.row, builder);
			if (singleClick) {
				builder.callback('treeview', 'activate', treeViewData, entry.row, builder);
			}
		};

		text.addEventListener('click', clickFunction);
		text.addEventListener('keydown', function onEvent(event) {
			var preventDef = false;
			var listElements = $('#' + treeViewData.id + ' li');
			var currIndex = parseInt(entry.row);
			var treeLength = treeViewData.entries.length;
			var spanElement = 'span.ui-treeview-cell';
			if (event.key === 'Enter') {
				clickFunction();
				preventDef = true;
			} else if (event.key === 'ArrowDown') {
				if (currIndex === treeLength - 1)
					listElements.eq(0).find(spanElement).focus();
				else
					listElements.eq(currIndex + 1).find(spanElement).focus();
				preventDef = true;
			} else if (event.key === 'ArrowUp') {
				if (currIndex === 0)
					listElements.eq(treeLength - 1).find(spanElement).focus();
				else
					listElements.eq(currIndex - 1).find(spanElement).focus();
				preventDef = true;
			} else if (builder.callback('treeview', 'keydown', { treeViewData: treeViewData, key: event.key }, entry.row, builder)) {
				preventDef = true;
			}
			if (preventDef) {
				event.preventDefault();
				event.stopPropagation();
			}
		});

		if (!singleClick) {
			$(text).dblclick(function() {
				parentContainer.querySelectorAll('.ui-treeview-entry')
					.forEach(function (item) { L.DomUtil.removeClass(item, 'selected'); });
				L.DomUtil.addClass(span, 'selected');

				builder.callback('treeview', 'activate', treeViewData, entry.row, builder);
			});
		}
	}
}

function _headerlistboxEntry(parentContainer, treeViewData, entry, builder) {
	var disabled = treeViewData.enabled === 'false' || treeViewData.enabled === false;

	if (entry.selected && (entry.selected === 'true' || entry.selected === true))
		L.DomUtil.addClass(parentContainer, 'selected');

	if (entry.state !== undefined) {
		var td = L.DomUtil.create('td', '', parentContainer);
		_createCheckbox(td, treeViewData, builder, entry);
	}

	for (var i in entry.columns) {
		var td = L.DomUtil.create('td', '', parentContainer);

		if (entry.columns[i].collapsed || entry.columns[i].expanded) {
			var iconId = entry.columns[i].collapsed ? entry.columns[i].collapsed : entry.columns[i].expanded;
			var newLength = iconId.lastIndexOf('.');
			if (newLength > 0)
				iconId = iconId.substr(0, newLength).replaceAll('/', '');
			else
				iconId = iconId.replaceAll('/', '');
			var icon = L.DomUtil.create('img', 'ui-listview-icon', td);
			L.DomUtil.addClass(icon, iconId + 'img');
			icon.src = builder._createIconURL(iconId, true);
		} else if (entry.columns[i].text)
			td.innerText = entry.columns[i].text;

		if (!disabled) {
			var clickFunction = function() {
				parentContainer.parentNode.querySelectorAll('.ui-listview-entry')
					.forEach(function (item) { L.DomUtil.removeClass(item, 'selected'); });
				L.DomUtil.addClass(parentContainer, 'selected');

				builder.callback('treeview', 'select', treeViewData, entry.row, builder);
			};

			$(td).click(clickFunction);

			parentContainer.addEventListener('keydown', function onEvent(event) {
				var preventDef = false;
				if (event.key === 'Enter') {
					clickFunction();
					preventDef = true;
				} else if (builder.callback('treeview', 'keydown', { treeViewData: treeViewData, key: event.key }, entry.row, builder)) {
					preventDef = true;
				}
				if (preventDef) {
					event.preventDefault();
					event.stopPropagation();
				}
			});
		}
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
	var hasCheckboxes = data.entries && data.entries.length && data.entries[0].state !== undefined;
	if (hasCheckboxes)
		data.headers = [{ text: '' }].concat(data.headers);
	var hasIcons = data.entries && data.entries.length && _hasIcon(data.entries[0].columns);
	if (hasIcons)
		data.headers = [{ text: '' }].concat(data.headers);
	for (var h in data.headers) {
		var header = L.DomUtil.create('th', builder.options.cssClass, headers);
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

function _treelistboxControl(parentContainer, data, builder) {
	var table = L.DomUtil.create('table', builder.options.cssClass + ' ui-treeview', parentContainer);
	table.id = data.id;
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
		L.DomUtil.addClass(table, 'empty');
		return false;
	}

	if (isHeaderListBox) {
		// list view with headers
		for (var i in data.entries) {
			var tr = L.DomUtil.create('tr', builder.options.cssClass + ' ui-listview-entry', tbody);
			tr.tabIndex = 0;
			_headerlistboxEntry(tr, data, data.entries[i], builder);
		}

		var firstSelected = tbody.querySelector('.ui-listview-entry.selected');
	} else {
		// tree view
		var ul = L.DomUtil.create('ul', builder.options.cssClass, tbody);

		for (i in data.entries) {
			_treelistboxEntry(ul, data, data.entries[i], builder);
		}

		firstSelected = tbody.querySelector('.ui-treeview-entry.selected');
	}

	if (firstSelected) {
		var observer = new IntersectionObserver(function (entries, observer) {
			entries.forEach(function (entry) {
				if (entry.intersectionRatio > 0) {
					if (isHeaderListBox)
						table.scrollTop = firstSelected.offsetTop - tbody.offsetTop;
					else
						table.scrollTop = firstSelected.parentNode.offsetTop - tbody.offsetTop;
					observer.disconnect();
				}
			});
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
	var buildInnerData = _treelistboxControl(parentContainer, data, builder);
	return buildInnerData;
};
