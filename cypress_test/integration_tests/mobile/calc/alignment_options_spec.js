/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('./calc_helper');

describe('Change alignment settings.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('alignment_options.ods', 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		cy.get('#ScAlignmentPropertyPanel')
			.click();

		cy.get('#AlignLeft')
			.should('be.visible');
	});

	afterEach(function() {
		helper.afterAll('alignment_options.ods');
	});

	it('Apply left/right alignment', function() {
		// Set right aligment first
		cy.get('#AlignRight')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'right');

		// Change alignment back
		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		cy.get('#ScAlignmentPropertyPanel')
			.click();

		cy.get('#AlignLeft')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'left');
	});

	it('Align to center horizontally.', function() {
		cy.get('#AlignHorizontalCenter')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'center');
	});

	it('Change to block alignment.', function() {
		// Set right aligment first
		cy.get('#AlignBlock')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'justify');
	});

	it('Right-to-left and left-to-right writing mode.', function() {
		cy.get('#ParaRightToLeft')
			.click();

		// TODO: we don't have a way of testing this
		// copy container doesn't have info about this
		cy.wait(500);

		// Set right aligment first
		cy.get('#ParaLeftToRight')
			.click();

		cy.wait(500);
	});

	it('Align to the top and to bottom.', function() {
		cy.get('#AlignTop')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'valign', 'top');

		// Change alignment back
		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		cy.get('#ScAlignmentPropertyPanel')
			.click();

		cy.get('#AlignBottom')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'valign', 'bottom');
	});

	it('Align to center vertically.', function() {
		cy.get('#AlignVCenter')
			.click();

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'valign', 'middle');
	});
});
