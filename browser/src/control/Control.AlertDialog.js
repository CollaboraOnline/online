/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * L.Control.Dialog used for displaying alerts
 */

/* global _ sanitizeUrl JSDialog */
L.Control.AlertDialog = L.Control.extend({
	onAdd: function (map) {
		// TODO: Better distinction between warnings and errors
		map.on('error', this._onError, this);
		map.on('warn', this._onError, this);
	},

	_onError: function(e) {
		if (!this._map._fatal &&
		    e.cmd !== 'notasync' &&
		    e.type !== 'warn') {
			this._map.uiManager.closeAll();
		}

		if (e.msg) {
			if (window.ThisIsAMobileApp && this._map._fatal) {
				this._map.uiManager.showConfirmModal('cool_alert', '', e.msg, _('Close'), function() {
					window.postMobileMessage('BYE');
					this._map.uiManager.closeAll();
				}.bind(this), true /* Hide cancel button */);
			}
			else
				this._map.uiManager.showConfirmModal('cool_alert', '', e.msg, _('Close'), function() { /* Do nothing. */ }, true);
		}
		else if (e.cmd == 'load' && e.kind == 'docunloading') {
			// Handled by transparently retrying.
			return;
		} else if (e.cmd == 'openlink') {
			var url = e.url;
			var messageText = window.errorMessages.leaving;

			var isLinkValid = sanitizeUrl(url) !== 'about:blank';

			if (!isLinkValid) {
				messageText = window.errorMessages.invalidLink;
			}

			this._map.uiManager.showInfoModal('openlink', _('External link'), messageText, url,
				isLinkValid ? _('Open link') : _('OK'), function() {
					if (!isLinkValid)
						return;
					if ('processCoolUrl' in window) {
						url = window.processCoolUrl({ url: url, type: 'doc' });
					}

					window.open(url, '_blank');
				});
		} else if (e.kind == 'network' && e.code == 24581) {
			if (e.cmd == 'paste') {
				var alertId = 'paste_network_access_error';
				var title = _('Copied external sources are not allowed');
				var message1 = _('It seems you have copied a selection that includes external images.');
				var message2 = _('Downloading external resources is forbidden but pasting images is still possible. Please right click in the image, choose "Copy Image" and paste it into the document instead.');
			} else {
				// insert image for example, it should not happen with correct coolwsd.xml configuration of net.lok_allow
				alertId = 'insert_network_access_error';
				title = _('External data source not allowed');
				message1 = _('It seems you have tried to insert external data.');
				message2 = _('Selected external data source is forbidden. Please contact the system administrator.');
			}

			if (JSDialog.shouldShowAgain(alertId)) {
				var alertOptions = {
					title: title,
					messages: [
						message1,
						message2
					],
					buttons: [
						{
							text: _('Don\'t show this again'),
							callback: function() {
								JSDialog.setShowAgain(alertId, false);
								return false; // Close modal
							}
						}
					],
					withCancel: false,
					focusId: JSDialog.generateModalId(alertId) + '-cancel'
				};

				JSDialog.showInfoModalWithOptions(alertId, alertOptions);
			}
		} else if (e.cmd == 'notasync') { // developer only no translation needed
			this._map.uiManager.showInfoModal(
				'cool_alert', '', 'This dialog is non-async', '', _('Close'), function() { /* Do nothing. */ }, false);
		} else if (e.cmd && e.kind) {
			this._map.fire('hidebusy');

			var msg = _('The server encountered a {0} error while parsing the {1} command.');
			msg = msg.replace('{0}', e.kind);
			msg = msg.replace('{1}', e.cmd);
			this._map.uiManager.showInfoModal('cool_alert', '', msg, '', _('Close'), function() { /* Do nothing. */ }, false);
		}
	}
});

L.control.alertDialog = function (options) {
	return new L.Control.AlertDialog(options);
};
