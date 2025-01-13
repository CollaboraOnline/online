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

declare var JSDialog: any;

// TODO: remove this hack
var lastClickHelperRow: string | number = -1;
var lastClickHelperId = '';
// TODO: remove this hack

class TreeViewControl {
	_isRealTree: boolean;
	_container: HTMLElement;
	_tbody: HTMLElement;
	_thead: HTMLElement = null;
	_columns: number;
	_hasState: boolean;
	_hasIcon: boolean;
	_isNavigator: boolean;
	_singleClickActivate: boolean;
	_filterTimer: ReturnType<typeof setTimeout>;
	_data: TreeWidgetJSON;
	_builder: any;

	constructor(data: TreeWidgetJSON, builder: any) {
		this._isRealTree = this.isRealTree(data);
		this._container = L.DomUtil.create(
			'div',
			builder.options.cssClass + ' ui-treeview',
		);
		this._container.id = data.id;
		this._columns = TreeViewControl.countColumns(data);
		this._hasState = TreeViewControl.hasState(data);
		this._hasIcon = TreeViewControl.hasIcon(data);
		this._isNavigator = this.isNavigator(data);
		this._singleClickActivate = TreeViewControl.isSingleClickActivate(data);
		this._data = data;
		this._builder = builder;

		this._tbody = this._container;
		(this._container as any).filterEntries = this.filterEntries.bind(this);

		this.setupDragAndDrop(data, builder);

		if (this._isRealTree) {
			this._container.setAttribute('role', 'treegrid');
			if (!data.headers || data.headers.length === 0)
				L.DomUtil.addClass(this._container, 'ui-treeview-tree');
		} else this._container.setAttribute('role', 'grid');

		if (data.enabled !== false) {
			this._container.addEventListener('click', this.onClick.bind(this));
			this._container.addEventListener(
				'dblclick',
				this.onDoubleClick.bind(this),
			);
			this._container.addEventListener('keydown', this.onKeyDown.bind(this));
			this._container.addEventListener(
				'contextmenu',
				this.onContextMenu.bind(this),
			);
		}
	}

	get Container() {
		return this._container;
	}

	static getElement(elem: any, role: any) {
		while (elem && elem.getAttribute('role') !== role) {
			elem = elem.parentElement;
		}
		return elem;
	}

	static countColumns(data: TreeWidgetJSON) {
		if (!data.entries || !data.entries.length)
			return data.headers ? data.headers.length : 1;

		var maxColumns = 0;
		for (var e in data.entries) {
			const entry = data.entries[e];
			const count = entry.columns ? entry.columns.length : 0;
			if (count > maxColumns) maxColumns = count;
		}

		return maxColumns;
	}

	static hasState(data: TreeWidgetJSON) {
		for (var e in data.entries) {
			const entry = data.entries[e];
			if (entry.state !== undefined) return true;
		}

		return false;
	}

	static hasIcon(data: TreeWidgetJSON) {
		for (var e in data.entries) {
			const entry = data.entries[e];
			for (var i in entry.columns) {
				if (
					entry.columns[i].collapsed !== undefined ||
					entry.columns[i].expanded !== undefined ||
					entry.columns[i].collapsedimage !== undefined ||
					entry.columns[i].expandedimage !== undefined
				) {
					return true;
				}
			}
		}
		return false;
	}

	createCheckbox(
		parent: HTMLElement,
		treeViewData: TreeWidgetJSON,
		builder: any,
		entry: TreeEntryJSON,
	) {
		const checkbox = L.DomUtil.create(
			'input',
			builder.options.cssClass + ' ui-treeview-checkbox',
			parent,
		);
		checkbox.type = 'checkbox';
		checkbox.tabIndex = -1;

		if (entry.state === true) checkbox.checked = true;

		return checkbox;
	}

