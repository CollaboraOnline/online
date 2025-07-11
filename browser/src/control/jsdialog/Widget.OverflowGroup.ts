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
 * JSDialog.OverflowGroup - can hide items from last to first if requested and
 *                          add dropdown menu to access them instead
 */

declare var JSDialog: any;

JSDialog.OverflowGroup = function (
	parentContainer: Element,
	data: ContainerWidgetJSON,
	builder: JSBuilder,
) {
	const container = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group',
		parentContainer,
	);
	container.id = data.id;
	container.style.display = 'grid';
	container.style.gridAutoFlow = 'column';

	const innerContainer = L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-overflow-group',
		container,
	);
	innerContainer.id = data.id + '-content';
	innerContainer.style.display = 'grid';
	innerContainer.style.gridAutoFlow = 'column';

	// content
	builder.build(innerContainer, data.children, false);

	// button
	builder.build(
		container,
		[
			{
				type: 'customtoolitem',
				id: 'menuoverflow',
				text: _('More'),
			} as any as WidgetJSON,
		],
		false,
	);

	return false;
} as JSWidgetHandler;
