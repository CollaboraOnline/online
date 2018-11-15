/* -*- js-indent-level: 8 -*- */
/*
 * Document Signing
 */

/* global window setupViamAPI w2ui */

var library = null;
var identity = null;
var currentPassport = null;

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
		}
		else {
			w2ui['document-signing-bar'].show('passport');
			w2ui['document-signing-bar'].hide('current-passport');
			w2ui['document-signing-bar'].hide('sign');
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
		w2ui['document-signing-bar'].hide('passport');
		w2ui['document-signing-bar'].hide('current-passport');
	}
	w2ui['document-signing-bar'].refresh();
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
	},
	initializeLibrary: function() {
		setupViamAPI(
			'signdocument-iframe-content',
			{
				onEvent: function(event) {
					switch (event.type) {
					case 'Authenticated':
						library.getCurrentlyAuthenticatedIdentity().then(function(result) {
							if (isSuccess(result)) {
								identity = result.data;
								updateIndentity();
								updatePassportList();
								adjustUIState();
							}
						});
						break;
					default:
						console.log('UNKNOWN EVENT: ' + event.type);
						break;
					}
				}
			},
			'https://integration1.vereign.com/api/js/iframe'
		).then(function(lib)
		{
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