	createRadioButton(
		parent: HTMLElement,
		treeViewData: TreeWidgetJSON,
		builder: any,
		entry: TreeEntryJSON,
	) {
		const radioButton = L.DomUtil.create(
			'input',
			builder.options.cssClass + ' ui-treeview-checkbox',
			parent,
		);
		radioButton.type = 'radio';
		radioButton.tabIndex = -1;

		if (entry.state === true) radioButton.checked = true;

		return radioButton;
	}

	createSelectionElement(parent: HTMLElement, entry: TreeEntryJSON) {
		let selectionElement: any;
		const checkboxtype = this._data.checkboxtype;
		if (checkboxtype == 'radio') {
			selectionElement = this.createRadioButton(
				parent,
				this._data,
				this._builder,
				entry,
			);
		} else {
			selectionElement = this.createCheckbox(
				parent,
				this._data,
				this._builder,
				entry,
			);
		}
		selectionElement._state = entry.state;
		selectionElement._row = entry.row;

		if (entry.enabled === false) selectionElement.disabled = true;

		return selectionElement;
	}

	isSeparator(element: TreeColumnJSON) {
		if (!element.text) return false;
		return element.text.toLowerCase() === 'separator';
	}

	static isSingleClickActivate(treeViewData: TreeWidgetJSON) {
		return treeViewData.singleclickactivate === true;
	}

	isNavigator(data: TreeWidgetJSON) {
		return (
			data.id && typeof data.id === 'string' && data.id.startsWith('Navigator')
		);
	}

	getCellIconId(cellData: TreeColumnJSON) {
		let iconId = (
			cellData.collapsed ? cellData.collapsed : cellData.expanded
		) as string;
		const newLength = iconId.lastIndexOf('.');
		if (newLength > 0)
			iconId = (iconId.substr(0, newLength) as any).replaceAll('/', '');
		else iconId = (iconId as any).replaceAll('/', '');
		return iconId;
	}

	createImageColumn(
		parentContainer: HTMLElement,
		builder: any,
		imageUrl: string,
	) {
		const colorPreviewButton = L.DomUtil.create(
			'img',
			builder.options.cssClass + ' ui-treeview-checkbox',
			parentContainer,
		);
		colorPreviewButton.src = imageUrl;
		colorPreviewButton.style.setProperty(
			'outline',
			'1px solid var(--color-btn-border)',
		);
		colorPreviewButton.style.setProperty('vertical-align', 'middle');
		colorPreviewButton.tabIndex = -1;

		return colorPreviewButton;
	}

	isExpanded(entry: TreeEntryJSON) {
		for (const i in entry.columns)
			if (entry.columns[i].expanded === true) return true;
		return false;
	}

	fillHeader(header: TreeHeaderJSON) {
		if (!header) return;

		const th = L.DomUtil.create(
			'div',
			this._builder.options.cssClass + ' ui-treeview-header',
			this._thead,
		);
		const span = L.DomUtil.create(
			'span',
			this._builder.options.cssClass + ' ui-treeview-header-text',
			th,
		);

		span.innerText = header.text;

		if (header.sortable !== false) {
			L.DomUtil.create(
				'span',
				this._builder.options.cssClass + ' ui-treeview-header-sort-icon',
				span,
			);
		}
	}

	fillRow(entry: TreeEntryJSON, level: number, parent: HTMLElement) {
		const tr = L.DomUtil.create(
			'div',
			this._builder.options.cssClass + ' ui-treeview-entry',
			parent,
		);
		let dummyColumns = 0;
		if (this._hasState) dummyColumns++;
		tr.style.gridColumn = '1 / ' + (this._columns + dummyColumns + 1);

		let selectionElement;
		if (this._hasState) {
			const td = L.DomUtil.create('div', '', tr);
			selectionElement = this.createSelectionElement(td, entry);
			if (this._isRealTree) td.setAttribute('aria-level', level);
		}

		this.fillCells(entry, tr, level, selectionElement);

		this.setupRowProperties(tr, entry, level, selectionElement);
		this.setupRowDragAndDrop(tr, this._data, entry, this._builder);
	}

