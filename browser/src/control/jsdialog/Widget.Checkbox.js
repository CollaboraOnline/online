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

JSDialog.Checkbox = function (parentContainer, data, builder) {
	var div = window.L.DomUtil.createWithId('div', data.id, parentContainer);
	window.L.DomUtil.addClass(div, 'checkbutton');
	window.L.DomUtil.addClass(div, builder.options.cssClass);

	var checkbox = window.L.DomUtil.create(
		'input',
		builder.options.cssClass,
		div,
	);
	checkbox.type = 'checkbox';
	checkbox.id = data.id + '-input';
	checkbox.tabIndex = '0';

	var checkboxLabel = window.L.DomUtil.create(
		'label',
		builder.options.cssClass,
		div,
	);
	checkboxLabel.id = data.id + '-label';
	checkboxLabel.textContent = builder._cleanText(data.text);
	checkboxLabel.htmlFor = data.id + '-input';

	var toggleFunction = function () {
		if (div.hasAttribute('disabled')) return;

		builder.callback('checkbox', 'change', div, this.checked, builder);
	};

	const isDisabled = data.enabled === false;
	if (isDisabled) {
		div.setAttribute('disabled', 'true');
		div.disabled = true;
		checkbox.setAttribute('disabled', 'true');
		checkbox.disabled = true;
		checkbox.setAttribute('aria-disabled', true);
	}

	JSDialog.SynchronizeDisabledState(div, [checkbox, checkboxLabel]);

	checkbox.addEventListener('change', toggleFunction);

	var updateFunction = function () {
		if (div.hasAttribute('disabled')) return;

		var state = data.checked;

		if (
			(state && state === 'true') ||
			state === true ||
			state === 1 ||
			state === '1'
		)
			$(checkbox).prop('checked', true);
		else if (state) $(checkbox).prop('checked', false);
	};

	updateFunction();

	if (data.hidden) $(checkbox).hide();

	return false;
};
