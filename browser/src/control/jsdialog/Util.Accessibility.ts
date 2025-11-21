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
 * JSDialog.Accessibility - accessibility utilities for JSDialog widgets
 */

declare var JSDialog: any;

function setupA11yLabelForNonLabelableElement(
	container: HTMLElement,
	data: WidgetJSON,
	builder: JSBuilder,
) {
	if (data.labelledBy)
		container.setAttribute('aria-labelledby', data.labelledBy);
	else JSDialog.AddAriaLabel(container, data, builder);
}

function addAriaLabel(element: HTMLElement, data: WidgetJSON, builder: JSBuilder) {
	if (data.aria?.label && data.aria.label.trim())
		element.setAttribute('aria-label', data.aria.label);
	else if (data.text)
		element.setAttribute('aria-label', builder._cleanText(data.text));
}

JSDialog.SetupA11yLabelForNonLabelableElement = function (
	container: HTMLElement,
	data: WidgetJSON,
	builder: JSBuilder,
) {
	return setupA11yLabelForNonLabelableElement(container, data, builder);
};

JSDialog.AddAriaLabel = function (
	element: HTMLElement,
	data: WidgetJSON,
	builder: JSBuilder,
) {
	return addAriaLabel(element, data, builder);
};