	highlightAllTreeViews(highlight: boolean) {
		if (highlight) {
			document.querySelectorAll('.ui-treeview').forEach((item) => {
				L.DomUtil.addClass(item, 'droptarget');
			});
		} else {
			document.querySelectorAll('.ui-treeview').forEach((item) => {
				L.DomUtil.removeClass(item, 'droptarget');
			});
		}
	}

	setupDragAndDrop(treeViewData: TreeWidgetJSON, builder: any) {
		if (treeViewData.enabled !== false) {
			this._container.ondrop = (ev) => {
				ev.preventDefault();
				var row = ev.dataTransfer.getData('text');
				builder.callback('treeview', 'dragend', treeViewData, row, builder);
				this.highlightAllTreeViews(false);
			};
			this._container.ondragover = (event) => {
				event.preventDefault();
			};
		}
	}

	setupRowDragAndDrop(
		tr: HTMLElement,
		treeViewData: TreeWidgetJSON,
		entry: TreeEntryJSON,
		builder: any,
	) {
		if (treeViewData.enabled !== false && entry.state == null) {
			tr.draggable = treeViewData.draggable === false ? false : true;

			tr.ondragstart = (ev) => {
				ev.dataTransfer.setData('text', '' + entry.row);
				builder.callback(
					'treeview',
					'dragstart',
					treeViewData,
					entry.row,
					builder,
				);

				this.highlightAllTreeViews(true);
			};

			tr.ondragend = () => {
				this.highlightAllTreeViews(false);
			};
			tr.ondragover = (event) => {
				event.preventDefault();
			};
		}
	}

	setupRowProperties(
		tr: any,
		entry: TreeEntryJSON,
		level: number,
		selectionElement: HTMLInputElement,
	) {
		tr.setAttribute('role', 'row');
		tr._row = entry.row;

		if (entry.children) tr.setAttribute('aria-expanded', 'true');

		if (level !== undefined && this._isRealTree)
			tr.setAttribute('aria-level', '' + level);

		if (entry.selected === true) this.selectEntry(tr);

		const disabled = entry.enabled === false;
		if (disabled) L.DomUtil.addClass(tr, 'disabled');

		if (entry.ondemand || entry.collapsed) {
			L.DomUtil.addClass(tr, 'collapsed');
			tr.setAttribute('aria-expanded', 'false');
		}
	}

	createExpandableIconCell(
		parent: HTMLElement,
		entry: TreeEntryJSON,
		index: any,
		builder: any,
	) {
		const icon = L.DomUtil.create('img', 'ui-treeview-icon', parent);

		if (this._isNavigator) icon.draggable = false;

		const iconId = this.getCellIconId(entry.columns[index]);
		L.DomUtil.addClass(icon, iconId + 'img');
		const iconName = builder._createIconURL(iconId, true);
		L.LOUtil.setImage(icon, iconName, builder.map);
		icon.tabIndex = -1;
		icon.alt = ''; //In this case, it is advisable to use an empty alt tag for the icons, as the information of the function is available in text form
	}

	createTextCell(
		parent: HTMLElement,
		entry: TreeEntryJSON,
		index: any,
		builder: any,
	) {
		const cell = L.DomUtil.create(
			'span',
			builder.options.cssClass + ' ui-treeview-cell-text',
			parent,
		);
		cell.innerText = entry.columns[index].text || entry.text;
	}

	createLinkCell(
		parent: HTMLElement,
		entry: TreeEntryJSON,
		index: any,
		builder: any,
	) {
		const cell = L.DomUtil.create(
			'span',
			builder.options.cssClass + ' ui-treeview-cell-text',
			parent,
		);
		const link = L.DomUtil.create('a', '', cell);
		link.href = entry.columns[index].link || entry.columns[index].text;
		link.innerText = entry.columns[index].text || entry.text;
	}

