/*
 * L.Control.Dialog used for displaying alerts
 */

L.Control.Dialog = L.Control.extend({
	onAdd: function (map) {
		map.on('error', this._onError, this);
		return document.createElement('div');
	},

	_onError: function (e) {
		vex.dialog.alert(e.msg);
	}
});

L.control.dialog = function (options) {
	return new L.Control.Dialog(options);
};
