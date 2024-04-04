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
 * Document Signing
 */

/* global _ app */

L.Map.include({
	onChangeSignStatus: function(signstatus) {
		var statusText = '';
		var statusIcon = '';
		// This is meant to be in sync with core.git
		// include/sfx2/signaturestate.hxx, SignatureState.
		switch (signstatus) {
		case '0':
			break;
		case '1':
			statusText = _('This document is digitally signed and the signature is valid.');
			statusIcon = 'sign_ok';
			break;
		case '2':
			statusText = _('This document has an invalid signature.');
			statusIcon = 'sign_not_ok';
			break;
		case '3':
			statusText = _('The signature was valid, but the document has been modified.');
			statusIcon = 'sign_not_ok';
			break;
		case '4':
			statusText = _('The signature is OK, but the certificate could not be validated.');
			statusIcon = 'sign_not_ok';
			break;
		case '5':
			statusText = _('The signature is OK, but the document is only partially signed.');
			statusIcon = 'sign_not_ok';
			break;
		case '6':
			statusText = _('The signature is OK, but the certificate could not be validated and the document is only partially signed.');
			statusIcon = 'sign_not_ok';
			break;
		}

		if (statusText) {
			if (!window.mode.isMobile())
				app.map.statusBar.showSigningItem(statusIcon, statusText);
			else
				app.map.mobileTopBar.showSigningItem(statusIcon, statusText);
		}
	}
});
