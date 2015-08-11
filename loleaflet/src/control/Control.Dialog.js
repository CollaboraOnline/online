/*
 * L.Control.Dialog used for displaying alerts
 */

L.Control.Dialog = L.Control.extend({
	onAdd: function (map) {
		map.on('error', this._onError, this);
		return document.createElement('div');
	},

	_onError: function (e) {
		if (e.msg) {
			vex.dialog.alert(e.msg);
		}
		else if (e.cmd && e.kind) {
			var msg = 'The server encountered a \'' + e.kind + '\' error while' +
						' parsing the \'' + e.cmd + '\' command.';
			vex.dialog.alert(msg);
		}
	}
});

L.control.dialog = function (options) {
	return new L.Control.Dialog(options);
};
