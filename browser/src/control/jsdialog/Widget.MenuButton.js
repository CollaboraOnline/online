/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.MenuButton - button which can trigger some action or open a menu
 *
 * Example JSON:
 * {
 *     id: 'id:MenuId', (where MenuId is custom menu id, menu is stored in the builder)
 *     type: 'menubutton',
 *     text: 'Label',
 *     image: 'base64 encoded icon',
 *     command: '.uno:Command',
 *     enabled: false
 * }
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global JSDialog $ */

function _menubuttonControl (parentContainer, data, builder) {
	var ids = data.id.split(':');

	var menuId = null;
	if (ids.length > 1)
		menuId = ids[1];

	data.id = ids[0];

	// import menu
	if (data.menu) {
		menuId = data.id + '-menu';
		builder._menus[menuId] = [];
		for (var i in data.menu) {
			builder._menus[menuId].push({
				id: data.menu[i].id,
				text: data.menu[i].text
			});
		}
	}

	if (menuId && builder._menus[menuId]) {
		var noLabels = builder.options.noLabelsForUnoButtons;
		builder.options.noLabelsForUnoButtons = false;

		// command is needed to generate image
		if (!data.command)
			data.command = menuId;

		var options = {hasDropdownArrow: true};
		var control = builder._unoToolButton(parentContainer, data, builder, options);

		$(control.container).tooltip({disabled: true});
		$(control.container).addClass('menubutton');

		$(control.container).unbind('click');
		$(control.container).click(function () {
			$(control.container).w2menu({
				items: builder._menus[menuId],
				onSelect: function (event) {
					if (event.item.uno)
						builder.map.sendUnoCommand('.uno:' + event.item.uno);
					else
						builder.callback('menubutton', 'select', control.container, event.item.id, builder);
				}
			});
		});

		builder.options.noLabelsForUnoButtons = noLabels;
	} else if (data.text || data.image) {
		var button = L.DomUtil.create('button', 'menubutton ' + builder.options.cssClass, parentContainer);
		button.id = data.id;
		button.setAttribute('aria-haspopup', true);
		if (data.image) {
			var image = L.DomUtil.create('img', '', button);
			image.src = data.image;
		}
		var label = L.DomUtil.create('span', '', button);
		label.innerText = data.text ? data.text : '';
		L.DomUtil.create('i', 'arrow', button);

		$(button).click(function () {
			builder.callback('menubutton', 'toggle', button, undefined, builder);
		});
	} else {
		window.app.console.warn('Not found menu "' + menuId + '"');
	}

	return false;
}

JSDialog.menubuttonControl = function (parentContainer, data, builder) {
	var buildInnerData = _menubuttonControl(parentContainer, data, builder);
	return buildInnerData;
};
