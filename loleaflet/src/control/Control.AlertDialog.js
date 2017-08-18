/*
 * L.Control.Dialog used for displaying alerts
 */

/* global vex */
L.Control.AlertDialog = L.Control.extend({
	onAdd: function (map) {
		// TODO: Better distinction between warnings and errors
		map.on('error', this._onError, this);
		map.on('warn', this._onError, this);
		map.on('print', this._onPrint, this);
	},

	_onError: function(e) {
		if (vex.dialogID > 0 && !this._map._fatal) {
			// TODO. queue message errors and pop-up dialogs
			// Close other dialogs before presenting a new one.
			vex.close(vex.dialogID);
		}

		if (e.msg) {
			vex.dialog.alert(e.msg);
		}
		else if (e.cmd == 'load' && e.kind == 'docunloading') {
			// Handled by transparently retrying.
			return;
		} else if (e.cmd && e.kind) {
			var msg = 'The server encountered a \'' + e.kind + '\' error while' +
						' parsing the \'' + e.cmd + '\' command.';
			vex.dialog.alert(msg);
		}

		// Remember the current dialog ID to close it later.
		vex.dialogID = vex.globalID - 1;
	},

	_onPrint: function (e) {
		var url = e.url;
		vex.dialog.confirm({
			message: 'Download PDF export?',
			callback: L.bind(function (value) {
				if (value) {
					this._map._fileDownloader.src = url;
				}
			}, this)
		});
	}
});

L.control.alertDialog = function (options) {
	return new L.Control.AlertDialog(options);
};
