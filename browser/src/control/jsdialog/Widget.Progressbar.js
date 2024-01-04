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
 * JSDialog.Progressbar - progress bar widget
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'progressbar',
 *     value: 30,
 *     maxValue: 100
 * }
 */

/* global JSDialog $ */

JSDialog.progressbar = function (parentContainer, data, builder) {
	var div = L.DomUtil.createWithId('div', data.id, parentContainer);
	L.DomUtil.addClass(div, 'ui-progressbar');
	L.DomUtil.addClass(div, builder.options.cssClass);

	var progressbar = L.DomUtil.create('progress', builder.options.cssClass, div);
	progressbar.id = data.id + '-progress';
	progressbar.tabIndex = '0';

	if (data.value !== undefined)
		progressbar.value = data.value;
	else
		progressbar.value = 0;

	if (data.maxValue !== undefined)
		progressbar.max = data.maxValue;
	else
		progressbar.max = 100;

	if (data.enabled === 'false' || data.enabled === false) {
		$(progressbar).prop('disabled', true);
	}

	if (data.hidden)
		$(progressbar).hide();

	return false;
};
