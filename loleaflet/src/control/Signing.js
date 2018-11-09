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
				var color = result.data.identityColor;
				console.log(initials + ' ' + color);
				w2ui['document-signing-bar'].get('user').html = '<p>' + initials + '</p>';
				w2ui['document-signing-bar'].refresh();
			});
		}
		else {
			w2ui['document-signing-bar'].get('user').html = '';
			w2ui['document-signing-bar'].refresh();
		}
	}
}

L.Map.include({
	showSignDocument: function() {
		this.signingLogin();
	},
	signingLogout: function() {
		if (library) {
			library.logout().then(function(result) {
				if (isSuccess(result)) {
					identity = null;
					updateIndentity();
				}
			});
		}
	},
	signingLogin: function() {
		setupViamAPI(
			'signdocument-iframe-content',
			{
				onEvent: function(event) {
					switch (event.type) {
					case 'Authenticated':
						library.getCurrentlyAuthenticatedIdentity().then(function(result) {
							identity = result.data;
							updateIndentity();
						});
						break;
					default:
						alert(event.type);
						break;
					}
				}
			},
			'https://dev.vereign.com/api/js/iframe'
		).then(function(lib)
		{
			library = lib;
		});
	}
});
