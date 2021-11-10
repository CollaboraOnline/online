/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Selection enables by mouse drag selection in viewing mode
 */

L.Control.Selection = L.Control.extend({
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
		container.appendChild(document.createTextNode('Enable Selection'));
		return container;
	},

	_onChange: function () {
		if (this._checkBox.checked) {
			this._map.enableSelection();
		}
		else {
			this._map.disableSelection();
		}
		this._map.focus();
	},

	_onUpdatePermission: function (e) {
		if (e.perm === 'edit') {
			this._checkBox.checked = false;
			this._checkBox.disabled = true;
		}
		else if (e.perm === 'view') {
			this._checkBox.checked = false;
			this._checkBox.disabled = false;
		}
		else if (e.perm === 'readonly') {
			this._checkBox.checked = false;
			this._checkBox.disabled = false;
		}
	}
});

L.control.selection = function (options) {
	return new L.Control.Selection(options);
};
