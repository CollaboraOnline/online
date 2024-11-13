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

// TODO: remove this hack
var treeType = '';
var lastClickHelperRow = -1;
var lastClickHelperId = '';
// TODO: remove this hack

class TreeViewControl {

	constructor(data, builder, isRealTree) {
		this._isRealTree = isRealTree;
		this._container = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview');
		this._container.id = data.id;
		this._columns = TreeViewControl.countColumns(data);
		this._hasState = TreeViewControl.hasState(data);
		this._hasIcon = TreeViewControl.hasIcon(data);
		this._isNavigator = this.isNavigator(data);
		this._singleClickActivate = TreeViewControl.isSingleClickActivate(data);

		this._container._tbody = this._container;
		this._container._thead = this._container;
		this._container.filterEntries = this.filterEntries.bind(this);

		this.setupDragAndDrop(data, builder);
		this.setupKeyEvents(data, builder);

		this._isRealTree = isRealTree;
		if (isRealTree)
			this._container.setAttribute('role', 'treegrid');
		else
			this._container.setAttribute('role', 'grid');
	}

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

	static hasIcon(data) {
		for (var e in data.entries) {
			const entry = data.entries[e];
			for (var i in entry.columns) {
				if (entry.columns[i].collapsed !== undefined ||
					entry.columns[i].expanded !== undefined ||
					entry.columns[i].collapsedimage !== undefined ||
					entry.columns[i].expandedimage !== undefined) {
					return true;
				}
			}
		}
		return false;
	}

