/* -*- js-indent-level: 8 -*- */
/*
 * Document Signing
 */

/* global window setupViamAPI w2ui */

var library = null;
var identity = null;

function isSuccess(result) {
	return result.code == '200';
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

function adjustUIState() {
	if (library && identity) {
		w2ui['document-signing-bar'].hide('login');
		w2ui['document-signing-bar'].show('logout');
		w2ui['document-signing-bar'].show('identity-label');
		w2ui['document-signing-bar'].show('identity');
		w2ui['document-signing-bar'].show('sign');
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
			library.getCurrentlyLoggedInUUID().then(function(result) {
				if (isSuccess(result)) {
					var UUID = result.data;
					library.getOneTimeCertificateByPassport(UUID).then(function(result) {
						if (isSuccess(result)) {
							var otp = result.data;
							var blob = new Blob(['signdocument\n', JSON.stringify(otp)]);
							map._socket.sendMessage(blob);
						}
					});
				}
			});
		}
	},
	signingLogout: function() {
		if (library) {
			library.logout().then(function(result) {
				if (isSuccess(result)) {
					identity = null;
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
			'https://dev.vereign.com/api/js/iframe'
		).then(function(lib)
		{
			library = lib;
			adjustUIState();
		});
	}
});
