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

function findLabelElementById(
	container: HTMLElement | Document,
	labelledById: string,
	suffix: string,
): HTMLElement | null {
	return (
		container.querySelector(`[id^="${labelledById}-label-${suffix}"]`) ||
		container.querySelector(`[id^="${labelledById}-label"]`) ||
		container.querySelector(`[id^="${labelledById}"]`)
	);
}

function setupA11yLabelForLabelableElement(
	parentContainer: HTMLElement,
	content: HTMLElement,
	data: WidgetJSON,
	builder: JSBuilder,
) {
	app.layoutingService.appendLayoutingTask(function () {
		app.layoutingService.appendLayoutingTask(function () {
			if (!data.labelledBy) {
				JSDialog.AddAriaLabel(content, data, builder);
				return;
			}

			const element =
				findLabelElementById(
					parentContainer,
					data.labelledBy,
					builder.options.suffix,
				) ||
				findLabelElementById(document, data.labelledBy, builder.options.suffix);

			if (!element) {
				JSDialog.AddAriaLabel(content, data, builder);
				return;
			}

			const labelHasHtmlFor =
				element.tagName === 'LABEL' && (element as HTMLLabelElement).htmlFor;

			const htmlForPointsToThisElement =
				labelHasHtmlFor && (element as HTMLLabelElement).htmlFor === content.id;

			if (!htmlForPointsToThisElement) {
				content.setAttribute('aria-labelledby', element.id);
			}
		});
	});
}

function setupA11yLabelForNonLabelableElement(
	container: HTMLElement,
	data: WidgetJSON,
	builder: JSBuilder,
) {
	if (data.labelledBy)
		container.setAttribute('aria-labelledby', data.labelledBy);
	else JSDialog.AddAriaLabel(container, data, builder);
}

function addAriaLabel(
	element: HTMLElement,
	data: WidgetJSON,
	builder: JSBuilder,
) {
	if (data.aria?.label && data.aria.label.trim()) {
		element.setAttribute('aria-label', data.aria.label);
	} else if (data.text) {
		element.setAttribute('aria-label', builder._cleanText(data.text));
	} else {
		// No valid label source - backend need to add label
		app.console.warn(
			'[A11y] Missing aria label: element has no accessible label. ',
			{
				elementId: element.id,
				elementTag: element.tagName,
				elementClass: element.className,
				dataId: data.id,
				dataType: data.type,
			},
		);
	}
}

JSDialog.SetupA11yLabelForLabelableElement = function (
	parentContainer: HTMLElement,
	content: HTMLElement,
	data: WidgetJSON,
	builder: JSBuilder,
) {
	return setupA11yLabelForLabelableElement(
		parentContainer,
		content,
		data,
		builder,
	);
};

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
