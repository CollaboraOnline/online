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
	if (data.type === 'fixedtext') {
		return data.visible != false ? data.text : ''; // visible can be undefined too, in that case it means its visible
	}

	for (var i = 0; i < data.children.length; i++) {
		var label = _extractLabelText(data.children[i]);
		if (label)
			return label;
	}

	return '';
}

JSDialog.frame = function _frameHandler(parentContainer, data, builder) {
	if (data.children.length > 1) {
		buildFrame(parentContainer, data, builder, isFormControlGroup(data));
	} else {
		return builder._controlHandlers['container'](parentContainer, data, builder);
	}

	return false;
};

function isFormControlGroup(data) {
    if (!data.children || data.children.length < 2)
        return false;

    // First child must be a fixedtext (label) to eligible as a form control group
    if (data.children[0].type !== 'fixedtext')
        return false;

	const formControlTypes = new Set([
		'spinfield', 'edit', 'formattedfield', 'metricfield', 'combobox',
		'radiobutton', 'checkbox', 'time'
	]);
    let formControlCount = 0;
    const minRequiredControls = 2;

    /**
	 * Recursively counts form controls within a dialog structure tree.
	 * This function handles the hierarchical nature of JSDialog JSON structures where
	 * form controls can be nested within various container types.
	 * Uses early termination to optimize performance once the minimum threshold is reached.
	 */
    function countFormControls(node) {
        if (!node.children) return 0;

        let count = 0;
        for (const child of node.children) {
            if (formControlTypes.has(child.type)) {
                count++;
            } else {
				count += countFormControls(child);
			}
			if (count >= minRequiredControls) return count;
        }
        return count;
    }

    // Skip the first child (label) and count form controls in remaining children
    for (let i = 1; i < data.children.length; i++) {
        formControlCount += countFormControls(data.children[i]);

		if (formControlCount >= minRequiredControls) return true;
    }

    return false;
}

function buildFrame(parentContainer, data, builder, isFormControlGroup) {
    let container, frame, label;

    if (isFormControlGroup) {
        container = L.DomUtil.create('fieldset', 'ui-frame-container ui-fieldset ' + builder.options.cssClass, parentContainer);
        container.id = data.id;

        frame = container; // No inner frame for form control group

        label = L.DomUtil.create('legend', 'ui-frame-label ui-legend ' + builder.options.cssClass, frame);
    } else {
        container = L.DomUtil.create('div', 'ui-frame-container ' + builder.options.cssClass, parentContainer);
        container.id = data.id;

        frame = L.DomUtil.create('div', 'ui-frame ' + builder.options.cssClass, container);
        frame.id = data.id + '-frame';

        label = L.DomUtil.create('label', 'ui-frame-label ' + builder.options.cssClass, frame);
		label.htmlFor = data.id + '-content';
    }
	label.innerText = builder._cleanText(_extractLabelText(data.children[0]));
	label.id = data.children[0].id;
	if (data.children[0].visible === false)
		L.DomUtil.addClass(label, 'hidden');
	builder.postProcess(frame, data.children[0]);

    const frameChildren = L.DomUtil.create('div', 'ui-expander-content ' + builder.options.cssClass, container);
    frameChildren.id = data.id + '-content';
    $(frameChildren).addClass('expanded');

	// skipping the first child(label/legend)
    const children = data.children.slice(1);
    builder.build(frameChildren, children);
}
