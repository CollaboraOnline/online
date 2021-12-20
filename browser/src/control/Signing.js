/* -*- js-indent-level: 8 -*- */
/*
 * Document Signing
 */

/* global app window setupViamAPI w2ui vex Promise $ _ */

var library = null;
var identity = null;
var currentPassport = null;
var passportCertificates = [];

var oldtoolbarSize = null;
var _map = null;
var currentDocumentSigningStatus = 'N/A';

var awaitForDocumentStatusToUpload = false;
var currentDocumentType = null;

function isSuccess(result) {
	return result.code == '200';
}

function haveIdentity() {
	return identity != null;
}

function getVereignWopiURL() {
	var vereignURL = window.documentSigningURL == null ? '' : window.documentSigningURL;
	return vereignURL + '/wopi/';
}

function getVereignApiURL() {
	var vereignURL = window.documentSigningURL == null ? '' : window.documentSigningURL;
	return vereignURL + '/api/';
}

function getVereignIFrameURL() {
	var vereignURL = window.documentSigningURL == null ? '' : window.documentSigningURL;
	return vereignURL + '/vcl/js/iframe';
}

function randomName() {
	return Math.random().toString(36).substring(2) + (new Date()).getTime().toString(36);
}

function getCurrentDocumentFilename(documentType) {
	var filename = _map['wopi'].BaseFileName;
	if (!filename)
		filename = randomName() + '.' + documentType;
	return filename;
}

function updateIndentity() {
	if (library && identity) {
		library.getIdentityProfile(identity.authentication.publicKey).then(function(result) {
			var initials = result.data.initials;
			var color = result.data.identityColor;
			w2ui['document-signing-bar'].get('identity').html = '<p style="background-color: ' + color + '; border: none; color: white; padding: 8px; text-align: center; text-decoration: none; display: inline-block; font-size: 12px; margin: 4px 2px; border-radius: 50%;">' + initials + '</p>';
			w2ui['document-signing-bar'].refresh();
		});
	}
	else {
		w2ui['document-signing-bar'].get('identity').html = '';
		w2ui['document-signing-bar'].refresh();
	}
}

function addPassportToToolbar(passport, i) {
	var name = null;
	try {
		name = passport['claims']['passportName']['tags']['notag']['value']['value'];
	}
	catch (exception) {
		window.app.console.log(exception);
		name = 'Unknown ' + (i+1);
	}

	w2ui['document-signing-bar'].get('passport').items.push(
		{ text: name, id: 'item ' + (i+1), value: passport.uuid }
	);

	var promise = library.getCertificateByPassport(passport.uuid);
	promise = promise.then(function(result) {
		if (isSuccess(result)) {
			var chain = result.data.chain;
			for (var i = 0; i < chain.length; i++) {
				if (passportCertificates.indexOf(chain[i]) == -1) {
					passportCertificates.push(chain[i]);
				}
			}
			passportCertificates.push(result.data.x509Certificate);
		}
	});
	return promise;
}

function checkCurrentDocument() {
	var certificates = {
		certificates: passportCertificates
	};
	var blob = new Blob(['asksignaturestatus\n', JSON.stringify(certificates)]);
	if (_map) {
		app.socket.sendMessage(blob);
	}
}

function updatePassportList() {
	if (library) {
		library.passportListPassports().then(function(result) {
			if (isSuccess(result))
			{
				passportCertificates = [];
				w2ui['document-signing-bar'].get('passport').items = [];
				var passports = result.data;
				var promises = [];
				for (var i = 0; i < passports.length; i++) {
					promises.push(addPassportToToolbar(passports[i], i));
				}
				// wait for all promises to complete
				Promise.all(promises).then(function() {
					updateCurrentPassport();
					checkCurrentDocument();
					adjustUIState();
				});
			}
		});
	}
}

function updateCurrentPassport() {
	if (!haveIdentity())
		return;
	if (currentPassport) {
		w2ui['document-signing-bar'].get('current-passport').html = '<p>' + currentPassport.text + '</p>';
	}
	adjustUIState();
}

