/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.Combobox - combobox widget with support for custom renders of entries
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'combobox',
 * }
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global JSDialog */

function _comboboxControl(parentContainer, data, builder) {
	var container = L.DomUtil.create('div', 'ui-combobox ' + builder.options.cssClass, parentContainer);
	container.id = data.id;

	var content = L.DomUtil.create('div', 'ui-combobox-content ' + builder.options.cssClass, container);
	content.innerText = data.text;

	var button = L.DomUtil.create('div', 'ui-combobox-button ' + builder.options.cssClass, container);
	var arrow = L.DomUtil.create('span', builder.options.cssClass + ' ui-listbox-arrow', button);
	arrow.id = 'listbox-arrow-' + data.id;

	return false;
}

JSDialog.combobox = function (parentContainer, data, builder) {
	var buildInnerData = _comboboxControl(parentContainer, data, builder);
	return buildInnerData;
};
