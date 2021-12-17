/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');

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
});