	fillCells(
		entry: TreeEntryJSON,
		tr: HTMLElement,
		level: number,
		selectionElement: HTMLInputElement,
	) {
		let td, expander, span, text, img, icon, iconId, iconName, link, innerText;

		const rowElements = [];

		// row is a separator
		if (this.isSeparator(entry))
			L.DomUtil.addClass(tr, 'context-menu-separator');

		// column for expander
		if (this._isRealTree) {
			td = L.DomUtil.create('div', 'ui-treeview-expander-column', tr);
			rowElements.push(td);

			if (entry.children && entry.children.length) {
				expander = L.DomUtil.create(
					'div',
					this._builder.options.cssClass + ' ui-treeview-expander',
					td,
				);
				expander._ondemand = entry.ondemand;
				expander._row = entry.row;
			}
		}

		// regular columns
		for (const index in entry.columns) {
			td = L.DomUtil.create('div', '', tr);
			rowElements.push(td);

			span = L.DomUtil.create(
				'span',
				this._builder.options.cssClass + ' ui-treeview-cell',
				td,
			);
			text = L.DomUtil.create(
				'span',
				this._builder.options.cssClass + ' ui-treeview-cell-text',
				span,
			);

			if (entry.text == '<dummy>') continue;

			img = entry.columns[index].collapsedimage
				? entry.columns[index].collapsedimage
				: entry.columns[index].expandedimage;
			if (img) {
				L.DomUtil.addClass(td, 'ui-treeview-icon-column');
				this.createImageColumn(text, this._builder, img);
			} else if (
				entry.columns[index].collapsed ||
				entry.columns[index].expanded
			) {
				L.DomUtil.addClass(td, 'ui-treeview-icon-column');
				L.DomUtil.addClass(span, 'ui-treeview-expandable-with-icon');
				this.createExpandableIconCell(text, entry, index, this._builder);
			} else if (
				entry.columns[index].link &&
				!this.isSeparator(entry.columns[index])
			) {
				this.createLinkCell(text, entry, index, this._builder);
			} else if (
				entry.columns[index].text &&
				!this.isSeparator(entry.columns[index])
			) {
				this.createTextCell(text, entry, index, this._builder);
			}

			// row sub-elements
			for (const i in rowElements) {
				const element = rowElements[i];

				// setup properties
				element.setAttribute('role', 'gridcell');
			}
		}
	}

	toggleEntry(
		span: HTMLElement,
		treeViewData: TreeWidgetJSON,
		row: any,
		builder: any,
	) {
		if (L.DomUtil.hasClass(span, 'collapsed'))
			builder.callback('treeview', 'expand', treeViewData, row, builder);
		else builder.callback('treeview', 'collapse', treeViewData, row, builder);
		$(span).toggleClass('collapsed');
	}

	expandEntry(span: any, treeViewData: TreeWidgetJSON, row: any, builder: any) {
		if (span._ondemand && L.DomUtil.hasClass(span, 'collapsed'))
			builder.callback('treeview', 'expand', treeViewData, row, builder);
		$(span).toggleClass('collapsed');
	}

	selectEntry(span: HTMLElement) {
		this.makeTreeViewFocusable(false);

		L.DomUtil.addClass(span, 'selected');
		span.setAttribute('aria-selected', 'true');
		span.tabIndex = 0;
		span.focus();

		var checkbox = span.querySelector('input');
		if (checkbox) checkbox.removeAttribute('tabindex');
	}

	unselectEntry(item: HTMLElement) {
		L.DomUtil.removeClass(item, 'selected');
		item.removeAttribute('aria-selected');
		item.removeAttribute('tabindex');
		var itemCheckbox = item.querySelector('input');
		if (itemCheckbox) itemCheckbox.tabIndex = -1;
	}

