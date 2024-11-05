/* global describe it cy require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Sign operations.', function() {

	it('Create a signature.', function() {
		// Given a document that can be signed:
		helper.setupAndLoadDocument('writer/sign.odt', /*isMultiUser=*/false, /*copyCertificates=*/true);
		desktopHelper.switchUIToNotebookbar();

		// When signing that document:
		cy.cGet('#File-tab-label').click();
		cy.cGet('#signature-button').click();
		// Without the accompanying fix in place, this test would have failed with:
		// This element `<button#sign.ui-pushbutton.jsdialog.hidden>` is not visible because it has CSS property: `display: none`
		cy.cGet('#DigitalSignaturesDialog button#sign').click();
		// Click on the only signature, not on the header:
		cy.cGet('#SelectCertificateDialog #signatures .ui-treeview-entry > div:first-child').click();
		cy.cGet('#SelectCertificateDialog button#ok').click();
		cy.cGet('#DigitalSignaturesDialog button#close').click();

		// Then make sure the resulting signature is valid:
		cy.cGet('#signstatus-button div').should('have.class', 'sign_ok');
	});
});
