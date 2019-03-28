/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Dialog used for displaying alerts
 */

/* global _ vex */
L.Control.AlertDialog = L.Control.extend({
	onAdd: function (map) {
		// TODO: Better distinction between warnings and errors
		map.on('error', this._onError, this);
		map.on('warn', this._onError, this);
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
		} else if (e.cmd == 'openlink') {
			var url = e.url;
			var messageText = window.errorMessages.leaving;

			var isLinkValid = true;
			if (url.trim().toLowerCase().startsWith('javascript:')) {
				isLinkValid = false;
				messageText = window.errorMessages.invalidLink;
				messageText = messageText.replace('%url', url);
			}

			var buttonsList = [];

			if (isLinkValid) {
				buttonsList.push({
					text: _('Open link'),
					type: 'button',
					className: 'vex-dialog-button-primary',
					click: function openClick () {
						window.open(url, '_blank');
						vex.close(vex.dialogID);
						vex.dialogID = 0;
					}
				});
			}

			buttonsList.push({
				text: _('Edit'),
				type: 'button',
				className: 'vex-dialog-button-secondary',
				click: function editClick () {
					e.map.toggleCommandState('HyperlinkDialog');
					vex.close(vex.dialogID);
					vex.dialogID = 0;
				}
			});

			vex.dialog.open({
				message: messageText,
				showCloseButton: true,
				buttons: buttonsList,
				callback: function() {},
				beforeClose: function () {
					e.map.focus();
					e.map.enable(true);
				}
			});
		} else if (e.cmd && e.kind) {
			var msg = _('The server encountered a %0 error while parsing the %1 command.');
			msg = msg.replace('%0', e.kind);
			msg = msg.replace('%1', e.cmd);
			vex.dialog.alert(msg);
		}

		// Remember the current dialog ID to close it later.
		vex.dialogID = vex.globalID - 1;
	}
});

L.control.alertDialog = function (options) {
	return new L.Control.AlertDialog(options);
};
