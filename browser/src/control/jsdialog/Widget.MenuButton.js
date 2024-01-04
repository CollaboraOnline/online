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
 */

/* global JSDialog $ */

function _makeW2MenuFocusable(id, control, menu) {
	var element = document.getElementById(id);
	var rows = element.getElementsByTagName('tr');
	rows = Array.from(rows);

	if (rows.length > 0) {
		var tabStartIndex = 1000; // Shouldn't be 0 (zero).
		// Loop focus inside menu - start.
		var parentNode = rows[0].parentNode;
		var trBegin = document.createElement('tr');
		trBegin.tabIndex = tabStartIndex - 1;
		trBegin.id = id + '-beginning';
		parentNode.insertBefore(trBegin, parentNode.children[0]);

		var trEnd = document.createElement('tr');
		trEnd.id = id + '-ending';
		trEnd.tabIndex = tabStartIndex + rows.length;
		parentNode.appendChild(trEnd);

		trBegin.addEventListener('focusin', function() {
			rows[rows.length - 1].focus();
		});

		trEnd.addEventListener('focusin', function() {
			rows[0].focus();
		});
		// Loop focus inside menu - end.

		trEnd.focus();

		rows.forEach(function(row, index) {
			if (!menu[index].type || (menu[index].type !== 'break' && menu[index].type !== 'separator'))
				row.tabIndex = index + tabStartIndex;

			row.addEventListener('keydown', function(event) {
				var elementToHide = document.getElementById(id);
				if (event.code === 'Escape') {
					if (elementToHide) {
						elementToHide.style.display = 'none';
						control.button.focus();
					}
				}
			});
		});
	}
}

function _menubuttonControl (parentContainer, data, builder) {
	var ids;
	var menuId = null;

	if (data.id.includes(':')) {
		ids = data.id.split(':');
		menuId = ids[1];
		data.id = ids[0];
	}
	else if (data.id.includes('-')) {
		ids = data.id.split('-');
		menuId = ids[1];
		data.id = ids[0];
	}
	else
		menuId = data.id;

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
					else if (event.item.type === 'action')
						builder.map.dispatch(event.item.id);
					else
						builder.callback('menubutton', 'select', control.container, event.item.id, builder);
				}
			});
			_makeW2MenuFocusable('w2ui-overlay', control, builder._menus[menuId]);
		});

		builder.options.noLabelsForUnoButtons = noLabels;
	} else if (data.text !== undefined || data.image) {
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

		if (data.enabled === false)
			button.setAttribute('disabled', true);
	} else {
		window.app.console.warn('Not found menu "' + menuId + '"');
	}

	return false;
}

JSDialog.menubuttonControl = function (parentContainer, data, builder) {
	var buildInnerData = _menubuttonControl(parentContainer, data, builder);
	return buildInnerData;
};
