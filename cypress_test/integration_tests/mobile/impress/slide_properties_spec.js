/* global describe it cy require afterEach expect beforeEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Changing slide properties.', function() {
	var testFileName = 'slide_properties.odp';

	beforeEach(function() {
		mobileHelper.beforeAllMobile(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		previewShouldBeFullWhite();

		mobileHelper.openMobileWizard();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	function previewShouldBeFullWhite(fullWhite = true, slideNumber = 1) {
		cy.get('.preview-frame:nth-of-type(' + (slideNumber + 1).toString() + ') img')
			.should(function(preview) {
				var img = preview[0];

				// Create an offscreen canvas to check the preview's pixels
				var canvas = document.createElement('canvas');
				canvas.width = img.width;
				canvas.height = img.height;
				canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
				var context = canvas.getContext('2d');

				// There is a border around the preview, ignore that
				var ignoredPixels = 2;
				var pixelData = context.getImageData(ignoredPixels, ignoredPixels,
					img.width - 2 * ignoredPixels,
					img.height - 2 * ignoredPixels).data;

				var allIsWhite = true;
				for (var i = 0; i < pixelData.length; ++i) {
					allIsWhite = allIsWhite && pixelData[i] == 255;
				}
				if (fullWhite)
					expect(allIsWhite).to.be.true;
				else
					expect(allIsWhite).to.be.false;
			});
	}

	function switchToMasterView() {
		cy.get('#masterslidebutton')
			.click();

		cy.get('#closemasterslide')
			.should('exist');

		previewShouldBeFullWhite(false);
	}

	it('Apply solid color background.', function() {
		// Change fill style
		cy.get('#fillstyle')
			.click();

		cy.contains('.ui-combobox-text', 'Color')
			.click();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Color');

		// Check the default color
		cy.get('#fillattr .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(114, 159, 207);');

		// Change the color
		cy.get('#fillattr')
			.click();

		cy.get('#color-picker-0-basic-color-5')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

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

	it('Apply gradient fill.', function() {
		// Change fill style
		cy.get('#fillstyle')
			.click();

		cy.contains('.ui-combobox-text', 'Gradient')
			.click();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Gradient');

		// Check the default color
		cy.get('#fillattr2 .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(221, 232, 203);');

		cy.get('#fillattr3 .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 215, 215);');

		// Change the colors
		cy.get('#fillattr2')
			.click();

		cy.get('#color-picker-0-basic-color-2')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		cy.get('#fillattr3')
			.click();

		cy.get('#color-picker-1-basic-color-4')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

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

	it('Apply hatching fill.', function() {
		// Change fill style
		cy.get('#fillstyle')
			.click();

		cy.contains('.ui-combobox-text', 'Hatching')
			.click();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Hatching');

		// Check the default value
		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Black 0 Degrees');

		// Change the hatching
		cy.get('#fillattr1')
			.click();

		cy.contains('.ui-combobox-text', 'Blue Triple 90 Degrees')
			.click();

		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Blue Triple 90 Degrees');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Hatching');

		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Blue Triple 90 Degrees');
	});

	it('Apply bitmap fill.', function() {
		// Change fill style
		cy.get('#fillstyle')
			.click();

		cy.contains('.ui-combobox-text', 'Bitmap')
			.click();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Bitmap');

		// Check the default value
		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Painted White');

		// Change the value
		cy.get('#fillattr1')
			.click();

		cy.contains('.ui-combobox-text', 'Wooden Board')
			.click();

		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Wooden Board');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Bitmap');

		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', 'Wooden Board');
	});

	it('Apply pattern fill.', function() {
		// Change fill style
		cy.get('#fillstyle')
			.click();

		cy.contains('.ui-combobox-text', 'Pattern')
			.click();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Pattern');

		// Check the default value
		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', '5 Percent');

		// Change the value
		cy.get('#fillattr1')
			.click();

		cy.contains('.ui-combobox-text', '50 Percent')
			.click();

		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', '50 Percent');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Pattern');

		cy.get('#fillattr1 .ui-header-left')
			.should('have.text', '50 Percent');
	});

	it.skip('Remove slide fill.', function() {
		// Apply color fill first
		cy.get('#fillstyle')
			.click();

		cy.contains('.ui-combobox-text', 'Color')
			.click();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Color');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'Color');

		// Remove fill
		cy.get('#fillstyle')
			.click();

		cy.contains('.ui-combobox-text', 'None')
			.click();

		cy.get('#fillstyle .ui-header-left')
			.should('have.text', 'None');

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
		cy.get('#masterslide')
			.click();

		cy.contains('.ui-combobox-text', 'Colored')
			.click();

		cy.get('#masterslide .ui-header-left')
			.should('have.text', 'Colored');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and change the setting
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('input#displaymasterbackground')
			.should('have.prop', 'checked', true);

		cy.get('input#displaymasterbackground')
			.click();

		cy.get('input#displaymasterbackground')
			.should('not.have.prop', 'checked', true);

		previewShouldBeFullWhite();

		// Reopen mobile wizard and change the setting again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('input#displaymasterbackground')
			.should('not.have.prop', 'checked', true);

		cy.get('input#displaymasterbackground')
			.click();

		cy.get('input#displaymasterbackground')
			.should('have.prop', 'checked', true);

		previewShouldBeFullWhite(false);
	});

	it('Change master objects visibility.', function() {
		// Master objects are disabled, enable the settings first
		cy.get('input#displaymasterobjects')
			.should('not.have.prop', 'checked', true);

		cy.get('input#displaymasterobjects')
			.click();

		cy.get('input#displaymasterobjects')
			.should('have.prop', 'checked', true);

		// We have an image which changes the preview
		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and change the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('input#displaymasterobjects')
			.should('have.prop', 'checked', true);

		cy.get('input#displaymasterobjects')
			.click();

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

		cy.get('#paperformat')
			.click();

		cy.contains('.ui-combobox-text', 'Screen 4:3')
			.click();

		cy.get('#paperformat .ui-header-left')
			.should('have.text', 'Screen 4:3');

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

		cy.get('#orientation')
			.click();

		cy.contains('.ui-combobox-text', 'Portrait')
			.click();

		cy.get('#orientation .ui-header-left')
			.should('have.text', 'Portrait');

		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				expect(previews[0].width).to.be.lessThan(previews[0].height);
			});

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#orientation .ui-header-left')
			.should('have.text', 'Portrait');
	});

	it('Apply master slide layout.', function() {
		// We have white background by deafult checked by before() method
		// Select a new master slide with a background color
		cy.get('#masterslide .ui-header-left')
			.should('have.text', 'Default');

		cy.get('#masterslide')
			.click();

		cy.contains('.ui-combobox-text', 'Colored')
			.click();

		cy.get('#masterslide .ui-header-left')
			.should('have.text', 'Colored');

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#masterslide .ui-header-left')
			.should('have.text', 'Colored');
	});

	it('Apply layout.', function() {
		// Apply title / subtitle layout
		cy.get('#Layouts')
			.click();

		// Blank is the default
		// TODO: wring item is selected by default
		//cy.get('.layout:nth-of-type(1)')
		//	.should('have.class', 'loleaflet-context-down');

		// Select layout with title and content shape
		cy.get('.layout:nth-of-type(3)')
			.click();

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#Layouts')
			.click();

		cy.get('.layout:nth-of-type(3)')
			.should('have.class', 'loleaflet-context-down');
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

		cy.get('#paperformat')
			.click();

		cy.contains('.ui-combobox-text', 'Screen 4:3')
			.click();

		cy.get('#paperformat .ui-header-left')
			.should('have.text', 'Screen 4:3');

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

		cy.get('#orientation')
			.click();

		cy.contains('.ui-combobox-text', 'Portrait')
			.click();

		cy.get('#orientation .ui-header-left')
			.should('have.text', 'Portrait');

		cy.get('.preview-frame:nth-of-type(2) img')
			.should(function(previews) {
				expect(previews[0].width).to.be.lessThan(previews[0].height);
			});

		// Reopen mobile wizard and check the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('#orientation .ui-header-left')
			.should('have.text', 'Portrait');
	});

	it('Check disabled elements in master view.', function() {
		switchToMasterView();

		cy.get('#masterslide')
			.should('have.class', 'disabled');

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
			.should('have.class', 'disabled');

		cy.get('#displaymasterbackground label')
			.should('have.class', 'disabled');

		cy.get('#displaymasterobjects label')
			.should('have.class', 'disabled');
	});
});
