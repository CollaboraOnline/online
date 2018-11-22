/* -*- js-indent-level: 8 -*- */
/*
 * Document Signing
 */

/* global window setupViamAPI w2ui vex $ */

var library = null;
var identity = null;
var currentPassport = null;

var vereignURL = 'https://integration2.vereign.com';

function isSuccess(result) {
	return result.code == '200';
}

function haveIdentity() {
	return identity != null;
}

function updateIndentity() {
	if (library) {
		if (identity) {
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
}

function updatePassportList() {
	if (library) {
		library.passportListPassports().then(function(result) {
			if (isSuccess(result))
			{
				w2ui['document-signing-bar'].get('passport').items = [];
				var passports = result.data;
				for (var i = 0; i < passports.length; i++) {
					addPassportToToolbar(passports[i], i);
				}
				updateCurrentPassport();
				adjustUIState();
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
	if (library && identity) {
		w2ui['document-signing-bar'].hide('login');
		w2ui['document-signing-bar'].show('logout');
		w2ui['document-signing-bar'].show('identity-label');
		w2ui['document-signing-bar'].show('identity');
		if (currentPassport) {
			w2ui['document-signing-bar'].show('passport');
			w2ui['document-signing-bar'].show('current-passport');
			w2ui['document-signing-bar'].show('sign');
			w2ui['document-signing-bar'].show('upload');
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
	w2ui['document-signing-bar'].refresh();
}

function vereignPinCodeDialog(selectedIdentityKey) {
	vex.dialog.open({
		message: 'PIN Code',
		input: '<input name="pincode" type="text" value="" required />',
		callback: function(data) {
			console.log(data.pincode);
			if (data.pincode) {
				if (library) {
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
		}
	});
}

function vereignLogin() {
	if (library && identity) {
		library.login(identity, 'previousaddeddevice').then(function(result) {
			console.log(result);
			if (isSuccess(result)) {
				updateIndentity();
				updatePassportList();
				adjustUIState();
			}
		});
	}
}

function verignQrDialog() {
	if (library) {
		library.createIdentity('00000000').then(function(result) {
			if (isSuccess(result)) {
				library.login(result.data, 'newdevice').then(function(result) {
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
						},
					});
				});
			}
		});
	}
}

function vereignRecoverFromEmail() {
	if (library == null) {
		return;
	}
	vex.dialog.open({
		message: 'Login from email or mobile number',
		input: '<input name="emailOrMobileNumber" type="text" value="" required />',
		callback: function(data) {
			if (data.emailOrMobileNumber) {
				library.createIdentity('00000000').then(function(result) {
					if (isSuccess(result)) {
						var createdIdentity = result.data;
						library.identityRestoreAccess(result.data, data.emailOrMobileNumber).then(function(result) {
							if (isSuccess(result)) {
								vex.dialog.open({
									message: 'PIN Code',
									input: '<p>Check your email</p><input name="pincode" type="text" value="" required />',
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
			vex.closeAll();
			identity = result.data;
			updateIndentity();
			updatePassportList();
			adjustUIState();
		}
	});
}

L.Map.include({
	showSignDocument: function() {
		this.initializeLibrary();
	},
	signingInitializeBar: function() {
		adjustUIState();
	},
	signDocument: function() {
		if (library) {
			var map = this;
			if (currentPassport) {
				library.getOneTimeCertificateByPassport(currentPassport.uuid).then(function(result) {
					if (isSuccess(result)) {
						var otp = result.data;
						var blob = new Blob(['signdocument\n', JSON.stringify(otp)]);
						map._socket.sendMessage(blob);
					}
				});
			}
		}
	},
	uploadToVereign: function() {
		if (library == null) {
			return;
		}
		var map = this;
		var filename = 'fileId'; // need to read the filename

		library.getPassports(filename).then(function(result) {
			if (isSuccess(result)) {
				var resultArray = result.data;
				for (var i = 0; i < resultArray.length; i++) {
					if (currentPassport.uuid == resultArray[i].PassportUUID) {
						var jsonRequest = {
							filename: filename,
							wopiUrl: vereignURL + '/wopi/files',
							token: resultArray[i].AccessToken,
							type: 'pdf'
						};
						var blob = new Blob(['uploadsigneddocument\n', JSON.stringify(jsonRequest)]);
						map._socket.sendMessage(blob);
					}
				}
			}
		});
	},
	signingLogout: function() {
		if (library) {
			library.logout().then(function(result) {
				if (isSuccess(result)) {
					identity = null;
					currentPassport = null;
					updateIndentity();
					adjustUIState();
				}
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
		setupViamAPI(
			'signdocument-iframe-content',
			{
				onEvent: function(event) {
					switch (event.type) {
					case 'ActionConfirmedAndExecuted':
						console.log('ActionConfirmedAndExecuted');
						break;
					case 'Authenticated':
						vereignRestoreIdentity();
						break;
					default:
						console.log('UNKNOWN EVENT: ' + event.type);
						break;
					}
				}
			},
			vereignURL + '/api/js/iframe'
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
				console.log(result);
			});
			adjustUIState();
		}
	}
});
