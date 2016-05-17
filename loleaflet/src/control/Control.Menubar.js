/*
* Control.Menubar
*/

/* global $ */
L.Control.menubar = L.Control.extend({
	onAdd: function (map) {
		this._initialized = false;
		var docContainer = map.options.documentContainer;
		map.on('updatepermission', this._onUpdatePermission, this);

		//$('#main-menu').smartmenus();
	},

	_onUpdatePermission: function() {
		// TODO
		if (!this._initialized) {
			this._initialize();
		}
	},

	_initialize: function() {
		// TODO
	}
});

L.control.menubar = function (options) {
	return new L.Control.menubar(options);
};
