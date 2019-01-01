/* -*- js-indent-level: 8 -*- */
/*
 * Document Signing
 */

/* global window setupViamAPI w2ui vex Promise $ _ */

var library = null;
var identity = null;
var currentPassport = null;
var passportCertificates = [];

var oldtoolbarSize = null;
var _map = null;
var currentDocumentSigningStatus = 'N/A'

var awaitForDocumentStatusToUpload = false;

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
			w2ui['document-signing-bar'].get('identity').html = '<p>' + initials + '</p>';
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
		console.log(exception);
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
		_map._socket.sendMessage(blob);
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
		w2ui['document-signing-bar'].hide('login');
		w2ui['document-signing-bar'].show('logout');
		w2ui['document-signing-bar'].show('identity-label');
		w2ui['document-signing-bar'].show('identity');
		if (currentPassport) {
			w2ui['document-signing-bar'].show('passport');
			w2ui['document-signing-bar'].show('current-passport');
			w2ui['document-signing-bar'].show('sign-upload');
		}
		else {
			w2ui['document-signing-bar'].show('passport');
			w2ui['document-signing-bar'].hide('current-passport');
			w2ui['document-signing-bar'].hide('sign');
			w2ui['document-signing-bar'].hide('upload');
		}
	}
	else {
		if (library)
			w2ui['document-signing-bar'].show('login');
		else
			w2ui['document-signing-bar'].hide('login');

		w2ui['document-signing-bar'].hide('logout');
		w2ui['document-signing-bar'].hide('identity-label');
		w2ui['document-signing-bar'].hide('identity');
		w2ui['document-signing-bar'].hide('sign');
		w2ui['document-signing-bar'].hide('upload');
		w2ui['document-signing-bar'].hide('passport');
		w2ui['document-signing-bar'].hide('current-passport');
	}

	w2ui['document-signing-bar'].get('current-document-status').html = '<p>' + currentDocumentSigningStatus + '</p>';
	w2ui['document-signing-bar'].refresh();
}

function vereignPinCodeDialog(selectedIdentityKey) {
	vex.dialog.open({
		message: _('PIN Code'),
		input: '<input name="pincode" type="password" value="" required />',
		callback: function(data) {
			if (data.pincode != null && data.pincode != '' && library) {
				return library.loadIdentity(selectedIdentityKey, data.pincode).then(function(result) {
					if (isSuccess(result)) {
						identity = result.data;
						vereignLogin();
					}
					else {
						identity = null;
					}
				});
			}
		}
	});
}

function vereignLogin() {
	if (library && identity) {
		library.login(identity, 'previousaddeddevice', '', '').then(function(result) {
			if (isSuccess(result)) {
				console.log(result);
			}
			updateIndentity();
			updatePassportList();
			adjustUIState();
		});
	}
}

function verignNewIdentity(newIdentity) {
	library.login(newIdentity, 'newdevice', '', '').then(function(result) {
		if (isSuccess(result)) {
			vex.open({
				content: '<div id="image-container"></div>',
				showCloseButton: true,
				escapeButtonCloses: true,
				overlayClosesOnClick: true,
				buttons: {},
				afterOpen: function($vexContent) {
					var container = $vexContent.find('#image-container');
					var image = $('<img style="display: block; margin-left: auto; margin-right: auto"/>');
					image.attr('src', result.data.image);
					container.append(image);
				}
			});
		}
		else {
			vex.dialog.alert(_('Couldn\'t get the QR code image.'));
			console.log('Login Error: ' + result);
			library.clearIdentities();
		}
	});
}

function verignQrDialog() {
	if (library) {
		library.createIdentity('00000000').then(function(result) {
			if (isSuccess(result)) {
				verignNewIdentity(result.data);
			}
		});
	}
}

