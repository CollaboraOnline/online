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

/* global $ JSDialog */

function _createCheckboxContainer(parentContainer, data, builder) {
	const container = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-checkbox checkbutton',
		parentContainer,
	);
	container.id = data.id;
	return container;
}

function _createCheckboxControl(parentContainer, data, builder) {
	const checkbox = window.L.DomUtil.create(
		'input',
		builder.options.cssClass,
		parentContainer,
	);
	checkbox.type = 'checkbox';
	checkbox.id = data.id + '-input';
	checkbox.tabIndex = '0';
	return checkbox;
}

function _createCheckboxLabel(parentContainer, data, builder) {
	const label = window.L.DomUtil.create(
		'label',
		builder.options.cssClass,
		parentContainer,
	);
	label.id = data.id + '-label';
	label.textContent = builder._cleanText(data.text);
	label.htmlFor = data.id + '-input';
	return label;
}

JSDialog.Checkbox = function (parentContainer, data, builder) {
	const container = _createCheckboxContainer(parentContainer, data, builder);
	const checkbox = _createCheckboxControl(container, data, builder);
	const label = _createCheckboxLabel(container, data, builder);

	checkbox.addEventListener('change', () => {
		if (container.hasAttribute('disabled')) return;
		builder.callback('checkbox', 'change', container, checkbox.checked, builder);
	});

	if (data.enabled === false) {
		container.setAttribute('disabled', 'true');
		container.disabled = true;
		checkbox.setAttribute('disabled', 'true');
		checkbox.disabled = true;
		checkbox.setAttribute('aria-disabled', true);
	}

	JSDialog.SynchronizeDisabledState(container, [checkbox, label]);

	if (!container.hasAttribute('disabled')) {
		const state = data.checked;
		if (
			(state && state === 'true') ||
			state === true ||
			state === 1 ||
			state === '1'
		) {
			$(checkbox).prop('checked', true);
		} else if (state) {
			$(checkbox).prop('checked', false);
		}
	}

	if (data.hidden) $(checkbox).hide();
	return false;
};
