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
 * JSDialog.Containers - various container widgets
 */

declare var JSDialog: any;

function _getGridChild(
	children: Array<WidgetJSON>,
	row: number,
	col: number,
): WidgetJSON {
	for (var index in children) {
		if (
			parseInt(children[index].top) == row &&
			parseInt(children[index].left) == col
		)
			return children[index];
	}
	return null;
}

JSDialog.container = function (
	parentContainer: Element,
	data: ContainerWidgetJSON | GridWidgetJSON,
	builder: any,
) {
	if ((data as GridWidgetJSON).cols && (data as GridWidgetJSON).rows)
		return JSDialog.grid(parentContainer, data, builder);

	if (parentContainer && !parentContainer.id) parentContainer.id = data.id;

	return true;
};

JSDialog.grid = function (
	parentContainer: Element,
	data: GridWidgetJSON,
	builder: any,
) {
	const rows = builder._getGridRows(data.children);
	const cols = builder._getGridColumns(data.children);

	const processedChildren = [];

	const table = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-grid',
		parentContainer,
	);
	table.id = data.id;

	const gridRowColStyle =
		'grid-template-rows: repeat(' +
		rows +
		', auto); \
		grid-template-columns: repeat(' +
		cols +
		', auto);';

	table.style = gridRowColStyle;

	for (let row = 0; row < rows; row++) {
		let prevChild = null;

		for (let col = 0; col < cols; col++) {
			const child = _getGridChild(data.children, row, col);
			const isMergedCell =
				prevChild &&
				prevChild.width &&
				parseInt(prevChild.left) + parseInt(prevChild.width) > col;

			if (child) {
				if (!child.id || child.id === '')
					// required for postprocess...
					child.id = table.id + '-cell-' + row + '-' + col;

				const sandbox = L.DomUtil.create('div');
				builder.build(sandbox, [child], false);

				const control = sandbox.firstChild;
				if (control) {
					L.DomUtil.addClass(control, 'ui-grid-cell');
					table.appendChild(control);
				}

				processedChildren.push(child);
				prevChild = child;
			} else if (!isMergedCell) {
				// empty placeholder to keep correct order
				L.DomUtil.create('div', 'ui-grid-cell', table);
			}
		}
	}

	for (let i = 0; i < (data.children || []).length; i++) {
		const child = data.children[i];
		if (processedChildren.indexOf(child) === -1) {
			const sandbox = L.DomUtil.create('div');
			builder.build(sandbox, [child], false);
			const control = sandbox.firstChild;
			if (control) {
				L.DomUtil.addClass(control, 'ui-grid-cell');
				table.appendChild(control);
			}
			processedChildren.push(child);
		}
	}

	return false;
};

JSDialog.toolbox = function (
	parentContainer: Element,
	data: WidgetJSON,
	builder: any,
) {
	const levelClass =
		builder._currentDepth !== undefined
			? ' level-' + builder._currentDepth
			: '';
	const toolbox = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' toolbox' + levelClass,
		parentContainer,
	);
	toolbox.id = data.id;

	if (data.enabled === false) {
		toolbox.disabled = true;
		for (const index in data.children) {
			data.children[index].enabled = false;
		}
	}

	const enabledCallback = function (enable: boolean) {
		for (const j in data.children) {
			const childId = data.children[j].id;
			const toolboxChild = toolbox.querySelector('#' + childId);
			if (!toolboxChild) continue;
			if (enable) {
				toolboxChild.removeAttribute('disabled');
				toolboxChild.classList.remove('disabled');
			} else {
				toolboxChild.disabled = true;
				toolboxChild.classList.add('disabled');
			}
		}
	};
	JSDialog.OnStateChange(toolbox, enabledCallback);

	const noLabels = builder.options.noLabelsForUnoButtons;
	builder.options.noLabelsForUnoButtons = true;

	builder.build(toolbox, data.children, false, false);

	builder.options.noLabelsForUnoButtons = noLabels;

	return false;
};

JSDialog.spacer = function (
	parentContainer: Element,
	data: WidgetJSON,
	builder: any,
) {
	const spacer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-spacer',
		parentContainer,
	);
	spacer.id = data.id;

	return false;
};
