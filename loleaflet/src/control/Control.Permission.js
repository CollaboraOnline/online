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

L.Map.mergeOptions({
	permissionSwitchControl: true
});

L.Map.addInitHook(function () {
	if (this.options.permissionSwitchControl) {
		this.permissionSwitchControl = new L.Control.PermissionSwitch();
		this.addControl(this.permissionSwitchControl);
	}
});

L.control.permissionSwitch = function (options) {
	return new L.Control.PermissionSwitch(options);
};
