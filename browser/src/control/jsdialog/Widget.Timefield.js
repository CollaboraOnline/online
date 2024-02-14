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
 * JSDialog.Timefield - input field for time data
 *
 * Example JSON:
 * {
 *     id: 'time',
 *     type: 'time',
 *     text: '01:01:01'
 * }
 */

/* global JSDialog */

JSDialog.timeField = function (parentContainer, data, builder) {
	var inputTimeField = L.DomUtil.create(
		'input',
		builder.options.cssClass + ' ui-timefield',
		parentContainer
	);
	inputTimeField.setAttribute('type', 'time');
	inputTimeField.setAttribute('step', 1); // forces the display of seconds
	inputTimeField.setAttribute('id', data.id);
	inputTimeField.value = data.text;

	inputTimeField.addEventListener('change', function (event) {
		var timefield = event.target;

		var attrdisabled = timefield.getAttribute('disabled');
		if (attrdisabled !== 'disabled') {
			builder.callback(
				'spinfield',
				'change',
				timefield,
				timefield.value,
				builder
			);
		}
	});

	var disabled = data.enabled === 'false' || data.enabled === false;
	if (disabled) {
		inputTimeField.disabled = true;
	}

	return false;
};
