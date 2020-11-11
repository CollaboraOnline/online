/* global describe it cy require afterEach Cypress */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('../../common/calc_helper');
var nextcloudHelper = require('../../common/nextcloud_helper');

describe('Nextcloud specific tests.', function() {
	var testFileName = 'nextcloud.ods';

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Insert image from storage.', function() {
		helper.loadFileToNextCloud('image_to_insert.png', 'calc');

		helper.beforeAll(testFileName, 'calc', undefined, true);

		mobileHelper.enableEditingMobile();

		nextcloudHelper.insertImageFromStorage('image_to_insert.png');

		// TOD
		//cy.get('.leaflet-pane.leaflet-overlay-pane svg g.Graphic')
		//	.should('exist');
	});

	it('Save as.', function() {
		helper.beforeAll(testFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		nextcloudHelper.saveFileAs('1' + testFileName);

		// Close the document
		cy.get('#mobile-edit-button')
			.should('be.visible');

		cy.get('#tb_actionbar_item_closemobile')
			.then(function(item) {
				cy.wrap(item)
					.click();
				Cypress.env('IFRAME_LEVEL', '');
			});

		cy.get('tr[data-file=\'1' + testFileName + '\']')
			.should('be.visible');

		cy.get('tr[data-file=\'' + testFileName + '\']')
			.should('be.visible');
	});

	it('Share.', function() {
		helper.beforeAll(testFileName, 'calc');

		mobileHelper.enableEditingMobile();

		nextcloudHelper.checkAndCloseSharing();
	});

	it.skip('Revision history.', function() {
		helper.beforeAll(testFileName, 'calc');

		mobileHelper.enableEditingMobile();

		nextcloudHelper.checkAndCloseRevisionHistory();
	});

	it.skip('Restore previous revision.', function() {
		helper.beforeAll(testFileName, 'calc');

		mobileHelper.enableEditingMobile();

		// Initially we have "text" text in the document
		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.text', 'Text');

		// Change the document content and save it
		calcHelper.clickOnFirstCell(false, true);

		helper.selectAllText();

		helper.typeIntoDocument('new');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.text', 'new');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		nextcloudHelper.restorePreviousVersion();

		mobileHelper.enableEditingMobile();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.text', 'Text');
	});
});

