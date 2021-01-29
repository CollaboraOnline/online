/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Calc sidebar dialog image caching', function() {
	var testFileName = 'many-sizes.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		// Wait until the Formula-Bar is loaded.
		cy.get('.inputbar_container', {timeout : 10000});
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Sidebar image caching', function() {

		// Just go through the cells A1:30. Each cell has a
		// different font size. This will exercise the caching
		// of the tunnelled dialog images for the siderbar.
		// Each cell has a different font size so no image
		// will be found in the cache.
		// The document has the cell cursor at A1 after load.

		for (var i = 0; i < 30; i++) {
			helper.typeIntoDocument('{enter}');
			// The non-interactive Cypress test runs very fast, so to
			// be sure that the sidebar actually has time to be rendered
			// and sent to the client sleep a bit between switching cells.
			cy.wait(500);
		}

		// Then go up again. Now we should find stuff in the cache.
		for (i = 0; i < 30; i++) {
			helper.typeIntoDocument('{upArrow}');
			cy.wait(500);
		}
	});
});
