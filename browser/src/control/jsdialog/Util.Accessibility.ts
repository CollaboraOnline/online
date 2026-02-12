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
	content: HTMLElement,
): HTMLElement | null {
	// First try to find a label element with matching id and for attribute
	const label = container.querySelector<HTMLElement>(
		`[id^="${labelledById}"][for="${content.id}"]`,
	);
	if (label) return label;

	let candidateBaseId = `${labelledById}-label-${suffix}`;
	let candidateElements = container.querySelectorAll<HTMLElement>(
		`[id^="${candidateBaseId}"]`,
	);

	if (candidateElements.length === 0) {
		candidateBaseId = `${labelledById}-label`;
		candidateElements = container.querySelectorAll<HTMLElement>(
			`[id^="${candidateBaseId}"]`,
		);
	}

	if (candidateElements.length === 0) {
		candidateBaseId = labelledById;
		candidateElements = container.querySelectorAll<HTMLElement>(
			`[id^="${candidateBaseId}"]`,
		);
	}

	const baseIdMatchRegex = new RegExp(`^${candidateBaseId}(\\d*)$`);
	for (let i = 0; i < candidateElements.length; i++) {
		const el = candidateElements[i];
		if (baseIdMatchRegex.test(el.id)) {
			return el;
		}
	}

	return null;
}

JSDialog.SetupA11yLabelForLabelableElement = function (
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
					content,
				) ||
				findLabelElementById(
					document,
					data.labelledBy,
					builder.options.suffix,
					content,
				);

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
};

JSDialog.SetupA11yLabelForNonLabelableElement = function (
	container: HTMLElement,
	data: WidgetJSON,
	builder: JSBuilder,
) {
	if (data.labelledBy)
		container.setAttribute('aria-labelledby', data.labelledBy);
	else JSDialog.AddAriaLabel(container, data, builder);
};

JSDialog.AddAriaLabel = function (
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
};

JSDialog.AddAltAttrOnFocusableImg = function (
	image: HTMLImageElement,
	data: WidgetJSON,
	builder: JSBuilder,
) {
	if (image.tabIndex !== 0) return;

	if (data.text?.trim()) {
		image.alt = builder._cleanText(data.text);
	} else if (data.aria?.label && data.aria.label.trim()) {
		image.alt = data.aria.label;
	} else if (data.aria?.description && data.aria.description.trim()) {
		image.alt = data.aria.description;
	} else {
		// Missing alt attribute on focusable img
		app.console.warn('[A11y] Missing alt attribue on focusable img.', {
			imageId: image.id,
			imageClass: image.className,
		});
	}
};

JSDialog.GetFormControlTypesInLO = function () {
	return new Set([
		'spinfield',
		'edit',
		'formattedfield',
		'metricfield',
		'combobox',
		'radiobutton',
		'checkbox',
		'time',
		'listbox',
	]);
};

JSDialog.GetFormControlTypesInCO = function () {
	return new Set([
		'INPUT',
		'SELECT',
		'TEXTAREA',
		'METER',
		'OUTPUT',
		'PROGRESS',
	]);
};
