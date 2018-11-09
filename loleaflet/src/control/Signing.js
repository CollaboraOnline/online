/* -*- js-indent-level: 8 -*- */
/*
 * Document Signing
 */

/* global window setupViamAPI */

var library = null;

L.Map.include({
	showSignDocument: function() {
		this.signingLogin();
	},
	signingLogout: function() {
		if (library) {
			library.logout();
		}
	},
	signingLogin: function() {
		setupViamAPI(
			'signdocument-iframe-content',
			{
				onEvent: function(event) {
					alert(event.type);
				}
			},
			'https://dev.vereign.com/api/js/iframe'
		).then(function(lib)
		{
			library = lib;
		});
	}
});
