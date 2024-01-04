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
		var container = L.DomUtil.create('div', 'ui-frame-container ' + builder.options.cssClass, parentContainer);
		container.id = data.id;

		var frame = L.DomUtil.create('div', 'ui-frame ' + builder.options.cssClass, container);
		frame.id = data.id + '-frame';
		var label = L.DomUtil.create('label', 'ui-frame-label ' + builder.options.cssClass, frame);
		label.innerText = builder._cleanText(_extractLabelText(data.children[0]));
		label.id = data.children[0].id;
		if (data.children[0].visible === false)
			L.DomUtil.addClass(label, 'hidden');
		builder.postProcess(frame, data.children[0]);

		var frameChildren = L.DomUtil.create('div', 'ui-expander-content ' + builder.options.cssClass, container);
		frameChildren.id = data.id + '-content';
		label.htmlFor = frameChildren.id;
		$(frameChildren).addClass('expanded');

		var children = [];
		for (var i = 1; i < data.children.length; i++) {
			children.push(data.children[i]);
		}

		builder.build(frameChildren, children);
	} else {
		return builder._controlHandlers['container'](parentContainer, data, builder);
	}

	return false;
};
