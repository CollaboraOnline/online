/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe('PDF View Tests', function() {
	var origTestFileName = 'pdf_page_up_down.pdf';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'draw');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it.skip('PDF page down', { env: { 'pdf-view': true } }, function() {
		cy.get('#map').type('{pagedown}');
		cy.get('#preview-frame-part-1').should('have.attr', 'style', 'border: 2px solid darkgrey;');

		cy.get('#map').type('{pageup}');
		cy.get('#preview-frame-part-0').should('have.attr', 'style', 'border: 2px solid darkgrey;');
	});

	it('PDF insert comment', { env: { 'pdf-view': true } }, function() {

		// Insert some comment into the PDF.
		desktopHelper.insertMultipleComment('draw', 1, false);
		cy.get('.cool-annotation-content-wrapper').should('exist');
		cy.get('#annotation-content-area-1').should('contain','some text0');

		// Reload to close and save. PDFs cannot really be edited,
		// only comments can be inserted, so they are not saved
		// directly, rather save-as is used. This failed because
		// DocBroker expected to get ModifiedStatus=false, which
		// never happens with save-as and so we couldn't unload.
		helper.reload(testFileName, 'draw', true);
	});
});
