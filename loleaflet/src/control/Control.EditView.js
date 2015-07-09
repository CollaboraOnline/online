/*
 * L.Control.EditView is used for switching between viewing and editing mode
 */

L.Control.EditViewSwitch = L.Control.extend({
	options: {
		position: 'topleft'
	},

	onAdd: function (map) {
		var partName = 'leaflet-control-editviewswitch',
			container = L.DomUtil.create('label', partName + ' leaflet-bar');

		this._checkBox = L.DomUtil.create('input', 'editview-cb', container);
		this._checkBox.type = 'checkbox';
		L.DomEvent.on(this._checkBox, 'change', this._onChange, this);
		map.on('updatemode:view updatemode:edit updatemode:readonly', this._onUpdateMode, this);
		container.appendChild(document.createTextNode('Enable editing'));
		return container;
	},

	_onChange: function () {
		var className = 'leaflet-editmode';
		if (this._checkBox.checked) {
			this._map.fire('editmode');
			L.DomUtil.addClass(this._map._container, className);
		}
		else {
			this._map.fire('viewmode');
			L.DomUtil.removeClass(this._map._container, className);
		}
	},

	_onUpdateMode: function (e) {
		var className = 'leaflet-editmode';
		if (e.type === 'updatemode:edit') {
			this._map.fire('editmode');
			L.DomUtil.addClass(this._map._container, className);
			this._checkBox.checked = true;
		}
		else if (e.type === 'updatemode:view') {
			this._map.fire('viewmode');
			L.DomUtil.removeClass(this._map._container, className);
			this._checkBox.checked = false;
		}
		else if (e.type === 'updatemode:readonly') {
			this._checkBox.disabled = true;
		}
	}
});

L.Map.mergeOptions({
	editViewSwitchControl: true
});

L.Map.addInitHook(function () {
	if (this.options.editViewSwitchControl) {
		this.editViewSwitchControl = new L.Control.EditViewSwitch();
		this.addControl(this.editViewSwitchControl);
	}
});

L.control.editViewSwitch = function (options) {
	return new L.Control.EditViewSwitch(options);
};
