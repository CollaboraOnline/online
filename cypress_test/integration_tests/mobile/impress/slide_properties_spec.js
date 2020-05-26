/* global describe it cy require afterEach expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Changing slide properties.', function() {
	var testFileName;

	function before(fileName) {
		testFileName = fileName;
		mobileHelper.beforeAllMobile(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		previewShouldBeFullWhite();

		mobileHelper.openMobileWizard();
	}

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

	it('Apply solid color background.', function() {
		before('slide_properties.odp');

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
		before('slide_properties.odp');

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
		before('slide_properties.odp');

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
		before('slide_properties.odp');

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
		before('slide_properties.odp');

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

	it('Remove slide fill.', function() {
		before('slide_properties.odp');

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
		before('slide_properties2.odp');

		// Master background is disabled, enable it first
		cy.get('input#displaymasterbackground')
			.should('not.have.prop', 'checked', true);

		cy.get('input#displaymasterbackground')
			.click();

		cy.get('input#displaymasterbackground')
			.should('have.prop', 'checked', true);

		previewShouldBeFullWhite(false);

		// Reopen mobile wizard and change the settings again
		mobileHelper.closeMobileWizard();
		mobileHelper.openMobileWizard();

		cy.get('input#displaymasterbackground')
			.should('have.prop', 'checked', true);

		cy.get('input#displaymasterbackground')
			.click();

		cy.get('input#displaymasterbackground')
			.should('not.have.prop', 'checked', true);

		previewShouldBeFullWhite();
	});
});
