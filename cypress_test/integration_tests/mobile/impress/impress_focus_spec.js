/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagproxy'], 'Impress focus tests', function() {
	var origTestFileName = 'focus.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Select text box, no editing', function() {

		mobileHelper.enableEditingMobile();

		impressHelper.assertNotInTextEditMode();

		// Body has the focus -> can't type in the document
		helper.assertFocus('tagName', 'BODY');

		// One tap on a text shape, on the whitespace area,
		// does not start editing.
		cy.cGet('#document-container')
			.then(function(items) {
				expect(items).have.length(1);

				// Click in the left-bottom corner where there is no text.
				let posX = items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().width / 4;
				let posY = items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().height / 2;
				cy.log('Got left-bottom quantile at (' + posX + ', ' + posY + ')');

				cy.cGet('#document-container').click(posX, posY);
			});

		// No focus
		helper.assertFocus('tagName', 'BODY');

		cy.wait(1000);

		// Shape selection.
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');

		// But no editing.
		impressHelper.assertNotInTextEditMode();
	});

	it('Double-click to edit', function() {

		mobileHelper.enableEditingMobile();

		impressHelper.assertNotInTextEditMode();

		// Enter edit mode by double-clicking.
		cy.cGet('#document-container').dblclick();

		cy.wait(1000);

		impressHelper.typeTextAndVerify('Hello Impress');

		// End editing.
		helper.typeIntoDocument('{esc}');

		impressHelper.assertNotInTextEditMode();

		// Enter edit mode by double-clicking again.
		cy.cGet('#document-container').dblclick();

		// Clear the text.
		helper.clearAllText();

		impressHelper.typeTextAndVerify('Bazinga Impress');
	});

	it.skip('Single-click to edit', function() {

		mobileHelper.enableEditingMobile();

		impressHelper.assertNotInTextEditMode();

		cy.cGet('#document-container')
			.then(function(items) {
				expect(items).have.length(1);

				// Click in the top left corner where there is no text.
				let posX = items[0].getBoundingClientRect().width / 2;
				let posY = items[0].getBoundingClientRect().height * (9 / 16);
				cy.log('Got center coordinates at (' + posX + ', ' + posY + ')');

				// Start editing; click on the text.
				cy.cGet('#document-container').click(posX, posY);

				impressHelper.typeTextAndVerify('Hello Impress');

				// End editing.
				helper.typeIntoDocument('{esc}');

				impressHelper.assertNotInTextEditMode();

				// Single-click to re-edit.
				cy.cGet('#document-container')
					.then(function(items) {
						expect(items).have.length(1);

						cy.cGet('#document-container').click(posX, posY);

						impressHelper.assertInTextEditMode();

						// Clear the text.
						helper.clearAllText();

						impressHelper.typeTextAndVerify('Bazinga Impress');

						// End editing.
						helper.typeIntoDocument('{esc}');

						impressHelper.assertNotInTextEditMode();
					});
			});
	});
});