	filterEntries(filter: string) {
		if (this._filterTimer) clearTimeout(this._filterTimer);

		var entriesToHide: Array<HTMLElement> = [];
		var allEntries = this._container.querySelectorAll('.ui-treeview-entry');

		filter = filter.trim();

		allEntries.forEach((entry: HTMLElement) => {
			if (filter === '') return;

			var cells = entry.querySelectorAll('div');
			for (var i in cells) {
				var entryText = cells[i].innerText;
				if (
					entryText &&
					entryText.toLowerCase().indexOf(filter.toLowerCase()) >= 0
				) {
					return;
				}
			}

			entriesToHide.push(entry);
		});

		this._filterTimer = setTimeout(() => {
			allEntries.forEach((entry) => {
				L.DomUtil.removeClass(entry, 'hidden');
			});
			entriesToHide.forEach((entry) => {
				L.DomUtil.addClass(entry, 'hidden');
			});
		}, 100);
	}

	changeFocusedRow(
		listElements: Array<HTMLElement>,
		fromIndex: number,
		toIndex: number,
	) {
		var nextElement = listElements.at(toIndex);
		nextElement.tabIndex = 0;
		nextElement.focus();

		var nextInput = Array.from(
			listElements
				.at(toIndex)
				.querySelectorAll('.ui-treeview-entry > div > input'),
		) as Array<HTMLElement>;
		if (nextInput && nextInput.length)
			nextInput.at(0).removeAttribute('tabindex');

		if (fromIndex >= 0) {
			var oldElement = listElements.at(fromIndex);
			if (L.DomUtil.hasClass(oldElement, 'selected')) return;

			oldElement.removeAttribute('tabindex');
			var oldInput = Array.from(
				listElements
					.at(fromIndex)
					.querySelectorAll('.ui-treeview-entry > div > input'),
			) as Array<HTMLElement>;
			if (oldInput && oldInput.length) oldInput.at(0).tabIndex = -1;
		}
	}

	getCurrentEntry(listElements: Array<HTMLElement>) {
		var focusedElement = document.activeElement as HTMLElement;
		// tr - row itself
		var currIndex = listElements.indexOf(focusedElement);
		// input - child of a row
		if (currIndex < 0)
			currIndex = listElements.indexOf(
				focusedElement.parentNode.parentNode as HTMLElement,
			);
		// no focused entry - try with selected one
		if (currIndex < 0) {
			var selected = listElements.filter((o) => {
				return o.classList.contains('selected');
			});
			if (selected && selected.length)
				currIndex = listElements.indexOf(selected[0]);
		}
		if (currIndex < 0) {
			for (var i in listElements) {
				var parent = listElements[i].parentNode;

				if (parent) parent = parent.parentNode;
				else break;

				if (parent && L.DomUtil.hasClass(parent, 'selected')) {
					currIndex = listElements.indexOf(listElements[i]);
					break;
				}
			}
		}

		return currIndex;
	}

	isRealTree(data: TreeWidgetJSON) {
		let isRealTreeView = false;
		for (var i in data.entries) {
			if (data.entries[i].children && data.entries[i].children.length) {
				isRealTreeView = true;
				break;
			}
		}
		return isRealTreeView;
	}

	getSortComparator(columnIndex: number, up: boolean) {
		return (a: HTMLElement, b: HTMLElement) => {
			if (!a || !b) return 0;

			var tda = a.querySelectorAll('div').item(columnIndex);
			var tdb = b.querySelectorAll('div').item(columnIndex);

			if (tda.querySelector('input')) {
				if (
					tda.querySelector('input').checked ===
					tdb.querySelector('input').checked
				)
					return 0;
				if (up) {
					if (
						tda.querySelector('input').checked >
						tdb.querySelector('input').checked
					)
						return 1;
					else return -1;
				} else if (
					tdb.querySelector('input').checked >
					tda.querySelector('input').checked
				)
					return 1;
				else return -1;
			}

			if (up)
				return tdb.innerText
					.toLowerCase()
					.localeCompare(tda.innerText.toLowerCase());
			else
				return tda.innerText
					.toLowerCase()
					.localeCompare(tdb.innerText.toLowerCase());
		};
	}

