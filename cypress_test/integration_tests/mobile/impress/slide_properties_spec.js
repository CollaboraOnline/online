/* global describe it cy require afterEach expect beforeEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Changing slide properties.', function() {
	var origTestFileName = 'slide_properties.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
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
			helper.isImageWhite(selector, true);
		else
			helper.isImageWhite(selector, false);
	}

	function switchToMasterView() {
		helper.clickOnIdle('#masterslidebutton');
		cy.cGet('#closemasterslide').should('exist');
		previewShouldBeFullWhite(false);
	}

	it.skip('Apply solid color background.', function() {
		// Change fill style
		cy.cGet('#fillstyle').click();
		cy.cGet('#fillstyle').contains('Color').click();

		// Check the default color
		cy.cGet('#fillattr .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(114, 159, 207);');

		// Change the color
		helper.clickOnIdle('#fillattr');

		mobileHelper.selectFromColorPalette(0, 5);

		cy.cGet('#fillattr .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(0, 255, 0);');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#fillstyle .ui-header-left').should('have.text', 'Color');
		cy.cGet('#fillattr .color-sample-selected').should('have.attr', 'style', 'background-color: rgb(0, 255, 0);');
	});

	it.skip('Apply gradient fill.', function() {
		// Change fill style
		cy.cGet('#fillstyle').click();
		cy.cGet('#fillstyle').contains('Gradient').click();

		// Check the default color
		cy.cGet('#fillattr2 .color-sample-selected').should('have.attr', 'style', 'background-color: rgb(221, 232, 203);');
		cy.cGet('#fillattr3 .color-sample-selected').should('have.attr', 'style', 'background-color: rgb(255, 215, 215);');

		// Change the colors
		helper.clickOnIdle('#fillattr2');

		mobileHelper.selectFromColorPalette(0, 2);

		helper.clickOnIdle('#fillattr3');

		mobileHelper.selectFromColorPalette(1, 4);

		cy.cGet('#fillattr2 .color-sample-selected').should('have.attr', 'style', 'background-color: rgb(255, 0, 0);');
		cy.cGet('#fillattr3 .color-sample-selected').should('have.attr', 'style', 'background-color: rgb(255, 255, 0);');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#fillstyle .ui-header-left').should('have.text', 'Gradient');
		cy.cGet('#fillattr2 .color-sample-selected').should('have.attr', 'style', 'background-color: rgb(255, 0, 0);');
		cy.cGet('#fillattr3 .color-sample-selected').should('have.attr', 'style', 'background-color: rgb(255, 255, 0);');
	});

	it.skip('Apply hatching fill.', function() {
		// Change fill style
		cy.cGet('#fillstyle').click();
		cy.cGet('#fillstyle').contains('Hatching').click();

		// Check the default value
		cy.cGet('#fillattr1 .ui-header-left').should('have.text', 'Black 0 Degrees');

		// Change the hatching
		cy.cGet('#fillattr1').click();
		cy.cGet('#fillattr1').contains('Blue Triple 90 Degrees').click();

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#fillstyle .ui-header-left').should('have.text', 'Hatching');
		cy.cGet('#fillattr1 .ui-header-left').should('have.text', 'Blue Triple 90 Degrees');
	});

	it.skip('Apply bitmap fill.', function() {
		// Change fill style
		cy.cGet('#fillstyle').click();
		cy.cGet('#fillstyle').contains('Bitmap').click();

		// Check the default value
		cy.cGet('#fillattr1 .ui-header-left').should('have.text', 'Painted White');

		// Change the value
		cy.cGet('#fillattr1').click();
		cy.cGet('#fillattr1').contains('Wooden Board').click();

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#fillstyle .ui-header-left').should('have.text', 'Bitmap');
		cy.cGet('#fillattr1 .ui-header-left').should('have.text', 'Wooden Board');
	});

	it.skip('Apply pattern fill.', function() {
		// Change fill style
		cy.cGet('#fillstyle').click();
		cy.cGet('#fillstyle').contains('Pattern').click();

		// Check the default value
		cy.cGet('#fillattr1 .ui-header-left').should('have.text', '5 Percent');

		// Change the value
		cy.cGet('#fillattr1').click();
		cy.cGet('#fillattr1').contains('50 Percent').click();

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#fillstyle .ui-header-left').should('have.text', 'Pattern');
		cy.cGet('#fillattr1 .ui-header-left').should('have.text', '50 Percent');
	});

	it('Remove slide fill.', function() {
		// Apply color fill first
		cy.cGet('#fillstyle').click();
		cy.cGet('#fillstyle').contains('Color').click();

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#fillstyle .ui-header-left').should('have.text', 'Color');

		// Remove fill
		cy.cGet('#fillstyle').click();
		cy.cGet('#fillstyle').contains('None').click();

		previewShouldBeFullWhite();

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#fillstyle .ui-header-left').should('have.text', 'None');
	});

	it('Change master background.', function() {
		// The default master slide does not have background
		// So switch to a different master slide first
		cy.cGet('#masterslide').click();
		cy.cGet('#masterslide').contains('Colored').click();

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and change the setting
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		// Randomly fails
		//cy.get('input#displaymasterbackground')
		//	.should('have.prop', 'checked', true);

		helper.clickOnIdle('input#displaymasterbackground');

		cy.cGet('input#displaymasterbackground').should('not.have.prop', 'checked', true);

		previewShouldBeFullWhite();
	});

	it('Change master objects visibility.', function() {
		previewShouldBeFullWhite();

		// Master objects are disabled, enable the settings first
		cy.cGet('input#displaymasterobjects').should('not.have.prop', 'checked', true);

		helper.clickOnIdle('input#displaymasterobjects');

		cy.cGet('input#displaymasterobjects').should('have.prop', 'checked', true);

		// We have an image which changes the preview
		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and change the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		// Randomly fails
		//cy.get('input#displaymasterobjects')
		//	.should('have.prop', 'checked', true);

		helper.clickOnIdle('input#displaymasterobjects');

		cy.cGet('input#displaymasterobjects').should('not.have.prop', 'checked', true);

		previewShouldBeFullWhite();
	});

	it('Change paper format.', function() {
		var EPS = 0.1;

		cy.cGet('#paperformat .ui-header-left').should('have.text', 'Screen 16:9');

		// Preview should have the correct ratio
		cy.cGet('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				var sizeRatio = previews[0].width / previews[0].height;
				expect(sizeRatio).to.be.greaterThan(16 / 9 - EPS);
				expect(sizeRatio).to.be.lessThan(16 / 9 + EPS);
			});


		cy.cGet('#paperformat').click();
		cy.cGet('#paperformat').contains('Screen 4:3').click();

		cy.cGet('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				var sizeRatio = previews[0].width / previews[0].height;
				expect(sizeRatio).to.be.greaterThan(4 / 3 - EPS);
				expect(sizeRatio).to.be.lessThan(4 / 3 + EPS);
			});

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#paperformat .ui-header-left').should('have.text', 'Screen 4:3');
	});

	it('Change slide orientation.', function() {
		// Preview should have the correct ratio (16/9)
		cy.cGet('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				expect(previews[0].width).to.be.greaterThan(previews[0].height);
			});

		cy.cGet('#orientation .ui-header-left').should('have.text', 'Landscape');

		cy.cGet('#orientation').click();
		cy.cGet('#orientation').contains('Portrait').click();

		cy.cGet('.preview-frame:nth-of-type(2) img')
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
		cy.cGet('#masterslide .ui-header-left').should('have.text', 'Default');

		cy.cGet('#masterslide').click();
		cy.cGet('#masterslide').contains('Colored').click();

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#masterslide .ui-header-left').should('have.text', 'Colored');
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

		cy.cGet('.layout:nth-of-type(3)').should('have.class', 'cool-context-down');
	});

	it('Change paper format in master view.', function() {
		var EPS = 0.1;

		switchToMasterView();

		cy.cGet('#paperformat .ui-header-left').should('have.text', 'Screen 16:9');

		// Preview should have the correct ratio
		cy.cGet('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				var sizeRatio = previews[0].width / previews[0].height;
				expect(sizeRatio).to.be.greaterThan(16 / 9 - EPS);
				expect(sizeRatio).to.be.lessThan(16 / 9 + EPS);
			});

		cy.cGet('#paperformat').click();
		cy.cGet('#paperformat').contains('Screen 4:3').click();

		cy.cGet('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				var sizeRatio = previews[0].width / previews[0].height;
				expect(sizeRatio).to.be.greaterThan(4 / 3 - EPS);
				expect(sizeRatio).to.be.lessThan(4 / 3 + EPS);
			});

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#paperformat .ui-header-left').should('have.text', 'Screen 4:3');
	});

	it('Change orientation in master view.', function() {
		switchToMasterView();

		// Preview should have the correct ratio (16/9)
		cy.cGet('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				expect(previews[0].width).to.be.greaterThan(previews[0].height);
			});

		cy.cGet('#orientation .ui-header-left').should('have.text', 'Landscape');

		cy.cGet('#orientation').click();
		cy.cGet('#orientation').contains('Portrait').click();

		cy.cGet('.preview-frame:nth-of-type(2) img')
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

		cy.cGet('#masterslide').should('not.exist');
		cy.cGet('#displaymasterbackground label').should('have.class', 'disabled');
		cy.cGet('#displaymasterobjects label').should('have.class', 'disabled');

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.cGet('#closemasterslide').should('exist');
		cy.cGet('#masterslide').should('not.exist');
		cy.cGet('#displaymasterbackground label').should('have.class', 'disabled');
		cy.cGet('#displaymasterobjects label').should('have.class', 'disabled');

		// Switch back to normal mode
		helper.clickOnIdle('#closemasterslide');

		cy.cGet('#masterslidebutton').should('exist');

		previewShouldBeFullWhite();

		cy.cGet('#masterslide').should('exist');
		cy.cGet('#displaymasterbackground label').should('not.have.class', 'disabled');
		cy.cGet('#displaymasterobjects label').should('not.have.class', 'disabled');
	});
});
