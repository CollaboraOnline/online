/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Dialog used for displaying alerts
 */

/* global _ vex sanitizeUrl */
L.Control.AlertDialog = L.Control.extend({
	onAdd: function (map) {
		// TODO: Better distinction between warnings and errors
		map.on('error', this._onError, this);
		map.on('warn', this._onError, this);
	},

	_onError: function(e) {
		if (!this._map._fatal) {
			// TODO. queue message errors and pop-up dialogs
			// Close other dialogs before presenting a new one.
			vex.closeAll();
		}

		if (e.msg) {
			if (window.ThisIsAMobileApp && this._map._fatal) {
				var buttonsList = [];
				buttonsList.push({
					text: _('Close'),
					type: 'button',
					className: 'vex-dialog-button-primary',
					click: function() {
						window.postMobileMessage('BYE');
						vex.closeAll();
					}
				});

				vex.dialog.alert({
					message: e.msg,
					buttons: buttonsList,
					callback: function() {},
				});
			}
			else
				vex.dialog.alert(e.msg);
		}
		else if (e.cmd == 'load' && e.kind == 'docunloading') {
			// Handled by transparently retrying.
			return;
		} else if (e.cmd == 'openlink') {
			var url = e.url;
			var messageText = window.errorMessages.leaving;

			var isLinkValid = sanitizeUrl.sanitizeUrl(url) !== 'about:blank';

			if (!isLinkValid) {
				messageText = window.errorMessages.invalidLink;
			}

			messageText = messageText.replace('%url?', '?');
			var containerWithLink = document.createElement('div');
			containerWithLink.innerHTML = messageText;
			var externalUrl = document.createElement('p');
			externalUrl.classList.add('vex-dialog-external-url');
			externalUrl.innerHTML = url;
			containerWithLink.appendChild(externalUrl);
			buttonsList = [];

			if (isLinkValid) {
				buttonsList.push({
					text: _('Open link'),
					type: 'button',
					className: 'vex-dialog-button-primary',
					click: function() {
						window.open(url, '_blank');
						vex.closeAll();
					}
				});
			}

			vex.dialog.open({
				unsafeMessage: containerWithLink.outerHTML,
				showCloseButton: true,
				contentClassName: 'word-wrap-for-vex-dialog',
				buttons: buttonsList,
				callback: function() {},
				afterClose: function () {
					vex.dialogID = -1;
					e.map.focus();
				}
			});
		} else if (e.kind == 'freemiumdeny') {
			this._map.openSubscriptionPopup();
		} else if (e.cmd && e.kind) {
			var msg = _('The server encountered a %0 error while parsing the %1 command.');
			msg = msg.replace('%0', e.kind);
			msg = msg.replace('%1', e.cmd);
			vex.dialog.alert(msg);
		}
	}
});

L.control.alertDialog = function (options) {
	return new L.Control.AlertDialog(options);
};