	sortByColumn(icon: HTMLSpanElement, columnIndex: number, up: boolean) {
		this.clearSorting();
		L.DomUtil.addClass(icon, up ? 'up' : 'down');

		var toSort: Array<HTMLDivElement> = [];

		const container = this._container;
		container
			.querySelectorAll(
				':not(.ui-treeview-expanded-content) .ui-treeview-entry',
			)
			.forEach((item: HTMLDivElement) => {
				toSort.push(item);
				container.removeChild(item);
			});

		toSort.sort(this.getSortComparator(columnIndex, up));

		toSort.forEach((item) => {
			container.insertBefore(item, container.lastChild.nextSibling);
		});
	}

	clearSorting() {
		var icons = this._thead.querySelectorAll('.ui-treeview-header-sort-icon');
		icons.forEach((icon) => {
			L.DomUtil.removeClass(icon, 'down');
			L.DomUtil.removeClass(icon, 'up');
		});
	}

	fillHeaders(headers: Array<TreeHeaderJSON>) {
		if (!headers) return;

		this._thead = L.DomUtil.create(
			'div',
			'ui-treeview-headers',
			this._container,
		);

		let dummyCells = this._columns - headers.length;
		if (this._hasState) dummyCells++;
		this._thead.style.gridColumn = '1 / ' + (this._columns + dummyCells + 1);

		for (let index = 0; index < dummyCells; index++) {
			this.fillHeader({ text: '', sortable: false });
			if (index === 0 && this._hasState)
				L.DomUtil.addClass(this._thead.lastChild, 'ui-treeview-state-column');
			else L.DomUtil.addClass(this._thead.lastChild, 'ui-treeview-icon-column');
		}

		for (const index in headers) {
			this.fillHeader(headers[index]);

			if (headers[index].sortable === false) continue;

			var clickFunction = (columnIndex: number, icon: HTMLSpanElement) => {
				return () => {
					if (L.DomUtil.hasClass(icon, 'down'))
						this.sortByColumn(icon, columnIndex + dummyCells, true);
					else this.sortByColumn(icon, columnIndex + dummyCells, false);
				};
			};

			const last = this._thead.lastChild as HTMLElement;
			last.onclick = clickFunction(
				parseInt(index),
				last.querySelector('.ui-treeview-header-sort-icon'),
			);
		}
	}

	makeEmptyList() {
		// contentbox and tree can never be empty, 1 page or 1 sheet always exists
		if (this._data.id === 'contenttree') {
			var tr = L.DomUtil.create(
				'div',
				this._builder.options.cssClass + ' ui-treview-entry',
				this._container,
			);
			tr.innerText = _(
				'Headings and objects that you add to the document will appear here',
			);
		} else {
			L.DomUtil.addClass(this._container, 'empty');
			if (this._data.hideIfEmpty) L.DomUtil.addClass(this._container, 'hidden');
		}
	}

	makeTreeViewFocusable(enable: boolean) {
		if (enable) this._container.tabIndex = 0;
		else this._container.removeAttribute('tabindex');
	}

	fillEntries(
		entries: Array<TreeEntryJSON>,
		level: number,
		parent: HTMLElement,
	) {
		let hasSelectedEntry = false;
		for (const index in entries) {
			this.fillRow(entries[index], level, parent);

			hasSelectedEntry = hasSelectedEntry || entries[index].selected;

			if (entries[index].children && entries[index].children.length) {
				L.DomUtil.addClass(parent.lastChild, 'ui-treeview-expandable');
				const subGrid = L.DomUtil.create(
					'div',
					'ui-treeview-expanded-content',
					parent,
				);

				let dummyColumns = 0;
				if (this._hasState) dummyColumns++;
				subGrid.style.gridColumn = '1 / ' + (this._columns + dummyColumns + 1);

				this.fillEntries(entries[index].children, level + 1, subGrid);
			}
		}

		if (entries && entries.length === 0) this.makeEmptyList();

		// we need to provide a way for making the treeview control focusable
		// when no entry is selected
		if (level === 1 && !hasSelectedEntry) this.makeTreeViewFocusable(true);
	}