function adjustUIState() {
	if (w2ui['document-signing-bar'] === undefined)
		return;

	if (library && identity) {
		w2ui['document-signing-bar'].show('passport');
		w2ui['document-signing-bar'].show('passport-break');

		if (currentPassport) {
			w2ui['document-signing-bar'].show('current-passport');
			w2ui['document-signing-bar'].show('sign-upload');
			w2ui['document-signing-bar'].show('sign-upload-break');
		}
		else {
			w2ui['document-signing-bar'].hide('current-passport');
			w2ui['document-signing-bar'].hide('sign-upload');
			w2ui['document-signing-bar'].hide('sign-upload-break');
		}

		w2ui['document-signing-bar'].show('identity');
		w2ui['document-signing-bar'].hide('login');
	}
	else {
		w2ui['document-signing-bar'].hide('passport');
		w2ui['document-signing-bar'].hide('current-passport');
		w2ui['document-signing-bar'].hide('passport-break');
		w2ui['document-signing-bar'].hide('sign-upload-break');
		w2ui['document-signing-bar'].hide('sign-upload');

		w2ui['document-signing-bar'].hide('identity');
		if (library)
			w2ui['document-signing-bar'].show('login');
		else
			w2ui['document-signing-bar'].hide('login');
	}

	w2ui['document-signing-bar'].get('current-document-status').html = '<p>' + currentDocumentSigningStatus + '</p>';
	w2ui['document-signing-bar'].refresh();
}

function vereignLoadIdentity(selectedIdentityKey, pincode) {
	library.loadIdentity(selectedIdentityKey, pincode).then(function(result) {
		if (isSuccess(result)) {
			identity = result.data;
			vereignLogin();
		}
		else {
			identity = null;
			vereignPinCodeDialog(selectedIdentityKey);
		}
	});
}

function vereignPinCodeDialog(selectedIdentityKey) {
	vex.dialog.open({
		contentClassName: 'vex-has-inputs',
		message: _('Please enter the PIN Code'),
		input: '<input name="pincode" type="password" value="" required />',
		callback: function(data) {
			if (library && data.pincode != null && data.pincode != '') {
				vereignLoadIdentity(selectedIdentityKey, data.pincode);
			}
		}
	});
}

function vereignLogin() {
	if (library && identity) {
		library.login(identity, 'previousaddeddevice').then(function(result) {
			if (isSuccess(result)) {
				updatePassportList();
				updateIndentity();
				adjustUIState();
			}
			else {
				vex.dialog.alert(_('Error at login.'));
				window.app.console.log('Error at login of previousa added device');
				window.app.console.log(result);
				identity = null;
			}
		});
	}
}

function verignNewIdentity(newIdentity) {
	library.login(newIdentity, 'newdevice', '', '').then(function(result) {
		if (isSuccess(result)) {
			vex.open({
				content: '<p>' + _('Please scan the code') + '</p><p><div id="image-container"></div></p>',
				showCloseButton: true,
				escapeButtonCloses: true,
				overlayClosesOnClick: true,
				buttons: {},
				afterOpen: function() {
					var $vexContent = $(this.contentEl);
					var container = $vexContent.find('#image-container');
					var image = $('<img style="display: block; margin-left: auto; margin-right: auto"/>');
					image.attr('src', result.data.image);
					container.append(image);
				}
			});
		}
		else {
			vex.dialog.alert(_('Couldn\'t get the QR code image.'));
			window.app.console.log('Error getting the QR code');
			window.app.console.log(result);
			library.clearIdentities();
		}
	});
}

function verignQrDialog() {
	if (library == null) {
		return;
	}
	library.createIdentity('00000000').then(function(result) {
		if (isSuccess(result)) {
			verignNewIdentity(result.data);
		}
	});
}

function vereignRecoverFromEmail(emailOrSMS) {
	library.createIdentity('00000000').then(function(result) {
		if (!isSuccess(result)) {
			return;
		}
		var createdIdentity = result.data;
		library.identityRestoreAccess(result.data, emailOrSMS).then(function(result) {
			if (!isSuccess(result)) {
				vex.dialog.alert(_('Error when trying to restore access to identity.'));
				window.app.console.log('Error at IdentityRestoreAccess');
				window.app.console.log(result);
				return;
			}
			vex.dialog.open({
				message: _('PIN Code'),
				input: '<p>' + _('Please enter the PIN code from the EMail or SMS') + '</p><input name="pincode" type="password" value="" required />',
				callback: function(data) {
					if (data.pincode) {
						library.login(createdIdentity, 'sms', data.pincode, '').then(function(result) {
							if (isSuccess(result)) {
								vereignRestoreIdentity();
							}
						});
					}
				}
			});
		});
	});
}

