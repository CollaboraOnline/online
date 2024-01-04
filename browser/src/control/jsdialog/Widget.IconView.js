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
 * JSDialog.IconView - icon view widget
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'iconview',
 *     singleclickactivate: true,
 *     entries: [
 *         { text: 'some text', tooltip: 'some tooltip', image: 'encoded png', selected: false }
 *     ]
 * }
 */

/* global JSDialog $ */

function _iconViewEntry (parentContainer, parentData, entry, builder) {
	var disabled = parentData.enabled === 'false' || parentData.enabled === false;

	if (entry.separator && (entry.separator === 'true' || entry.separator === true)) {
		L.DomUtil.create('hr', builder.options.cssClass + ' ui-iconview-separator', parentContainer);
		return;
	}

	var entryContainer = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview-entry', parentContainer);
	if (entry.selected && (entry.selected === 'true' || entry.selected === true))
		$(entryContainer).addClass('selected');

	var icon = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview-icon', entryContainer);
	var img = L.DomUtil.create('img', builder.options.cssClass, icon);
	if (entry.image)
		img.src = entry.image;
	img.alt = entry.text;
	if (entry.tooltip)
		img.title = entry.tooltip;
	else
		img.title = entry.text;

	if (!disabled) {
		var singleClick = parentData.singleclickactivate === 'true' || parentData.singleclickactivate === true;
		$(entryContainer).click(function() {
			$('#' + parentData.id + ' .ui-treeview-entry').removeClass('selected');
			builder.callback('iconview', 'select', parentData, entry.row, builder);
			if (singleClick) {
				builder.callback('iconview', 'activate', parentData, entry.row, builder);
			}
		});
		if (!singleClick) {
			$(entryContainer).dblclick(function() {
				$('#' + parentData.id + ' .ui-treeview-entry').removeClass('selected');
				builder.callback('iconview', 'activate', parentData, entry.row, builder);
			});
		}
		builder._preventDocumentLosingFocusOnClick(entryContainer);
	}
}

JSDialog.iconView = function (parentContainer, data, builder) {
	var container = L.DomUtil.create('div', builder.options.cssClass + ' ui-iconview', parentContainer);
	container.id = data.id;

	var disabled = data.enabled === 'false' || data.enabled === false;
	if (disabled)
		L.DomUtil.addClass(container, 'disabled');

	for (var i in data.entries) {
		_iconViewEntry(container, data, data.entries[i], builder);
	}

	var firstSelected = $(container).children('.selected').get(0);
	var blockOption = JSDialog._scrollIntoViewBlockOption('nearest');
	if (firstSelected)
		firstSelected.scrollIntoView({behavior: 'smooth', block: blockOption, inline: 'nearest'});

	container.onSelect = function (position) {
		$(container).children('.selected').removeClass('selected');

		var entry = container.children.length > position ? container.children[position] : null;

		if (entry) {
			L.DomUtil.addClass(entry, 'selected');
			var blockOption = JSDialog._scrollIntoViewBlockOption('nearest');
			entry.scrollIntoView({behavior: 'smooth', block: blockOption, inline: 'nearest'});
		} else if (position != -1)
			console.warn('not found entry: "' + position + '" in: "' + container.id + '"');
	};

	return false;
};
