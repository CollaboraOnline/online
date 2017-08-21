/*
 * L.Control.LokDialog used for displaying LOK dialogs
 */

/* global vex $ */
L.Control.LokDialog = L.Control.extend({
	onAdd: function (map) {
		// TODO: Better distinction between warnings and errors
		map.on('dialog', this._onDialogMsg, this);
	},

	_onDialogMsg: function (e) {
		var content = '<div id="lokdialog_container"><img id="lokdialog_content" src= ' + e.dialog + '></div>';
		$(document.body).append(content);
		$('#lokdialog_container').dialog({
			width: e.width,
			height: 'auto',
			closeText: 'X',
			title: 'LOK Dialog', // TODO: Get the 'real' dialog title from the backend
			modal: false,
			closeOnEscape: true,
			resizable: false,
			close: function(e, ui) {
				$('#lokdialog_container').remove();
			}
		});
	}
});

L.control.lokDialog = function (options) {
	return new L.Control.LokDialog(options);
};
