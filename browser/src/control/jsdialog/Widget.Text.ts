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
 * JSDialog.StaticText - static text rendering with span
 */

declare var JSDialog: any;

function staticTextControl(
	parentContainer: HTMLElement,
	data: TextWidget,
	builder: JSBuilder,
) {
	var statictext = L.DomUtil.create(
		'span',
		builder.options.cssClass,
		parentContainer,
	);

	if (data.text) statictext.textContent = builder._cleanText(data.text);
	else if (data.html) statictext.innerHTML = data.html;

	statictext.id = data.id;
	if (data.style && data.style.length) {
		L.DomUtil.addClass(statictext, data.style);
	} else {
		L.DomUtil.addClass(statictext, 'ui-text');
	}

	if (data.hidden) $(statictext).hide();

	return false;
}

JSDialog.StaticText = function (
	parentContainer: HTMLElement,
	data: TextWidget,
	builder: JSBuilder,
) {
	return staticTextControl(parentContainer, data, builder);
};
