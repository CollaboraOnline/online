/* global describe it cy require afterEach Cypress */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var nextcloudHelper = require('../../common/nextcloud_helper');
var writerMobileHelper = require('./writer_mobile_helper');

describe('Nextcloud specific tests.', function() {
	var testFileName = 'nextcloud.odt';

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Insert image from storage.', function() {
		helper.loadFileToNextCloud('image_to_insert.png', 'writer');

		helper.beforeAll(testFileName, 'writer', undefined, true);

		mobileHelper.enableEditingMobile();

		nextcloudHelper.insertImageFromStorage('image_to_insert.png');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g.Graphic')
			.should('exist');
	});

	it('Save as.', function() {
		helper.beforeAll(testFileName, 'writer');

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
		helper.beforeAll(testFileName, 'writer');

		mobileHelper.enableEditingMobile();

		nextcloudHelper.checkAndCloseSharing();
	});

	it.skip('Revision history.', function() {
		helper.beforeAll(testFileName, 'writer');

		mobileHelper.enableEditingMobile();

		nextcloudHelper.checkAndCloseRevisionHistory();
	});

	it.skip('Restore previous revision.', function() {
		helper.beforeAll(testFileName, 'writer');

		mobileHelper.enableEditingMobile();

		// Initially we have "text" text in the document
		writerMobileHelper.selectAllMobile();

		helper.expectTextForClipboard('text');

		// Change the document content and save it
		helper.typeIntoDocument('new');

		writerMobileHelper.selectAllMobile();

		helper.expectTextForClipboard('new');

		mobileHelper.selectHamburgerMenuItem(['File', 'Save']);

		nextcloudHelper.restorePreviousVersion();

		mobileHelper.enableEditingMobile();

		writerMobileHelper.selectAllMobile();

		helper.expectTextForClipboard('text');
	});
});

