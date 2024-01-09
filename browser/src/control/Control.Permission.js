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
 * L.Control.EditView is used for switching between viewing and editing mode
 */

L.Control.PermissionSwitch = L.Control.extend({
	options: {
		position: 'topleft'
	},

	onAdd: function (map) {
		var partName = 'leaflet-control-editviewswitch',
		    container = L.DomUtil.create('label', partName + ' leaflet-bar');

		this._checkBox = L.DomUtil.create('input', 'editview-cb', container);
		this._checkBox.type = 'checkbox';
		L.DomEvent.on(this._checkBox, 'change', this._onChange, this);
		map.on('updatepermission', this._onUpdatePermission, this);
		container.appendChild(document.createTextNode('Enable editing'));
		return container;
	},

	_onChange: function () {
		if (this._checkBox.checked) {
			this._map.setPermission('edit');
		}
		else {
			this._map.setPermission('view');
		}
		this._map.focus();
	},

	_onUpdatePermission: function (e) {
		if (e.perm === 'edit') {
			this._checkBox.checked = true;
			this._checkBox.disabled = false;
		}
		else if (e.perm === 'view') {
			this._checkBox.checked = false;
			this._checkBox.disabled = false;
		}
		else if (e.perm === 'readonly') {
			this._checkBox.checked = false;
			this._checkBox.disabled = true;
		}
	}
});

L.control.permissionSwitch = function (options) {
	return new L.Control.PermissionSwitch(options);
};
