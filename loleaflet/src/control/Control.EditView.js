/*
 * L.Control.EditView is used for switching between viewing and editing mode
 */

L.Control.EditViewSwitch = L.Control.extend({
	options: {
		position: 'topleft',
	},

	onAdd: function (map) {
		var partName = 'leaflet-control-editviewswitch',
		    container = L.DomUtil.create('label', partName + ' leaflet-bar');

        this._checkBox = L.DomUtil.create('input', 'editview-cb', container);
        this._checkBox.type = 'checkbox';
        L.DomEvent.on(this._checkBox, 'change', this._onChange, this);
		container.appendChild(document.createTextNode('View only'));
		return container;
	},

    _onChange: function() {
        var className = 'leaflet-viewmode';
        if (this._checkBox.checked) {
            this._map.fire('viewmode');
            L.DomUtil.addClass(this._map._container, className);
        }
        else {
            this._map.fire('editmode');
            L.DomUtil.removeClass(this._map._container, className);
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
