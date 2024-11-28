/* global describe it cy require */

var helper = require('../../common/helper');

describe(['tagdesktop'], 'Electronic sign operations.', function() {

	it('Create an electronic signature.', { env: { 'pdf-view': true } }, function() {
		// Given a document that can be signed:
		helper.setupAndLoadDocument('draw/esign.pdf', /*isMultiUser=*/false, /*copyCertificates=*/true);

		cy.intercept('POST', 'https://test.eideasy.com/api/signatures/prepare-files-for-signing',
			{fixture : 'fixtures/eideasy-send-hash.json'}).as('sendHash');
		cy.getFrameWindow()
			.then(function(win) {
				cy.stub(win, 'open').as('windowOpen');
			});
		cy.intercept('POST', 'https://test.eideasy.com/api/signatures/download-signed-file',
			{fixture : 'fixtures/eideasy-get-signature.json'}).as('getSignature');

		// When signing that document:
		cy.cGet('#menu-insert').click();
		cy.cGet('#menu-insert-esignature').click();
		cy.wait(['@sendHash']);
		cy.get('@windowOpen').should('be.called');
		const response = {
			type: "SUCCESS",
		};
		cy.window().then(win => {
			const app = win['0'].app;
			const eSignature = app.map.eSignature;
			eSignature.handleSigned(response);
		});
		cy.wait(['@getSignature']);

		// Then make sure the document now has a (test / "not OK") signature:
		cy.cGet('#signstatus-button div').should('have.class', 'sign_not_ok');
	});
});