	getColumnType(column: TreeColumnJSON) {
		const isString = column.link || column.text;
		const isIcon =
			column.collapsed ||
			column.collapsedimage ||
			column.expanded ||
			column.expandedimage;

		let columnType = 'unknown';
		if (this.isSeparator(column)) columnType = 'separator';
		else if (isString) columnType = 'string';
		else if (isIcon) columnType = 'icon';

		return columnType;
	}

	preprocessColumnData(entires: Array<TreeEntryJSON>) {
		if (!entires || !entires.length) return;

		// generate array of types for each entry
		const columnTypes = entires
			.map(
				(entry: TreeEntryJSON): Array<string> => {
					const currentTypes = new Array<string>();

					entry.columns.forEach((column: TreeColumnJSON) => {
						currentTypes.push(this.getColumnType(column));
					});

					return currentTypes;
				},
				// use the longest entry - naive approach
			)
			.reduce((prev: Array<string>, next: Array<string>): Array<string> => {
				if (!next || prev.length > next.length) return prev;
				return next;
			});

		// put missing dummy columns where are missing
		entires.forEach((entry: TreeEntryJSON) => {
			const existingColumns = entry.columns;
			const missingColumns = columnTypes.length - existingColumns.length;
			if (missingColumns <= 0) return;

			const newColumns = Array<TreeColumnJSON>();
			let targetIndex = 0;
			let existingIndex = 0;
			while (targetIndex < columnTypes.length) {
				const isExistingColumn = existingIndex < existingColumns.length;
				const currentType = isExistingColumn
					? this.getColumnType(existingColumns[existingIndex])
					: 'unknown';

				if (currentType === 'separator') break; // don't add new columns - full width

				if (!isExistingColumn || currentType !== columnTypes[targetIndex]) {
					newColumns.push({ text: '' });
				} else {
					newColumns.push(existingColumns[existingIndex]);
					existingIndex++;
				}

				targetIndex++;
			}
			entry.columns = newColumns;
		});
	}

	build(data: TreeWidgetJSON, builder: any, parentContainer: HTMLElement) {
		this.preprocessColumnData(data.entries);
		this.fillHeaders(data.headers);
		this.fillEntries(data.entries, 1, this._tbody);

		parentContainer.appendChild(this._container);

		return true;
	}

	// --------- Event Handlers
	//
	onClick(e: any) {
		let target = e.target;
		let row = TreeViewControl.getElement(target, 'row');
		if (row && !L.DomUtil.hasClass(row, 'disabled')) {
			if (L.DomUtil.hasClass(target, 'ui-treeview-expander')) {
				this.onExpanderClick(target);
				return;
			}

			if (target.localName === 'input') {
				this.onCheckBoxClick(target);
			}

			this.onRowClick(row);
		}
	}

	onRowClick(row: any) {
		this._container
			.querySelectorAll('.ui-treeview-entry.selected')
			.forEach((item: HTMLElement) => {
				this.unselectEntry(item);
			});

		this.selectEntry(row);

		this._builder.callback(
			'treeview',
			'select',
			this._data,
			row._row,
			this._builder,
		);

		if (this._singleClickActivate) {
			this._builder.callback(
				'treeview',
				'activate',
				this._data,
				row._row,
				this._builder,
			);
		}
	}

