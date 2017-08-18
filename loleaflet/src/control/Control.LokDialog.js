/*
 * L.Control.LokDialog used for displaying LOK dialogs
 */

/* global vex */
L.Control.LokDialog = L.Control.extend({
	onAdd: function (map) {
		// TODO: Better distinction between warnings and errors
		map.on('dialog', this._onDialogMsg, this);
	},

	_onDialogMsg: function (e) {
		console.log(e);
	}
});

L.control.lokDialog = function (options) {
	return new L.Control.LokDialog(options);
};
