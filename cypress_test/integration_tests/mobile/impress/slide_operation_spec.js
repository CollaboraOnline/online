/* global describe it cy require afterEach beforeEach*/

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Slide operations', function() {
	var origTestFileName = 'slide_operations.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Add slides', function() {
		cy.get('.leaflet-control-zoom-in')
			.click();

		impressHelper.assertNumberOfSlidePreviews(2);
	});

	it('Remove Slides', function() {
		//add slides
		cy.get('.leaflet-control-zoom-in')
			.click();

		impressHelper.assertNumberOfSlidePreviews(2);

		//remove slides
		mobileHelper.openHamburgerMenu();

		cy.get('.menu-entry-icon.slidemenu').parent()
			.click();

		cy.get('.menu-entry-icon.deletepage').parent()
			.click();

		cy.get('#deleteslide-modal-response').click();

		impressHelper.assertNumberOfSlidePreviews(1);
	});

	it('Duplicate Slide', function() {
		mobileHelper.openHamburgerMenu();

		cy.get('.menu-entry-icon.slidemenu').parent()
			.click();

		cy.get('.menu-entry-icon.duplicatepage').parent()
			.click();

		impressHelper.assertNumberOfSlidePreviews(2);
	});

});
