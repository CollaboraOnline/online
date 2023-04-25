/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'PDF View Tests', function() {
	var origTestFileName = 'pdf_page_up_down.pdf';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'draw');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('PDF page down', { env: { 'pdf-view': true } }, function() {
		cy.cGet('#map').type('{pagedown}'); // Not sure if first button press should change the page.
		cy.cGet('#map').type('{pagedown}');
		cy.cGet('#preview-frame-part-1').should('have.attr', 'style', 'border: 2px solid darkgrey;');
		cy.cGet('#map').type('{pageup}');
		cy.cGet('#map').type('{pageup}');
		cy.cGet('#preview-frame-part-0').should('have.attr', 'style', 'border: 2px solid darkgrey;');
	});

	it('PDF insert comment', { env: { 'pdf-view': true }, defaultCommandTimeout: 60000 }, function() {

		// Insert some comment into the PDF.
		desktopHelper.insertMultipleComment('draw', 1, false);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');

		// Reload to close and save. PDFs cannot really be edited,
		// only comments can be inserted, so they are not saved
		// directly, rather save-as is used. This failed because
		// DocBroker expected to get ModifiedStatus=false, which
		// never happens with save-as and so we couldn't unload.
		helper.reload(testFileName, 'draw', true);
	});
});
