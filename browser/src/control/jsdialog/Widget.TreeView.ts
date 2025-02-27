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
declare var app: any;

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

		this._tbody = this._container;
		(this._container as any).filterEntries = this.filterEntries.bind(this);

		this.setupDragAndDrop(data, builder);
		this.setupKeyEvents(data, builder);

		if (this._isRealTree) {
			this._container.setAttribute('role', 'treegrid');
			if (!data.headers || data.headers.length === 0)
				L.DomUtil.addClass(this._container, 'ui-treeview-tree');
		} else this._container.setAttribute('role', 'grid');
	}

	get Container() {
		return this._container;
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

	findEntryWithRow(
		entries: Array<TreeEntryJSON>,
		row: number | string,
	): TreeEntryJSON {
		for (const i in entries) {
			if (entries[i].row == row) return entries[i];
			else if (entries[i].children) {
				var found = this.findEntryWithRow(entries[i].children, row);
				if (found) return found;
			}
		}

		return null;
	}

	changeCheckboxStateOnClick(
		checkbox: HTMLInputElement,
		treeViewData: TreeWidgetJSON,
		builder: any,
		entry: TreeEntryJSON,
	) {
		let foundEntry: TreeEntryJSON;
		if (checkbox.checked) {
			foundEntry = this.findEntryWithRow(treeViewData.entries, entry.row);
			if (foundEntry) checkbox.checked = foundEntry.state = true;
			builder.callback(
				'treeview',
				'change',
				treeViewData,
				{ row: entry.row, value: true },
				builder,
			);
		} else {
			foundEntry = this.findEntryWithRow(treeViewData.entries, entry.row);
			if (foundEntry) checkbox.checked = foundEntry.state = false;
			builder.callback(
				'treeview',
				'change',
				treeViewData,
				{ row: entry.row, value: false },
				builder,
			);
		}
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
		else checkbox.checked = false;

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
		else radioButton.checked = false;

		return radioButton;
	}

	createSelectionElement(
		parent: HTMLElement,
		treeViewData: TreeWidgetJSON,
		entry: TreeEntryJSON,
		builder: any,
	) {
		let selectionElement: HTMLInputElement;
		const checkboxtype = treeViewData.checkboxtype;
		if (checkboxtype == 'radio') {
			selectionElement = this.createRadioButton(
				parent,
				treeViewData,
				builder,
				entry,
			);
		} else {
			selectionElement = this.createCheckbox(
				parent,
				treeViewData,
				builder,
				entry,
			);
		}

		if (entry.enabled === false) selectionElement.disabled = true;

		if (treeViewData.enabled !== false) {
			selectionElement.addEventListener('change', () => {
				this.changeCheckboxStateOnClick(
					selectionElement,
					treeViewData,
					builder,
					entry,
				);
			});
		}

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

	fillHeader(header: TreeHeaderJSON, builder: any) {
		if (!header) return;

		const th = L.DomUtil.create(
			'div',
			builder.options.cssClass + ' ui-treeview-header',
			this._thead,
		);
		const span = L.DomUtil.create(
			'span',
			builder.options.cssClass + ' ui-treeview-header-text',
			th,
		);

		span.innerText = header.text;

		if (header.sortable !== false) {
			L.DomUtil.create(
				'span',
				builder.options.cssClass + ' ui-treeview-header-sort-icon',
				span,
			);
		}
	}

	fillRow(
		data: TreeWidgetJSON,
		entry: TreeEntryJSON,
		builder: any,
		level: number,
		parent: HTMLElement,
	) {
		const tr = L.DomUtil.create(
			'div',
			builder.options.cssClass + ' ui-treeview-entry',
			parent,
		);
		let dummyColumns = 0;
		if (this._hasState) dummyColumns++;
		tr.style.gridColumn = '1 / ' + (this._columns + dummyColumns + 1);

		let selectionElement;
		if (this._hasState) {
			const td = L.DomUtil.create('div', '', tr);
			selectionElement = this.createSelectionElement(td, data, entry, builder);
			if (this._isRealTree) td.setAttribute('aria-level', level);
		}

		// Character limits for text at each tree level.
		const textLengthAndLevel: { [key: number]: number } = {
			1: 30,
			2: 33,
			3: 25,
			4: 19,
			5: 10,
		};

		// Get text limit for the level (or default to 20)
		const textLimit = textLengthAndLevel[level] || 20;

		if (data.id === 'treeview' && entry.text && entry.text.length > textLimit) {
			tr.setAttribute('data-cooltip', entry.text);
			L.control.attachTooltipEventListener(tr, builder.map);
		}

		this.fillCells(entry, builder, data, tr, level, selectionElement);

		this.setupRowProperties(tr, entry, level, selectionElement);
		this.setupRowDragAndDrop(tr, data, entry, builder);
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
		tr: HTMLElement,
		entry: TreeEntryJSON,
		level: number,
		selectionElement: HTMLInputElement,
	) {
		if (entry.children) tr.setAttribute('aria-expanded', 'true');

		if (level !== undefined && this._isRealTree)
			tr.setAttribute('aria-level', '' + level);

		if (entry.selected === true) this.selectEntry(tr, selectionElement);

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
		const iconName = app.LOUtil.getIconNameOfCommand(iconId, true);
		app.LOUtil.setImage(icon, iconName, builder.map);
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
		builder: any,
		treeViewData: TreeWidgetJSON,
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

			if (entry.children && entry.children.length)
				expander = L.DomUtil.create(
					'div',
					builder.options.cssClass + ' ui-treeview-expander',
					td,
				);
		}

		// regular columns
		for (const index in entry.columns) {
			td = L.DomUtil.create('div', '', tr);
			rowElements.push(td);

			span = L.DomUtil.create(
				'span',
				builder.options.cssClass + ' ui-treeview-cell',
				td,
			);
			text = L.DomUtil.create(
				'span',
				builder.options.cssClass + ' ui-treeview-cell-text',
				span,
			);

			if (entry.text == '<dummy>') continue;

			img = entry.columns[index].collapsedimage
				? entry.columns[index].collapsedimage
				: entry.columns[index].expandedimage;
			if (img) {
				L.DomUtil.addClass(td, 'ui-treeview-icon-column');
				this.createImageColumn(text, builder, img);
			} else if (
				entry.columns[index].collapsed ||
				entry.columns[index].expanded
			) {
				L.DomUtil.addClass(td, 'ui-treeview-icon-column');
				L.DomUtil.addClass(span, 'ui-treeview-expandable-with-icon');
				this.createExpandableIconCell(text, entry, index, builder);
			} else if (
				entry.columns[index].link &&
				!this.isSeparator(entry.columns[index])
			) {
				this.createLinkCell(text, entry, index, builder);
			} else if (
				entry.columns[index].text &&
				!this.isSeparator(entry.columns[index])
			) {
				this.createTextCell(text, entry, index, builder);
			}

			// row sub-elements
			for (const i in rowElements) {
				const element = rowElements[i];

				// setup properties
				element.setAttribute('role', 'gridcell');
			}
		}

		// setup callbacks
		var clickFunction = this.createClickFunction(
			tr,
			selectionElement,
			true,
			this._singleClickActivate,
			builder,
			treeViewData,
			entry,
		);
		var doubleClickFunction = this.createClickFunction(
			tr,
			selectionElement,
			false,
			true,
			builder,
			treeViewData,
			entry,
		);

		this.setupEntryMouseEvents(
			tr,
			entry,
			treeViewData,
			builder,
			selectionElement,
			expander,
			clickFunction,
			doubleClickFunction,
		);

		this.setupEntryKeyEvent(
			tr,
			entry,
			selectionElement,
			expander,
			clickFunction,
		);

		this.setupEntryContextMenuEvent(tr, entry, treeViewData, builder);
	}

	setupEntryContextMenuEvent(
		tr: HTMLElement,
		entry: TreeEntryJSON,
		treeViewData: TreeWidgetJSON,
		builder: any,
	) {
		tr.addEventListener('contextmenu', (e: Event) => {
			builder.callback(
				'treeview',
				'contextmenu',
				treeViewData,
				entry.row,
				builder,
			);
			e.preventDefault();
		});
	}

	setupEntryMouseEvents(
		tr: HTMLElement,
		entry: TreeEntryJSON,
		treeViewData: TreeWidgetJSON,
		builder: any,
		selectionElement: HTMLInputElement,
		expander: HTMLElement,
		clickFunction: any,
		doubleClickFunction: any,
	) {
		tr.addEventListener('click', clickFunction as any);

		if (!this._singleClickActivate) {
			if (window.ThisIsTheiOSApp) {
				// TODO: remove this hack
				tr.addEventListener('click', () => {
					if (L.DomUtil.hasClass(tr, 'disabled')) return;

					if (
						entry.row == lastClickHelperRow &&
						treeViewData.id == lastClickHelperId
					)
						doubleClickFunction(undefined);
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
				$(tr).dblclick(doubleClickFunction as any);
			}
		}

		const toggleFunction = (e: MouseEvent) => {
			this.toggleEntry(tr, treeViewData, entry, builder);
			e.preventDefault();
		};
		const expandFunction = (e: MouseEvent) => {
			this.expandEntry(tr, treeViewData, entry, builder);
			e.preventDefault();
		};

		if (expander && entry.children && entry.children.length) {
			if (entry.ondemand) {
				L.DomEvent.on(expander, 'click', expandFunction);
			} else {
				$(expander).click((e) => {
					if (entry.state && e.target === selectionElement) e.preventDefault(); // do not toggle on checkbox
					toggleFunction(e.originalEvent);
				});
			}
		}
	}

	setupEntryKeyEvent(
		tr: HTMLElement,
		entry: TreeEntryJSON,
		selectionElement: HTMLInputElement,
		expander: HTMLElement,
		clickFunction: any,
	) {
		if (entry.enabled === false) return;

		tr.addEventListener('keydown', (event) => {
			if (event.key === ' ' && expander) {
				expander.click();
				tr.focus();
				event.preventDefault();
				event.stopPropagation();
			} else if (event.key === 'Enter' || event.key === ' ') {
				clickFunction();
				if (selectionElement) selectionElement.click();
				tr.focus();
				event.preventDefault();
				event.stopPropagation();
			} else if (event.key === 'Tab') {
				if (!L.DomUtil.hasClass(tr, 'selected')) this.unselectEntry(tr); // remove tabIndex
			}
		});
	}

	toggleEntry(
		span: HTMLElement,
		treeViewData: TreeWidgetJSON,
		entry: TreeEntryJSON,
		builder: any,
	) {
		if (entry.enabled === false) return;

		if (L.DomUtil.hasClass(span, 'collapsed'))
			builder.callback('treeview', 'expand', treeViewData, entry.row, builder);
		else
			builder.callback(
				'treeview',
				'collapse',
				treeViewData,
				entry.row,
				builder,
			);
		$(span).toggleClass('collapsed');
	}

	expandEntry(
		span: HTMLElement,
		treeViewData: TreeWidgetJSON,
		entry: TreeEntryJSON,
		builder: any,
	) {
		if (entry.enabled === false) return;

		if (entry.ondemand && L.DomUtil.hasClass(span, 'collapsed'))
			builder.callback('treeview', 'expand', treeViewData, entry.row, builder);
		$(span).toggleClass('collapsed');
	}

	selectEntry(span: HTMLElement, checkbox: HTMLInputElement) {
		this.makeTreeViewFocusable(false);

		L.DomUtil.addClass(span, 'selected');
		span.setAttribute('aria-selected', 'true');
		span.tabIndex = 0;
		span.focus();
		if (checkbox) checkbox.removeAttribute('tabindex');
	}

	unselectEntry(item: HTMLElement) {
		L.DomUtil.removeClass(item, 'selected');
		item.removeAttribute('aria-selected');
		item.removeAttribute('tabindex');
		var itemCheckbox = item.querySelector('input');
		if (itemCheckbox) itemCheckbox.tabIndex = -1;
	}

	createClickFunction(
		parentContainer: HTMLElement,
		checkbox: HTMLInputElement,
		select: boolean,
		activate: boolean,
		builder: any,
		treeViewData: TreeWidgetJSON,
		entry: TreeEntryJSON,
	) {
		return (e: MouseEvent | KeyboardEvent) => {
			if (e && e.target === checkbox) return; // allow default handler to trigger change event

			if (e && L.DomUtil.hasClass(parentContainer, 'disabled')) {
				e.preventDefault();
				return;
			}

			this._container
				.querySelectorAll('.ui-treeview-entry.selected')
				.forEach((item: HTMLElement) => {
					this.unselectEntry(item);
				});

			this.selectEntry(parentContainer, checkbox);
			if (checkbox && (!e || e.target === checkbox))
				this.changeCheckboxStateOnClick(checkbox, treeViewData, builder, entry);

			if (select)
				builder.callback(
					'treeview',
					'select',
					treeViewData,
					entry.row,
					builder,
				);

			if (activate)
				builder.callback(
					'treeview',
					'activate',
					treeViewData,
					entry.row,
					builder,
				);
		};
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

	setupKeyEvents(data: TreeWidgetJSON, builder: any) {
		this._container.addEventListener('keydown', (event) => {
			const listElements =
				this._container.querySelectorAll('.ui-treeview-entry');
			this.handleKeyEvent(event, listElements, builder, data);
		});
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

	handleKeyEvent(
		event: KeyboardEvent,
		nodeList: NodeList,
		builder: any,
		data: TreeWidgetJSON,
	) {
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
			data.fireKeyEvents &&
			builder.callback(
				'treeview',
				'keydown',
				{ id: data.id, key: event.key },
				currIndex,
				builder,
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

	fillHeaders(headers: Array<TreeHeaderJSON>, builder: any) {
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
			this.fillHeader({ text: '', sortable: false }, builder);
			if (index === 0 && this._hasState)
				L.DomUtil.addClass(this._thead.lastChild, 'ui-treeview-state-column');
			else L.DomUtil.addClass(this._thead.lastChild, 'ui-treeview-icon-column');
		}

		for (const index in headers) {
			this.fillHeader(headers[index], builder);

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

	makeEmptyList(data: TreeWidgetJSON, builder: any) {
		// contentbox and tree can never be empty, 1 page or 1 sheet always exists
		if (data.id === 'contenttree') {
			var tr = L.DomUtil.create(
				'div',
				builder.options.cssClass + ' ui-treview-entry',
				this._container,
			);
			tr.innerText = _(
				'Headings and objects that you add to the document will appear here',
			);
		} else {
			L.DomUtil.addClass(this._container, 'empty');
			if (data.hideIfEmpty) L.DomUtil.addClass(this._container, 'hidden');
		}
	}

	makeTreeViewFocusable(enable: boolean) {
		if (enable) this._container.tabIndex = 0;
		else this._container.removeAttribute('tabindex');
	}

	fillEntries(
		data: TreeWidgetJSON,
		entries: Array<TreeEntryJSON>,
		builder: any,
		level: number,
		parent: HTMLElement,
	) {
		let hasSelectedEntry = false;
		for (const index in entries) {
			this.fillRow(data, entries[index], builder, level, parent);

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

				this.fillEntries(
					data,
					entries[index].children,
					builder,
					level + 1,
					subGrid,
				);
			}
		}

		if (entries && entries.length === 0) this.makeEmptyList(data, builder);

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
		this.fillHeaders(data.headers, builder);
		this.fillEntries(data, data.entries, builder, 1, this._tbody);

		parentContainer.appendChild(this._container);

		return true;
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