	onCheckBoxClick(checkbox: any) {
		if (checkbox.checked) {
			if (typeof checkbox._state !== 'undefined') {
				checkbox.checked = checkbox._state = true;
			}

			this._builder.callback(
				'treeview',
				'change',
				this._data,
				{ row: checkbox._row, value: true },
				this._builder,
			);
		} else {
			if (typeof checkbox._state !== 'undefined') {
				checkbox.checked = checkbox._state = false;
			}

			this._builder.callback(
				'treeview',
				'change',
				this._data,
				{ row: checkbox._row, value: false },
				this._builder,
			);
		}
	}

	onExpanderClick(expander: any) {
		if (expander._ondemand) {
			this.expandEntry(expander, this._data, expander._row, this._builder);
		} else {
			this.toggleEntry(expander, this._data, expander._row, this._builder);
		}
	}

	onDoubleClick(e: any) {
		let target = e.target;
		let row = TreeViewControl.getElement(target, 'row');
		if (row && !L.DomUtil.hasClass(row, 'disabled')) {
			this.onRowDoubleClick(row);
		}
	}

	onRowDoubleClick(row: any) {
		if (!this._singleClickActivate) {
			this._builder.callback(
				'treeview',
				'activate',
				this._data,
				row._row,
				this._builder,
			);
		}
	}

	onKeyDown(e: any) {
		let target = e.target;
		if (
			target.getAttribute('role') === 'row' &&
			!L.DomUtil.hasClass(target, 'disabled')
		) {
			this.onRowKeyDown(target, e);
			return;
		}

		const listElements = this._container.querySelectorAll('.ui-treeview-entry');
		this.onHandleKeyDown(e, listElements);
	}

	onHandleKeyDown(event: KeyboardEvent, nodeList: NodeList) {
		var preventDef = false;
		var listElements = Array.from(nodeList) as Array<HTMLElement>; // querySelector returns NodeList not array
		var treeLength = listElements.length;
		var currIndex = this.getCurrentEntry(listElements);

		if (event.key === 'ArrowDown') {
			if (currIndex < 0) this.changeFocusedRow(listElements, currIndex, 0);
			else {
				var nextIndex = currIndex + 1;
				while (
					nextIndex < treeLength - 1 &&
					listElements[nextIndex].clientHeight <= 0
				)
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
		} else if (
			this._data.fireKeyEvents &&
			this._builder.callback(
				'treeview',
				'keydown',
				{ id: this._data.id, key: event.key },
				currIndex,
				this._builder,
			)
		) {
			// used in mentions
			preventDef = true;
		}

		if (preventDef) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	onRowKeyDown(row: any, e: any) {
		let expander = row.querySelector('.ui-treeview-expander');
		if (e.key === ' ' && expander) {
			expander.click();
			row.focus();
			e.preventDefault();
			e.stopPropagation();
		} else if (e.key === 'Enter' || e.key === ' ') {
			this.onRowClick(row);
			let checkbox = row.querySelector('input');
			if (checkbox) {
				checkbox.click();
			}
			row.focus();
			e.preventDefault();
			e.stopPropagation();
		} else if (e.key === 'Tab') {
			if (!L.DomUtil.hasClass(row, 'selected')) {
				this.unselectEntry(row); // remove tabIndex
			}
		}
	}

	onContextMenu(e: any) {
		const target = e.target;
		const row = TreeViewControl.getElement(target, 'row');
		if (row) {
			this._builder.callback(
				'treeview',
				'contextmenu',
				this._data,
				row._row,
				this._builder,
			);
			e.preventDefault();
		}
	}
}

JSDialog.treeView = function (
	parentContainer: HTMLElement,
	data: TreeWidgetJSON,
	builder: any,
) {
	var treeView = new TreeViewControl(data, builder);
	treeView.build(data, builder, parentContainer);

	return false;
};

JSDialog.isDnDActive = function () {
	var dndElements = document.querySelectorAll('.droptarget');
	return dndElements && dndElements.length;
};
