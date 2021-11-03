/* global describe it cy require afterEach expect beforeEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Changing slide properties.', function() {
	var testFileName = 'slide_properties.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		previewShouldBeFullWhite();

		mobileHelper.openMobileWizard();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function previewShouldBeFullWhite(fullWhite = true, slideNumber = 1) {
		var selector = '.preview-frame:nth-of-type(' + (slideNumber + 1).toString() + ') img';
		if (fullWhite)
			helper.imageShouldBeFullWhite(selector);
		else
			helper.imageShouldNotBeFullWhite(selector);
	}

	function switchToMasterView() {
		helper.clickOnIdle('#masterslidebutton');

		cy.get('#closemasterslide')
			.should('exist');

		previewShouldBeFullWhite(false);
	}

	it.skip('Apply solid color background.', function() {
		// Change fill style
		mobileHelper.selectListBoxItem2('#fillstyle', 'Color');

		// Check the default color
		cy.get('#fillattr .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(114, 159, 207);');

		// Change the color
		helper.clickOnIdle('#fillattr');

		mobileHelper.selectFromColorPalette(0, 5);

		cy.get('#fillattr .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(0, 255, 0);');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Color');

		cy.get('#fillattr .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(0, 255, 0);');
	});

	it.skip('Apply gradient fill.', function() {
		// Change fill style
		mobileHelper.selectListBoxItem2('#fillstyle', 'Gradient');

		// Check the default color
		cy.get('#fillattr2 .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(221, 232, 203);');

		cy.get('#fillattr3 .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 215, 215);');

		// Change the colors
		helper.clickOnIdle('#fillattr2');

		mobileHelper.selectFromColorPalette(0, 2);

		helper.clickOnIdle('#fillattr3');

		mobileHelper.selectFromColorPalette(1, 4);

		cy.get('#fillattr2 .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 0, 0);');

		cy.get('#fillattr3 .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 255, 0);');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Gradient');

		cy.get('#fillattr2 .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 0, 0);');

		cy.get('#fillattr3 .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 255, 0);');
	});

	it.skip('Apply hatching fill.', function() {
		// Change fill style
		mobileHelper.selectListBoxItem2('#fillstyle', 'Hatching');

		// Check the default value
		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Black 0 Degrees');

		// Change the hatching
		mobileHelper.selectListBoxItem2('#fillattr1', 'Blue Triple 90 Degrees');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Hatching');

		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Blue Triple 90 Degrees');
	});

	it.skip('Apply bitmap fill.', function() {
		// Change fill style
		mobileHelper.selectListBoxItem2('#fillstyle', 'Bitmap');

		// Check the default value
		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Painted White');

		// Change the value
		mobileHelper.selectListBoxItem2('#fillattr1', 'Wooden Board');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Bitmap');

		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Wooden Board');
	});

	it.skip('Apply pattern fill.', function() {
		// Change fill style
		mobileHelper.selectListBoxItem2('#fillstyle', 'Pattern');

		// Check the default value
		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', '5 Percent');

		// Change the value
		mobileHelper.selectListBoxItem2('#fillattr1', '50 Percent');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Pattern');

		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', '50 Percent');
	});

	it('Remove slide fill.', function() {
		// Apply color fill first
		mobileHelper.selectListBoxItem2('#fillstyle', 'Color');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Color');

		// Remove fill
		mobileHelper.selectListBoxItem2('#fillstyle', 'None');

		previewShouldBeFullWhite();

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'None');
	});

	it('Change master background.', function() {
		// The default master slide does not have background
		// So switch to a different master slide first
		mobileHelper.selectListBoxItem2('#masterslide', 'Colored');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and change the setting
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		// Randomly fails
		//cy.get('input#displaymasterbackground')
		//	.should('have.prop', 'checked', true);

		helper.clickOnIdle('input#displaymasterbackground');

		cy.get('input#displaymasterbackground')
			.should('not.have.prop', 'checked', true);

		previewShouldBeFullWhite();
	});

	it('Change master objects visibility.', function() {
		previewShouldBeFullWhite();

		// Master objects are disabled, enable the settings first
		cy.get('input#displaymasterobjects')
			.should('not.have.prop', 'checked', true);

		helper.clickOnIdle('input#displaymasterobjects');

		cy.get('input#displaymasterobjects')
			.should('have.prop', 'checked', true);

		// We have an image which changes the preview
		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and change the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		// Randomly fails
		//cy.get('input#displaymasterobjects')
		//	.should('have.prop', 'checked', true);

		helper.clickOnIdle('input#displaymasterobjects');

		cy.get('input#displaymasterobjects')
			.should('not.have.prop', 'checked', true);

		previewShouldBeFullWhite();
	});

	it('Change paper format.', function() {
		var EPS = 0.1;

		cy.get('#paperformat .ui-header-left')
			.should('have.text', 'Screen 16:9');

		// Preview should have the correct ratio
		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				var sizeRatio = previews[0].width / previews[0].height;
				expect(sizeRatio).to.be.greaterThan(16 / 9 - EPS);
				expect(sizeRatio).to.be.lessThan(16 / 9 + EPS);
			});

		mobileHelper.selectListBoxItem2('#paperformat', 'Screen 4:3');

		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				var sizeRatio = previews[0].width / previews[0].height;
				expect(sizeRatio).to.be.greaterThan(4 / 3 - EPS);
				expect(sizeRatio).to.be.lessThan(4 / 3 + EPS);
			});

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#paperformat .ui-header-left')
			.should('have.text', 'Screen 4:3');
	});

	it('Change slide orientation.', function() {
		// Preview should have the correct ratio (16/9)
		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				expect(previews[0].width).to.be.greaterThan(previews[0].height);
			});

		cy.get('#orientation .ui-header-left')
			.should('have.text', 'Landscape');

		mobileHelper.selectListBoxItem2('#orientation', 'Portrait');

		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				expect(previews[0].width).to.be.lessThan(previews[0].height);
			});

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		// Randomly fails
		//cy.get('#orientation .ui-header-left')
		//	.should('have.text', 'Portrait');
	});

	it('Apply master slide layout.', function() {
		// We have white background by deafult checked by before() method
		// Select a new master slide with a background color
		cy.get('#masterslide .ui-header-left')
			.should('have.text', 'Default');

		mobileHelper.selectListBoxItem2('#masterslide', 'Colored');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#masterslide .ui-header-left')
			.should('have.text', 'Colored');
	});

	it.skip('Apply layout.', function() {
		// Apply title / subtitle layout
		helper.clickOnIdle('#Layouts');

		// Blank is the default
		// TODO: wring item is selected by default
		//cy.get('.layout:nth-of-type(1)')
		//	.should('have.class', 'cool-context-down');

		// Select layout with title and content shape
		helper.clickOnIdle('.layout:nth-of-type(3)');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#Layouts');

		cy.get('.layout:nth-of-type(3)')
			.should('have.class', 'cool-context-down');
	});

	it('Change paper format in master view.', function() {
		var EPS = 0.1;

		switchToMasterView();

		cy.get('#paperformat .ui-header-left')
			.should('have.text', 'Screen 16:9');

		// Preview should have the correct ratio
		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				var sizeRatio = previews[0].width / previews[0].height;
				expect(sizeRatio).to.be.greaterThan(16 / 9 - EPS);
				expect(sizeRatio).to.be.lessThan(16 / 9 + EPS);
			});

		mobileHelper.selectListBoxItem2('#paperformat', 'Screen 4:3');

		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				var sizeRatio = previews[0].width / previews[0].height;
				expect(sizeRatio).to.be.greaterThan(4 / 3 - EPS);
				expect(sizeRatio).to.be.lessThan(4 / 3 + EPS);
			});

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#paperformat .ui-header-left')
			.should('have.text', 'Screen 4:3');
	});

	it('Change orientation in master view.', function() {
		switchToMasterView();

		// Preview should have the correct ratio (16/9)
		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				expect(previews[0].width).to.be.greaterThan(previews[0].height);
			});

		cy.get('#orientation .ui-header-left')
			.should('have.text', 'Landscape');

		mobileHelper.selectListBoxItem2('#orientation', 'Portrait');

		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				expect(previews[0].width).to.be.lessThan(previews[0].height);
			});

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		//cy.get('#orientation .ui-header-left')
		//	.should('have.text', 'Portrait');
	});

	it('Check disabled elements in master view.', function() {
		switchToMasterView();

		cy.get('#masterslide')
			.should('not.exist');

		cy.get('#displaymasterbackground label')
			.should('have.class', 'disabled');

		cy.get('#displaymasterobjects label')
			.should('have.class', 'disabled');

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#closemasterslide')
			.should('exist');

		cy.get('#masterslide')
			.should('not.exist');

		cy.get('#displaymasterbackground label')
			.should('have.class', 'disabled');

		cy.get('#displaymasterobjects label')
			.should('have.class', 'disabled');

		// Switch back to normal mode
		helper.clickOnIdle('#closemasterslide');

		cy.get('#masterslidebutton')
			.should('exist');

		previewShouldBeFullWhite();

		cy.get('#masterslide')
			.should('exist');

		cy.get('#displaymasterbackground label')
			.should('not.have.class', 'disabled');

		cy.get('#displaymasterobjects label')
			.should('not.have.class', 'disabled');
	});
});
