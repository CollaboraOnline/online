/* global describe it cy require afterEach Cypress */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var nextcloudHelper = require('../../common/nextcloud_helper');

describe(['tagnextcloud'], 'Nextcloud specific tests.', function() {
	var origTestFileName = 'nextcloud.odp';
	var testFileName;

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert image from storage.', function() {
		helper.upLoadFileToNextCloud('image_to_insert.png', 'impress');
		testFileName = helper.beforeAll(origTestFileName, 'impress', undefined, true);
		mobileHelper.enableEditingMobile();
		nextcloudHelper.insertImageFromStorage('image_to_insert.png');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');
	});

	it('Save as.', function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		nextcloudHelper.saveFileAs('1' + testFileName);
		// Close the document
		cy.cGet('#mobile-edit-button').should('be.visible');
		cy.cGet('#toolbar-mobile-back').then(function(item) {
				cy.wrap(item)
					.click();
				Cypress.env('IFRAME_LEVEL', '');
			});

		cy.cGet('tr[data-file=\'1' + testFileName + '\']').should('be.visible');
		cy.cGet('tr[data-file=\'' + testFileName + '\']').should('be.visible');
	});

	it('Share.', function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		mobileHelper.enableEditingMobile();
		nextcloudHelper.checkAndCloseSharing();
	});
});

