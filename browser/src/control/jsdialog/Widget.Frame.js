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
 * JSDialog.Frame - frame widget, label + content we can fold
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'frame',
 *     children: [
 *         {id: 'label', type: 'fixedtext', text: 'This is label', visible: true}, // could be fixedtext inside container
 *         {id: 'firstChild', type: 'fixedtext', text: 'This is first element inside frame'},
 *         ...
 * 	   ]
 * }
 */

/* global JSDialog $ */

function _extractLabelText(data) {
	if (data.type === 'fixedtext' && data.text !== undefined) {
		return data.text;
	}

	for (var i = 0; i < data.children.length; i++) {
		var label = _extractLabelText(data.children[i]);
		if (label) return label;
	}

	return '';
}

JSDialog.frame = function _frameHandler(parentContainer, data, builder) {
	if (data.children.length > 1) {
		buildFrame(parentContainer, data, builder, shouldUseFieldsetLegend(data));
	} else {
		return builder._controlHandlers['container'](
			parentContainer,
			data,
			builder,
		);
	}

	return false;
};

function shouldUseFieldsetLegend(data) {
	if (!data.children || data.children.length < 2) return false;

	// Eligible as group if:
	// First child is a fixedtext (label)
	// OR first child is container whose children are all fixedtext
	if (data.children[0].type !== 'fixedtext') {
		const firstChild = data.children[0];
		return firstChild.children.every((item) => item.type === 'fixedtext');
	}

	return true;
}

function buildFrame(parentContainer, data, builder, shouldUseFieldsetLegend) {
	let container, frame, label;

	if (shouldUseFieldsetLegend) {
		container = window.L.DomUtil.create(
			'fieldset',
			'ui-frame-container ui-fieldset ' + builder.options.cssClass,
			parentContainer,
		);
		container.id = data.id;

		frame = container; // No inner frame for form control group

		const firstChild = data.children[0];

		const fixedTexts =
			firstChild.type === 'fixedtext'
				? [firstChild]
				: firstChild.children || [];

		for (const fixedText of fixedTexts) {
			label = window.L.DomUtil.create(
				'legend',
				'ui-frame-label ui-legend ' + builder.options.cssClass,
				frame,
			);

			label.innerText = builder._cleanText(_extractLabelText(fixedText));
			label.id = fixedText.id;

			if (fixedText.visible === false) {
				window.L.DomUtil.addClass(label, 'hidden');
			}

			builder.postProcess(frame, fixedText);
		}
	} else {
		container = window.L.DomUtil.create(
			'div',
			'ui-frame-container ' + builder.options.cssClass,
			parentContainer,
		);
		container.id = data.id;

		frame = window.L.DomUtil.create(
			'div',
			'ui-frame ' + builder.options.cssClass,
			container,
		);
		frame.id = data.id + '-frame';
	}

	const frameChildren = window.L.DomUtil.create(
		'div',
		'ui-expander-content ' + builder.options.cssClass,
		container,
	);
	frameChildren.id = data.id + '-content';
	$(frameChildren).addClass('expanded');

	const children = shouldUseFieldsetLegend
		? data.children.slice(1)
		: data.children;
	builder.build(frameChildren, children);
}
