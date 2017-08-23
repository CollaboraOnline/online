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
		var dialogId = e.id.replace('.uno:', '');
		var content = '<div class="lokdialog_container" id="' + dialogId + '">' +
		    '<img class="lokdialog_content" src= ' + e.dialog + '></div>';
		$(document.body).append(content);
		$('#' + dialogId).dialog({
			width: e.width,
			height: 'auto',
			title: 'LOK Dialog', // TODO: Get the 'real' dialog title from the backend
			modal: false,
			closeOnEscape: true,
			resizable: false,
			close: function(e, ui) {
				$('#' + dialogId).remove();
			}
		});
	}
});

L.control.lokDialog = function (options) {
	return new L.Control.LokDialog(options);
};
