/* -*- js-indent-level: 8 -*- */
/*
 * Document Signing
 */

/* global _ w2ui*/

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
				w2ui['actionbar'].insert('prev', {type: 'button',  id: 'signstatus', img: statusIcon, hint: statusText});
			else
				w2ui['actionbar'].insert('undo', {type: 'button',  id: 'signstatus', img: statusIcon, hint: statusText});
		}
	}
});
