/* global describe it cy require */

var helper = require('../../common/helper');

describe(['tagdesktop'], 'Signature operations.', function() {

	it('Create a visual signature.', { env: { 'pdf-view': true } }, function() {
		// Given a document that can be signed:
		helper.setupAndLoadDocument('draw/sign.pdf', /*isMultiUser=*/false, /*copyCertificates=*/true);

		// When visually signing that document:
		cy.cGet('#menu-insert').click();
		// Insert signature line/shape:
		cy.cGet('#menu-insert-signatureline').click();
		// Click on the only signature, not on the header:
		cy.cGet('#SelectCertificateDialog #signatures .ui-treeview-entry > div:first-child').click();
		cy.cGet('#SelectCertificateDialog button#ok').click();
		// Finish signing:
		cy.cGet('#menu-file').click();
		cy.cGet('#menu-signature').click();

		// Then make sure the resulting signature is valid:
		cy.cGet('#signstatus-button div').should('have.class', 'sign_ok');
	});
});
