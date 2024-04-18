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
 * JSDialog.SidebarContainers - various container widgets for desktop sidebar
 */

declare var JSDialog: any;

JSDialog.deck = function (
	parentContainer: Element,
	data: WidgetJSON,
	builder: any,
) {
	var deck = L.DomUtil.create(
		'div',
		'deck ' + builder.options.cssClass,
		parentContainer,
	);
	deck.id = data.id;

	for (var i = 0; i < data.children.length; i++) {
		builder.build(deck, [data.children[i]]);
	}

	return false;
};

JSDialog.panel = function (
	parentContainer: Element,
	data: PanelWidgetJSON,
	builder: any,
) {
	// we want to show the contents always, hidden property decides if we collapse the panel
	if (data.children && data.children.length) data.children[0].visible = true;

	var expanderData: ExpanderWidgetJSON = data;
	expanderData.type = 'expander';
	expanderData.children = ([{ text: data.text }] as Array<any>).concat(
		data.children,
	);
	expanderData.id = data.id + 'PanelExpander';
	builder._expanderHandler(parentContainer, expanderData, builder, () => {
		expanderData; /*do nothing*/
	});

	var expander = $(parentContainer).children('#' + expanderData.id);
	if (expanderData.hidden === true) expander.hide();

	if (expanderData.command) {
		var iconParent = expander.children('.ui-expander').get(0);
		var icon = L.DomUtil.create(
			'div',
			'ui-expander-icon-right ' + builder.options.cssClass,
			iconParent,
		);
		builder._controlHandlers['toolitem'](
			icon,
			{
				type: 'toolitem',
				command: expanderData.command,
				aria: {
					label: expanderData.children[0].text
						? _('More options for {name}').replace(
								'{name}',
								expanderData.children[0].text,
							)
						: '',
				},
				icon: builder._createIconURL('morebutton'),
			},
			builder,
		);
	}

	return false;
};
