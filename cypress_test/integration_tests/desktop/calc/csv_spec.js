/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('csv dialog tests', function() {
	var testFileName = 'csv.csv';

	function acceptTextImport() {
		cy.get('#TextImportCsvDialog.jsdialog')
			.should('exist');
		cy.get('#TextImportCsvDialog.jsdialog #ok')
			.click();
		// for some reason cypress does not click properly on the first attempt
		cy.get('#TextImportCsvDialog.jsdialog #ok')
			.then(function($btn) {
				$btn.click();
			});
	}

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc', undefined, undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Text Import Dialog appears before loading the document.', function() {
		cy.get('#TextImportCsvDialog.jsdialog')
			.should('exist');
		cy.get('#comma.jsdialog input')
			.then(function($checkbox) {
				if ($checkbox.css('background-image').indexOf('on')) {
					cy.get('#comma.jsdialog')
						.click();
					cy.get('#comma.jsdialog input')
						.should('have.css', 'background-image')
						.and('include', 'images/checkbox-off');
				}
				else {
					cy.get('#comma.jsdialog')
						.click();
					cy.get('#comma.jsdialog input')
						.should('have.css', 'background-image')
						.and('include', 'images/checkbox-on');
				}
			});
		acceptTextImport();
	});

});