function vereignRecoverFromEmail() {
	if (library == null) {
		return;
	}
	vex.dialog.open({
		message: _('Login from email or mobile number'),
		input: '<input name="emailOrMobileNumber" type="text" value="" required />',
		callback: function(data) {
			if (data.emailOrMobileNumber) {
				library.createIdentity('00000000').then(function(result) {
					if (isSuccess(result)) {
						var createdIdentity = result.data;
						library.identityRestoreAccess(result.data, data.emailOrMobileNumber).then(function(result) {
							if (isSuccess(result)) {
								vex.dialog.open({
									message: _('PIN Code'),
									input: '<p>' + _('Check your email') + '</p><input name="pincode" type="text" value="" required />',
									callback: function(data) {
										console.log(data.pincode);
										if (data.pincode) {
											if (library) {
												library.login(createdIdentity, 'sms', data.pincode).then(function(result) {
													if (isSuccess(result)) {
														vereignRestoreIdentity();
													}
												});
											}
										}
									}
								});
							}
						});
					}
				});
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

function vereignSign() {
	if (library == null) {
		return;
	}
	if (currentPassport == null) {
		return;
	}
	library.getOneTimeCertificateByPassport(currentPassport.uuid).then(function(result) {
		if (isSuccess(result)) {
			var otp = result.data;
			var blob = new Blob(['signdocument\n', JSON.stringify(otp)]);
			_map._socket.sendMessage(blob);
			awaitForDocumentStatusToUpload = true;
			checkCurrentDocument();
		}
	});
}

function vereignUploadForType(uploadDocType) {
	var vereignWopiUrl = getVereignWopiURL();
	if (vereignWopiUrl == null || vereignWopiUrl == '')
		return;

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
					wopiUrl: vereignWopiUrl + 'files/',
					token: resultArray[i].AccessToken,
					type: documentType
				};
				var blob = new Blob(['uploadsigneddocument\n', JSON.stringify(jsonRequest)]);
				_map._socket.sendMessage(blob);
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

function vereignUploadDialog() {
	if (library == null) {
		return;
	}

	vex.dialog.open({
		message: _('Select document type to upload'),
		input: _('Type:') + '<select name="selection"><option value="ODT">ODT</option><option value="DOCX">DOCX</option><option value="PDF">PDF</option></select>',
		callback: function(data) {
			vereignUploadForType(data.selection);
		}
	});
}

L.Map.include({
	showSignDocument: function() {
		$('#document-signing-bar').show();
		this.initializeLibrary();
		oldtoolbarSize = $('#document-container').css('top');

		$('#document-container').css('top', '110px');

		// Avoid scroll button ">>"
		var el = w2ui['document-signing-bar'];
		if (el)
			el.resize();
	},
	hideSignDocument: function() {
		$('#document-signing-bar').hide();
		library = null;
		identity = null;
		currentPassport = null;
		$('#document-container').css('top', oldtoolbarSize);
	},
	signingInitializeBar: function() {
		$('#document-signing-bar').hide();
		adjustUIState();
	},
	signAndUploadDocument: function() {
		vereignSign();
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
				contentCSS: { width: w + 'px' },
				buttons: {},
				afterOpen: function($vexContent) {
					$('#select-identity').text(_('Select identity:'));
					$('#login-qr').text(_('Login from mobile'));
					$('#recover-from-email').text(_('Recover from email'));
					library.listIdentities().then(function(response) {
						var identities = response.data;
						var identitiesDiv = $vexContent.find('#identites');
						for (var key in identities) {
							var button = $('<input class="identity-button" type="button"/>');
							button.attr('value', identities[key].initials);
							button.css('background-color', identities[key].identityColor);
							button.click({ key: key }, function(current) {
								selectedIdentityKey = current.data.key;
								vex.close($vexContent.data().vex.id);
							});
							identitiesDiv.append(button);
						}
					});
					$('#login-qr').click(function() {
						loginWithQR = true;
						vex.close($vexContent.data().vex.id);
					});
					$('#recover-from-email').click(function() {
						recoverFromEmail = true;
						vex.close($vexContent.data().vex.id);
					});
				},
				afterClose: function () {
					if (loginWithQR) {
						verignQrDialog();
					}
					else if (recoverFromEmail) {
						vereignRecoverFromEmail();
					}
					else if (selectedIdentityKey) {
						vereignPinCodeDialog(selectedIdentityKey);
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
						console.log('event ActionConfirmedAndExecuted');
						break;
					case 'IdentityNotLoaded':
						vereignPinCodeDialog(event.payloads[0]);
						break;
					case 'Authenticated':
						console.log('event Authenticated');
						vereignRestoreIdentity();
						break;
					case 'Logout':
						console.log('event Logout');
						_map.signingLogout();
						break;
					case 'QRCodeUpdated':
						console.log('event QRCodeUpdated');
						break;
					default:
						console.log('UNKNOWN EVENT: ' + event.type);
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
				console.log(result); // TODO
			});
			adjustUIState();
		}
	},
	handleSigningClickEvent: function(id, item) {
		if (id === 'close-document-signing-bar') {
			this.hideSignDocument();
		}
		else if (id === 'login') {
			this.signingLogin();
		}
		else if (id === 'logout') {
			this.signingLogout();
		}
		else if (id === 'sign-upload') {
			this.signAndUploadDocument();
		}
		else if (id.startsWith('passport:')) {
			this.setCurrentPassport(item.value, item.text);
		}
		return false;
	},
	onChangeSignStatus: function(signstatus) {
		var statusText = '';
		// This is meant to be in sync with core.git
		// include/sfx2/signaturestate.hxx, SignatureState.
		switch (signstatus) {
		case '0':
			currentDocumentSigningStatus = _('Not Signed');
			break;
		case '1':
			statusText = _('This document is digitally signed and the signature is valid.');
			currentDocumentSigningStatus = _('Signed and validated');
			break;
		case '2':
			statusText = _('This document has an invalid signature.');
			currentDocumentSigningStatus = _('Signature broken');
			break;
		case '3':
			statusText = _('The signature was valid, but the document has been modified');
			currentDocumentSigningStatus = _('Signed but document modified');
			break;
		case '4':
			statusText = _('The signature is OK, but the certificate could not be validated.');
			currentDocumentSigningStatus = _('Signed but not validated');
			break;
		case '5':
			statusText = _('The signature is OK, but the document is only partially signed');
			currentDocumentSigningStatus = _('Signed but not all files are signed');
			break;
		}

		if (statusText) {
			this.fire('infobar', {
				msg: statusText,
				action: null,
				actionLabel: null
			});
		}

		adjustUIState();

		if (awaitForDocumentStatusToUpload) {
			awaitForDocumentStatusToUpload = false;
			vereignUploadDialog();
		}
		awaitForDocumentStatusToUpload = false;
	}
});