function vereignRecoverFromEmailDialog() {
	if (library == null) {
		return;
	}
	vex.dialog.open({
		contentClassName: 'vex-has-inputs',
		message: _('Login from email or mobile number'),
		input: '<input name="emailOrMobileNumber" type="text" value="" required />',
		callback: function(data) {
			if (data.emailOrMobileNumber) {
				vereignRecoverFromEmail(data.emailOrMobileNumber);
			}
		}
	});
}

function vereignRestoreIdentity() {
	if (library == null) {
		return;
	}
	library.getCurrentlyAuthenticatedIdentity().then(function(result) {
		if (isSuccess(result)) {
			identity = result.data;
			vex.closeAll();
			updateIndentity();
			updatePassportList();
			adjustUIState();
		}
	});
}

function vereignSignAndUploadDocument() {
	if (library == null) {
		return;
	}
	if (currentPassport == null) {
		return;
	}
	vex.dialog.open({
		contentClassName: 'vex-has-inputs',
		message: _('Select document type to upload'),
		input: _('Type:') + '<select name="selection"><option value="ODT">ODT</option><option value="DOCX">DOCX</option><option value="PDF">PDF</option></select>',
		callback: function(data) {
			vereignSignAndUploadForType(data.selection);
		}
	});
}

function vereignUpload(documentType) {
	if (library == null || documentType == null) {
		return;
	}

	var filename = getCurrentDocumentFilename(documentType);

	library.getPassports(filename).then(function(result) {
		if (!isSuccess(result)) {
			return;
		}
		var resultArray = result.data;
		for (var i = 0; i < resultArray.length; i++) {
			if (currentPassport.uuid == resultArray[i].PassportUUID) {
				var jsonRequest = {
					filename: filename,
					wopiUrl: getVereignWopiURL() + 'files',
					token: resultArray[i].AccessToken,
					type: documentType
				};
				var blob = new Blob(['uploadsigneddocument\n', JSON.stringify(jsonRequest)]);
				app.socket.sendMessage(blob);
				// Let the user know that we're done.
				_map.fire('infobar', {
					msg: _('Document uploaded.') + '\n\n' + filename,
					action: null,
					actionLabel: null
				});
			}
		}
	});
}

function vereignExportSignAndUploadToVereign(documentType) {
	library.getOneTimeCertificateByPassport(currentPassport.uuid).then(function(result) {
		if (!isSuccess(result)) {
			return;
		}
		var otp = result.data;
		var filename = getCurrentDocumentFilename(documentType);
		library.getPassports(filename).then(function(result) {
			if (!isSuccess(result)) {
				return;
			}
			var resultArray = result.data;
			for (var i = 0; i < resultArray.length; i++) {
				if (currentPassport.uuid == resultArray[i].PassportUUID) {
					var parameters = {
						x509Certificate: otp.x509Certificate,
						privateKey: otp.privateKey,
						chain: otp.chain,
						filename: filename,
						wopiUrl: getVereignWopiURL() + 'files',
						token: resultArray[i].AccessToken,
						type: documentType
					};
					var blob = new Blob(['exportsignanduploaddocument\n', JSON.stringify(parameters)]);
					app.socket.sendMessage(blob);
				}
			}
		});
	});
}

function vereignSignAndUploadForType(uploadDocType) {
	var documentType = null;

	switch (uploadDocType) {
	case 'ODT':
		documentType = 'odt';
		break;
	case 'DOCX':
		documentType = 'docx';
		break;
	case 'PDF':
		documentType = 'pdf';
		break;
	}

	if (documentType == null)
		return;

	if (uploadDocType == 'PDF' || uploadDocType == 'DOCX' || uploadDocType == 'ODT') {
		vereignExportSignAndUploadToVereign(documentType);
	}
	else {
		library.getOneTimeCertificateByPassport(currentPassport.uuid).then(function(result) {
			if (isSuccess(result)) {
				var otp = result.data;
				var blob = new Blob(['signdocument\n', JSON.stringify(otp)]);
				app.socket.sendMessage(blob);
				awaitForDocumentStatusToUpload = true;
				currentDocumentType = documentType;
				checkCurrentDocument();
			}
		});
	}
}