	findEntryWithRow(entries, row) {
		for (let i in entries) {
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
		let foundEntry;
		if (checkbox.checked) {
			foundEntry = this.findEntryWithRow(treeViewData.entries, entry.row);
			if (foundEntry)
				checkbox.checked = foundEntry.state = true;
			builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: true}, builder);
		} else {
			foundEntry = this.findEntryWithRow(treeViewData.entries, entry.row);
			if (foundEntry)
				checkbox.checked = foundEntry.state = false;
			builder.callback('treeview', 'change', treeViewData, {row: entry.row, value: false}, builder);
		}
	}

	createCheckbox(parent, treeViewData, builder, entry) {
		let checkbox = L.DomUtil.create('input', builder.options.cssClass + ' ui-treeview-checkbox', parent);
		checkbox.type = 'checkbox';
		checkbox.tabIndex = -1;

		if (entry.state === true)
			checkbox.checked = true;

		return checkbox;
	}

	createRadioButton(parent, treeViewData, builder, entry) {
		let radioButton = L.DomUtil.create('input', builder.options.cssClass + ' ui-treeview-checkbox', parent);
		radioButton.type = 'radio';
		radioButton.tabIndex = -1;

		if (entry.state === true)
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

		if (entry.enabled === false)
			selectionElement.disabled = true;

		if (treeViewData.enabled !== false) {
			selectionElement.addEventListener('change', () => {
				this.changeCheckboxStateOnClick(selectionElement, treeViewData, builder, entry);
			});
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

		let th = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview-header',
					  this._container._thead);
		let span = L.DomUtil.create('span', builder.options.cssClass +
					    ' ui-treeview-header-text', th);

		span.innerText = header.text;
		L.DomUtil.create('span', builder.options.cssClass +
			' ui-treeview-header-sort-icon', span);
	}

	fillRow(data, entry, builder, level, parent) {
		let tr = L.DomUtil.create('div', 'ui-treeview-entry', parent);
		let dummyColumns = this._columns - (entry.columns ? entry.columns.length : 0);
		if (this._hasState) dummyColumns++;
		tr.style.gridColumn = '1 / ' + (this._columns + dummyColumns + 1);

		let selectionElement;
		if (this._hasState) {
			let td = L.DomUtil.create('div', '', tr);
			selectionElement = this.createSelectionElement(td, data, entry, builder);
			if (this._isRealTree) td.setAttribute('aria-level', level);
		}

		this.fillCells(entry, builder, data, tr, level, selectionElement);

		this.setupRowProperties(tr, entry, level, selectionElement);
		this.setupRowDragAndDrop(tr, data, entry, builder);
	}

	highlightAllTreeViews (highlight) {
		if (highlight) {
			document.querySelectorAll('.ui-treeview')
				.forEach((item) => { L.DomUtil.addClass(item, 'droptarget'); });
		} else {
			document.querySelectorAll('.ui-treeview')
				.forEach((item) => { L.DomUtil.removeClass(item, 'droptarget'); });
		}
	}

	setupDragAndDrop (treeViewData, builder) {
		if (treeViewData.enabled !== false) {
			this._container.ondrop = (ev) => {
				ev.preventDefault();
				var row = ev.dataTransfer.getData('text');
				builder.callback('treeview', 'dragend', treeViewData, row, builder);
				this.highlightAllTreeViews(false);
			};
			this._container.ondragover = (event) => { event.preventDefault(); };
		}
	}

	setupRowDragAndDrop (tr, treeViewData, entry, builder) {
		if (treeViewData.enabled !== false && entry.state == null) {
			tr.draggable = treeType === 'navigator' ? false : true;

			tr.ondragstart = (ev) => {
				ev.dataTransfer.setData('text', entry.row);
				builder.callback('treeview', 'dragstart', treeViewData, entry.row, builder);

				this.highlightAllTreeViews(true);
			};

			tr.ondragend = () => { this.highlightAllTreeViews(false); };
			tr.ondragover = (event) => { event.preventDefault(); };
		}
	}

	setupRowProperties(tr, entry, level, selectionElement) {
		if (entry.children)
			tr.setAttribute('aria-expanded', true);

		if (level !== undefined && this._isRealTree)
			tr.setAttribute('aria-level', level);

		if (entry.selected === true)
			this.selectEntry(tr, selectionElement);

		const disabled = entry.enabled === false;
		if (disabled)
			L.DomUtil.addClass(tr, 'disabled');

		if (entry.ondemand || entry.collapsed) {
			L.DomUtil.addClass(tr, 'collapsed');
			tr.setAttribute('aria-expanded', false);
		}
	}

	fillCells(entry, builder, treeViewData, tr, level, selectionElement) {
		let td, expander, span, text, img, icon, iconId, iconName, link, innerText;

		let rowElements = [];

		// row is a separator
		if (this.isSeparator(entry))
			L.DomUtil.addClass(tr, 'context-menu-separator');

		// column for expander
		if (this._isRealTree) {
			td = L.DomUtil.create('div', 'ui-treeview-expander-column', tr);
			rowElements.push(td);

			if (entry.children && entry.children.length)
				expander = L.DomUtil.create('div', builder.options.cssClass + ' ui-treeview-expander', td);
		}

		// dummy columns (for missing elements in current row - eg. icon)
		let dummyColumns = this._columns - (entry.columns ? entry.columns.length : 0);
		if (this._isRealTree) dummyColumns--;
		for (let index = dummyColumns; index > 0; index--) {
			td = L.DomUtil.create('div', '', tr);
			rowElements.push(td);
		}

		// regular columns
		for (let index in entry.columns) {
			td = L.DomUtil.create('div', '', tr);
			rowElements.push(td);

			span = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell', td);
			text = L.DomUtil.create('span', builder.options.cssClass + ' ui-treeview-cell-text', span);

			if (entry.text == '<dummy>')
				continue;

			img = entry.columns[index].collapsedimage ? entry.columns[index].collapsedimage :
				entry.columns[index].expandedimage;
			if (img) {
				L.DomUtil.addClass(td, 'ui-treeview-icon-column');
				this.createImageColumn(text, builder, img);
			} else if (entry.columns[index].collapsed || entry.columns[index].expanded) {
				L.DomUtil.addClass(td, 'ui-treeview-icon-column');
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

			var singleClick = this._singleClickActivate;

			// row sub-elements
			for (let i in rowElements) {
				let element = rowElements[i];

				// setup properties
				element.setAttribute('role', 'gridcell');
			}
		}

		// setup callbacks
		var clickFunction = this.createClickFunction(tr, selectionElement,
			true, singleClick, builder, treeViewData, entry);
		var doubleClickFunction = this.createClickFunction(tr, selectionElement,
			false, true, builder, treeViewData, entry);

		tr.addEventListener('click', clickFunction);

		if (!singleClick) {
			if (window.ThisIsTheiOSApp) {
				// TODO: remove this hack
				tr.addEventListener('click', () => {
					if (L.DomUtil.hasClass(tr, 'disabled'))
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
				$(tr).dblclick(doubleClickFunction);
			}
		}

		const toggleFunction =
				() => { this.toggleEntry(tr, treeViewData, entry, builder); };
		const expandFunction =
				() => { this.expandEntry(tr, treeViewData, entry, builder); };

		if (expander && entry.children && entry.children.length) {
			if (entry.ondemand) {
				L.DomEvent.on(expander, 'click', expandFunction);
			} else {
				$(expander).click(((e) => {
					if (entry.state && e.target === selectionElement)
						e.preventDefault(); // do not toggle on checkbox
					toggleFunction();
				}));
			}
		}

		this.setupEntryKeyEvent(tr, entry, selectionElement, expander, clickFunction);
	}

	setupEntryKeyEvent(tr, entry, selectionElement, expander, clickFunction) {
		if (entry.enabled === false)
			return;

		tr.addEventListener('keydown', (event) => {
			if (event.key === ' ' && expander) {
				expander.click();
				tr.focus();
				event.preventDefault();
				event.stopPropagation();
			} else if (event.key === 'Enter' || event.key === ' ') {
				clickFunction();
				if (selectionElement)
					selectionElement.click();
				tr.focus();
				event.preventDefault();
				event.stopPropagation();
			} else if (event.key === 'Tab') {
				if (!L.DomUtil.hasClass(tr, 'selected'))
					this.unselectEntry(tr); // remove tabIndex
			}
		});
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

	createClickFunction(parentContainer, checkbox, select, activate,
		builder, treeViewData, entry) {
		return (e) => {
			if (e && e.target === checkbox)
				return; // allow default handler to trigger change event

			if (e && L.DomUtil.hasClass(parentContainer, 'disabled')) {
				e.preventDefault();
				return;
			}

			this._container.querySelectorAll('div.selected')
				.forEach((item) => { this.unselectEntry(item); });

			this.selectEntry(parentContainer, checkbox);
			if (checkbox)
				this.changeCheckboxStateOnClick(checkbox, treeViewData, builder, entry);

			if (select)
				builder.callback('treeview', 'select', treeViewData, entry.row, builder);

			if (activate)
				builder.callback('treeview', 'activate', treeViewData, entry.row, builder);

			if (e) e.preventDefault();
		};
	}

	filterEntries(filter) {
		if (this.filterTimer)
			clearTimeout(this.filterTimer);

		var entriesToHide = [];
		var allEntries = this._container.querySelectorAll('.ui-treeview-entry');

		filter = filter.trim();

		allEntries.forEach((entry) => {
			if (filter === '')
				return;

			var cells = entry.querySelectorAll('div');
			for (var i in cells) {
				var entryText = cells[i].innerText;
				if (entryText && entryText.toLowerCase().indexOf(filter.toLowerCase()) >= 0) {
					return;
				}
			}

			entriesToHide.push(entry);
		});

		this.filterTimer = setTimeout(() => {
			allEntries.forEach((entry) => { L.DomUtil.removeClass(entry, 'hidden'); });
			entriesToHide.forEach((entry) => { L.DomUtil.addClass(entry, 'hidden'); });
		}, 100);
	}

	setupKeyEvents(data, builder) {
		this._container.addEventListener('keydown', (event) => {
			const listElements = this._container.querySelectorAll(
				this._isRealTree ? '.ui-treeview-cell-text' : '.ui-treeview-entry');
			this.handleKeyEvent(event, listElements, builder, data);
		});
	}

	changeFocusedRow(listElements, fromIndex, toIndex) {
		var nextElement = listElements.at(toIndex);
		nextElement.tabIndex = 0;
		nextElement.focus();

		var nextInput = listElements.at(toIndex).querySelectorAll('td input');
		if (nextInput && nextInput.length)
			nextInput.get(0).removeAttribute('tabindex');

		if (fromIndex >= 0) {
			var oldElement = listElements.at(fromIndex);
			if (L.DomUtil.hasClass(oldElement, 'selected'))
				return;

			oldElement.removeAttribute('tabindex');
			var oldInput = listElements.at(fromIndex).querySelectorAll('td input');
			if (oldInput && oldInput.length)
				oldInput.get(0).tabIndex = -1;
		}
	}

	getCurrentEntry(listElements) {
		var focusedElement = document.activeElement;
		// tr - row itself
		var currIndex = listElements.indexOf(focusedElement);
		// input - child of a row
		if (currIndex < 0)
			currIndex = listElements.indexOf(focusedElement.parentNode.parentNode);
		// no focused entry - try with selected one
		if (currIndex < 0) {
			var selected = listElements.filter((o) => { return o.classList.contains('.selected'); });
			if (selected && selected.length)
				currIndex = listElements.indexOf(selected[0]);
		}
		if (currIndex < 0) {
			for (var i in listElements) {
				var parent = listElements[i].parentNode;

				if (parent)
					parent = parent.parentNode;
				else
					break;

				if (parent && L.DomUtil.hasClass(parent, 'selected')) {
					currIndex = listElements.indexOf(listElements[i]);
					break;
				}
			}
		}

		return currIndex;
	}

	handleKeyEvent(event, nodeList, builder, data) {
		var preventDef = false;
		var listElements = Array.from(nodeList); // querySelector returns NodeList not array
		var treeLength = listElements.length;
		var currIndex = this.getCurrentEntry(listElements);

		if (event.key === 'ArrowDown') {
			if (currIndex < 0)
				this.changeFocusedRow(listElements, currIndex, 0);
			else {
				var nextIndex = currIndex + 1;
				while (nextIndex < treeLength - 1 && listElements[nextIndex].clientHeight <= 0)
					nextIndex++;
				if (nextIndex < treeLength)
					this.changeFocusedRow(listElements, currIndex, nextIndex);
			}
			preventDef = true;
		} else if (event.key === 'ArrowUp') {
			if (currIndex < 0)
				this.changeFocusedRow(listElements, currIndex, treeLength - 1);
			else {
				var nextIndex = currIndex - 1;
				while (nextIndex >= 0 && listElements[nextIndex].clientHeight <= 0)
					nextIndex--;
				if (nextIndex >= 0)
					this.changeFocusedRow(listElements, currIndex, nextIndex);
			}

			preventDef = true;
		} else if (data.fireKeyEvents &&
			builder.callback('treeview', 'keydown', { id: data.id, key: event.key }, currIndex, builder)) {
			// used in mentions
			preventDef = true;
		}

		if (preventDef) {
			event.preventDefault();
			event.stopPropagation();
		}
	}
}

class TreeViewFactory {
	constructor(data, builder) {
		const isRealTree = this.isRealTree(data); // has expandable entries
		this._implementation = new TreeViewControl(data, builder, isRealTree);
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

		this._implementation._container._thead = L.DomUtil.create('div', 'ui-treeview-headers', this._implementation._container);

		let dummyCells = this._implementation._columns - headers.length;
		if (this._implementation._hasState)
			dummyCells++;

		for (let index = 0; index < dummyCells; index++) {
			this._implementation.fillHeader({text: ''}, builder);
			if (index === 0 && this._implementation._hasState)
				L.DomUtil.addClass(this._implementation._container._thead.lastChild, 'ui-treeview-state-column');
			else
				L.DomUtil.addClass(this._implementation._container._thead.lastChild, 'ui-treeview-icon-column');
		}

		for (let index in headers) {
			this._implementation.fillHeader(headers[index], builder);

			var sortByColumn = (columnIndex, up) => {
				var compareFunction = (a, b) => {
					if (!a || !b)
						return 0;

					var tda = a.querySelectorAll('div').item(columnIndex);
					var tdb = b.querySelectorAll('div').item(columnIndex);

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

				var that = this;
				this._implementation._container.querySelectorAll(':not(.ui-treeview-expanded-content) .ui-treeview-entry')
					.forEach((item) => { toSort.push(item); that._implementation._container.removeChild(item); });

				toSort.sort(compareFunction);

				toSort.forEach((item) => {
					that._implementation._container.insertBefore(
						item,
						that._implementation._container.lastChild.nextSibling);
				});
			};

			var clickFunction = (columnIndex, icon) => {
				var clearSorting = () => {
					var icons = this._implementation._container._thead.querySelectorAll('.ui-treeview-header-sort-icon');
					icons.forEach((icon) => {
						L.DomUtil.removeClass(icon, 'down');
						L.DomUtil.removeClass(icon, 'up');
					});
				};

				return () => {
					if (L.DomUtil.hasClass(icon, 'down')) {
						clearSorting();
						L.DomUtil.addClass(icon, 'up');
						sortByColumn(columnIndex + dummyCells, true);
					} else {
						clearSorting();
						L.DomUtil.addClass(icon, 'down');
						sortByColumn(columnIndex + dummyCells, false);
					}
				};
			};

			this._implementation._container._thead.lastChild.onclick =
				clickFunction(parseInt(index),
					this._implementation._container._thead.lastChild.querySelector('.ui-treeview-header-sort-icon'));
		}
	}

	makeEmptyList(data, builder) {
		// contentbox and tree can never be empty, 1 page or 1 sheet always exists
		if (data.id === 'contenttree') {
			var tr = L.DomUtil.create('div', builder.options.cssClass + ' ui-treview-entry', this._container);
			tr.innerText = _('Headings and objects that you add to the document will appear here');
		} else {
			L.DomUtil.addClass(this._container, 'empty');
			if (data.hideIfEmpty)
				L.DomUtil.addClass(this._container, 'hidden');
		}
	}

	fillEntries(data, entries, builder, level, parent) {
		for (let index in entries) {
			this._implementation.fillRow(data, entries[index], builder, level, parent);

			if (entries[index].children && entries[index].children.length) {
				L.DomUtil.addClass(parent.lastChild, 'ui-treeview-expandable');
				const subGrid = L.DomUtil.create('div', 'ui-treeview-expanded-content', parent);

				let dummyColumns = this._implementation._columns - (entries[index].columns ? entries[index].columns.length : 0);
				if (this._hasState) dummyColumns++;
				subGrid.style.gridColumn = '1 / ' + (this._implementation._columns + dummyColumns + 1);

				this.fillEntries(data, entries[index].children, builder, level + 1, subGrid);
			}
		}

		if (!entries || !entries.length)
			this.makeEmptyList(data, builder);
	}

	build(data, builder, parentContainer) {
		let container = this._implementation ? this._implementation.Container._tbody : null;

		this.fillHeaders(data.headers, builder);
		this.fillEntries(data, data.entries, builder, 1, container);

		parentContainer.appendChild(this._implementation.Container);

		return true;
	}
}

JSDialog.treeView = function (parentContainer, data, builder) {
	// TODO: remove this hack
	var id = data.parent ? (data.parent.parent ? (data.parent.parent.parent ? (data.parent.parent.parent.id ? data.parent.parent.parent.id: null): null): null): null;
	if (id && typeof(id) === 'string' && id.startsWith('Navigator'))
		treeType = 'navigator';
	// TODO: remove this hack

	var factory = new TreeViewFactory(data, builder);
	factory.build(data, builder, parentContainer);

	treeType = '';

	return false;
};

JSDialog.isDnDActive = function () {
	var dndElements = document.querySelectorAll('.droptarget');
	return (dndElements && dndElements.length);
};