L.Map.include({
	showSignDocument: function() {
		$('#document-signing-bar').show();
		this.initializeLibrary();
		oldtoolbarSize = $(this.options.documentContainer).css('top');

		$(this.options.documentContainer).css('top', '116px');

		// Avoid scroll button ">>"
		var el = w2ui['document-signing-bar'];
		if (el)
			el.resize();
	},
	hideSignToolbar: function() {
		$('#document-signing-bar').hide();
		library = null;
		identity = null;
		currentPassport = null;
		$(this.options.documentContainer).css('top', oldtoolbarSize);
	},
	signingInitializeBar: function() {
		$('#document-signing-bar').hide();
		adjustUIState();
	},
	signingLogout: function() {
		if (library) {
			library.logout().then(function() {
				identity = null;
				currentPassport = null;
				updateIndentity();
				adjustUIState();
			});
		}
	},
	signingLogin: function() {
		var w = window.innerWidth / 2;

		var loginWithQR = false;
		var recoverFromEmail = false;
		var selectedIdentityKey = null;

		$.get('signing-identities.html', function(data) {
			vex.open({
				content: data,
				showCloseButton: true,
				escapeButtonCloses: true,
				overlayClosesOnClick: true,
				buttons: {},
				afterOpen: function() {
					var that = this;
					this.contentEl.style.width = w + 'px';
					var $vexContent = $(this.contentEl);
					$('#select-identity').text(_('Select identity:'));
					$('#login-qr').text(_('Login from mobile'));
					$('#recover-from-email').text(_('Recover from email'));
					library.listIdentities().then(function(response) {
						var identities = response.data;
						var identitiesDiv = $vexContent.find('#identities');
						for (var key in identities) {
							var button = $('<input class="identity-button" type="button"/>');
							button.attr('value', identities[key].initials);
							button.css('background-color', identities[key].identityColor);
							button.click({ key: key }, function(current) {
								selectedIdentityKey = current.data.key;
								that.close();
							});
							identitiesDiv.append(button);
						}
					});
					$('#login-qr').click(function() {
						loginWithQR = true;
						that.close();
					});
					$('#recover-from-email').click(function() {
						recoverFromEmail = true;
						that.close();
					});
				},
				afterClose: function () {
					if (loginWithQR) {
						verignQrDialog();
					}
					else if (recoverFromEmail) {
						vereignRecoverFromEmailDialog();
					}
					else if (selectedIdentityKey) {
						vereignLoadIdentity(selectedIdentityKey, '00000000');
					}
				}
			});
		});
	},
	initializeLibrary: function() {
		var vereignURL = window.documentSigningURL == null ? '' : window.documentSigningURL;
		if (vereignURL.length == 0)
			return;
		_map = this;
		setupViamAPI(
			'signdocument-iframe-content',
			{
				onEvent: function(event) {
					switch (event.type) {
					case 'ActionConfirmedAndExecuted':
						window.app.console.log('event ActionConfirmedAndExecuted');
						break;
					case 'IdentityNotLoaded':
						vereignLoadIdentity(event.payloads[0], '00000000');
						break;
					case 'Authenticated':
						window.app.console.log('event Authenticated');
						vereignRestoreIdentity();
						break;
					case 'Logout':
						window.app.console.log('event Logout');
						_map.signingLogout();
						break;
					case 'QRCodeUpdated':
						window.app.console.log('event QRCodeUpdated');
						break;
					default:
						window.app.console.log('UNKNOWN EVENT: ' + event.type);
						break;
					}
				}
			},
			getVereignIFrameURL(),
			getVereignApiURL(),
			getVereignWopiURL()
		).then(function(lib) {
			library = lib;
			adjustUIState();
		});
	},
	setCurrentPassport: function(uuid, text) {
		if (library && identity && uuid) {
			currentPassport = { uuid: uuid, text: text };
			updateCurrentPassport();
			library.passportGetAvatarByPassport(uuid).then(function(result) {
				window.app.console.log(result); // TODO
			});
			adjustUIState();
		}
	},
	handleSigningClickEvent: function(id, item) {
		if (id === 'close-document-signing-bar') {
			this.signingLogout();
			this.hideSignToolbar();
		}
		else if (id === 'login' || id === 'identity') {
			this.signingLogin();
		}
		else if (id === 'sign-upload') {
			vereignSignAndUploadDocument();
		}
		else if (id.startsWith('passport:')) {
			this.setCurrentPassport(item.value, item.text);
		}
		return false;
	},
	setupSigningToolbarItems: function() {
		return [
			{type: 'html',  id: 'logo', html: '<a href="http://www.vereign.com" target="_blank"><img src="' + L.LOUtil.getImageURL('vereign.png') + '" style="padding-right: 16px; padding-left: 6px; height: 32px"/></a>' },
			{type: 'menu', id: 'passport', caption: _('Select passport'), items: []},
			{type: 'html', id: 'current-passport', html: _('Passport: N/A')},
			{type: 'break', id: 'passport-break' },
			{type: 'button',  id: 'sign-upload',  caption: _('Sign'), img: '', hint: _('Sign document')},
			{type: 'break', id: 'sign-upload-break' },
			{type: 'html', id: 'current-document-status-label', html: '<p><b>' + _('Status:') + '&nbsp;</b></p>'},
			{type: 'html', id: 'current-document-status', html: _('N/A')},
			{type: 'spacer'},
			{type: 'html', id: 'identity', html: ''},
			{type: 'button',  id: 'login',  caption: _('Login'), img: '', hint: _('Login')},
			{type: 'button',  id: 'close-document-signing-bar', img: 'closetoolbar', hint: _('Close')}];
	},
	onChangeSignStatus: function(signstatus) {
		var statusText = '';
		var statusIcon = '';
		// This is meant to be in sync with core.git
		// include/sfx2/signaturestate.hxx, SignatureState.
		switch (signstatus) {
		case '0':
			currentDocumentSigningStatus = _('Not Signed');
			break;
		case '1':
			statusText = _('This document is digitally signed and the signature is valid.');
			statusIcon = 'sign_ok';
			currentDocumentSigningStatus = _('Signed and validated');
			break;
		case '2':
			statusText = _('This document has an invalid signature.');
			statusIcon = 'sign_not_ok';
			currentDocumentSigningStatus = _('Signature broken');
			break;
		case '3':
			statusText = _('The signature was valid, but the document has been modified.');
			statusIcon = 'sign_not_ok';
			currentDocumentSigningStatus = _('Signed but document modified');
			break;
		case '4':
			statusText = _('The signature is OK, but the certificate could not be validated.');
			statusIcon = 'sign_not_ok';
			currentDocumentSigningStatus = _('Signed but not validated');
			break;
		case '5':
			statusText = _('The signature is OK, but the document is only partially signed.');
			statusIcon = 'sign_not_ok';
			currentDocumentSigningStatus = _('Signed but not all files are signed');
			break;
		case '6':
			statusText = _('The signature is OK, but the certificate could not be validated and the document is only partially signed.');
			statusIcon = 'sign_not_ok';
			currentDocumentSigningStatus = _('Signed but not validated and not all files are signed');
			break;
		}

		if (statusText) {
			if (!window.mode.isMobile())
				w2ui['actionbar'].insert('prev', {type: 'button',  id: 'signstatus', img: statusIcon, hint: statusText});
			else
				w2ui['actionbar'].insert('undo', {type: 'button',  id: 'signstatus', img: statusIcon, hint: statusText});
		}

		adjustUIState();

		if (awaitForDocumentStatusToUpload) {
			awaitForDocumentStatusToUpload = false;
			vereignUpload(currentDocumentType);
		}
		awaitForDocumentStatusToUpload = false;
		currentDocumentType = null;
	},
	onVereignUploadStatus: function(uploadStatus) {
		if (uploadStatus == 'OK') {
			_map.fire('infobar', {
				msg: _('Document uploaded.'),
				action: null,
				actionLabel: null
			});
		}
	}
});
