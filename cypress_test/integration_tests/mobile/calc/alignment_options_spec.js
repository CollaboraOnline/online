/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var calc = require('../../common/calc');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('./calc_helper');

describe('Change alignment settings.', function() {
	var testFileName = 'alignment_options.ods';

	beforeEach(function() {
		mobileHelper.beforeAllMobile(testFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	function getTextPosForFirstCell() {
		calc.dblClickOnFirstCell();

		// Select text content
		cy.get('textarea.clipboard')
			.type('{ctrl}a', {force: true});

		helper.initAliasToNegative('currentTextPos');

		cy.get('.leaflet-selection-marker-end')
			.invoke('offset')
			.its('left')
			.as('currentTextPos');

		cy.get('@currentTextPos')
			.should('be.greaterThan', 0);

		calcHelper.removeTextSelection();
	}

	function openAlignmentPaneForFirstCell() {
		calc.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		cy.get('#ScAlignmentPropertyPanel')
			.click();

		cy.get('#AlignLeft')
			.should('be.visible');
	}

	it('Apply left/right alignment', function() {
		openAlignmentPaneForFirstCell();

		// Set right aligment first
		cy.get('#AlignRight')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'right');

		// Change alignment back
		calc.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		cy.get('#ScAlignmentPropertyPanel')
			.click();

		cy.get('#AlignLeft')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'left');
	});

	it('Align to center horizontally.', function() {
		openAlignmentPaneForFirstCell();

		cy.get('#AlignHorizontalCenter')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'center');
	});

	it('Change to block alignment.', function() {
		openAlignmentPaneForFirstCell();

		cy.get('#AlignBlock')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'justify');
	});

	it('Right-to-left and left-to-right writing mode.', function() {
		openAlignmentPaneForFirstCell();

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
		openAlignmentPaneForFirstCell();

		cy.get('#AlignTop')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'valign', 'top');

		// Change alignment back
		calc.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		cy.get('#ScAlignmentPropertyPanel')
			.click();

		cy.get('#AlignBottom')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'valign', 'bottom');
	});

	it('Align to center vertically.', function() {
		openAlignmentPaneForFirstCell();

		cy.get('#AlignVCenter')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'valign', 'middle');
	});

	it('Increment / decrement text indent.', function() {
		helper.initAliasToNegative('originalTextPos');

		// Get text position first
		getTextPosForFirstCell();
		cy.get('@currentTextPos')
			.as('originalTextPos');

		cy.get('@originalTextPos')
			.should('be.greaterThan', 0);

		openAlignmentPaneForFirstCell();

		// Increase indent
		cy.get('#IncrementIndent')
			.click();

		// We use the text position as indicator
		cy.get('body')
			.should(function() {
				getTextPosForFirstCell();

				cy.get('@currentTextPos')
					.then(function(currentTextPos) {
						cy.get('@originalTextPos')
							.then(function(originalTextPos) {
								expect(originalTextPos).to.be.lessThan(currentTextPos);
							});
					});
			});

		helper.initAliasToNegative('originalTextPos');

		cy.get('@currentTextPos')
			.as('originalTextPos');

		cy.get('@currentTextPos')
			.should('be.greaterThan', 0);

		// Decrease indent
		openAlignmentPaneForFirstCell();

		cy.get('#DecrementIndent')
			.click();

		// We use the text position as indicator
		cy.get('body')
			.should(function() {
				getTextPosForFirstCell();

				cy.get('@currentTextPos')
					.then(function(currentTextPos) {
						cy.get('@originalTextPos')
							.then(function(originalTextPos) {
								expect(originalTextPos).to.be.greaterThan(currentTextPos);
							});
					});
			});
	});

	it.skip('Change text indent via input field.', function() {
		// TODO: this fails, because the input field always becomes disabled.
		helper.initAliasToNegative('originalTextPos');

		getTextPosForFirstCell();
		cy.get('@currentTextPos')
			.as('originalTextPos');

		cy.get('@currentTextPos')
			.should('be.greaterThan', 0);

		openAlignmentPaneForFirstCell();

		// TODO: First we need to increase indent to make the input enabled
		cy.get('#IncrementIndent')
			.click();

		cy.wait(300);

		cy.get('#IncrementIndent')
			.click();

		calcHelper.removeTextSelection();

		openAlignmentPaneForFirstCell();

		cy.get('#leftindent .spinfield')
			.should('not.have.attr', 'disabled');

		// Increase indent
		cy.get('#leftindent .spinfield')
			.clear()
			.type('20{enter}');

		// We use the text position as indicator
		cy.get('body')
			.should(function() {
				getTextPosForFirstCell();

				cy.get('@currentTextPos')
					.then(function(currentTextPos) {
						cy.get('@originalTextPos')
							.then(function(originalTextPos) {
								expect(originalTextPos).to.be.lessThan(currentTextPos);
							});
					});
			});
	});

	it('Enable text wrapping.', function() {
		helper.initAliasToNegative('originalTextPos');

		getTextPosForFirstCell();
		cy.get('@currentTextPos')
			.as('originalTextPos');

		cy.get('@currentTextPos')
			.should('be.greaterThan', 0);

		openAlignmentPaneForFirstCell();

		cy.get('input#wraptext')
			.should('not.have.prop', 'checked', true);

		cy.get('input#wraptext')
			.click();

		cy.get('input#wraptext')
			.should('have.prop', 'checked', true);

		// We use the text position as indicator
		cy.get('body')
			.should(function() {
				getTextPosForFirstCell();

				cy.get('@currentTextPos')
					.then(function(currentTextPos) {
						cy.get('@originalTextPos')
							.then(function(originalTextPos) {
								expect(originalTextPos).to.be.greaterThan(currentTextPos);
							});
					});
			});
	});

	it('Apply stacked option.', function() {
		openAlignmentPaneForFirstCell();

		cy.get('input#stacked')
			.should('not.have.prop', 'checked', true);

		cy.get('input#stacked')
			.click();

		cy.get('input#stacked')
			.should('have.prop', 'checked', true);

		cy.wait(500);

		// TODO: we don't have a good indicator here
		// neither the text position nor the clipboard container helps here.
	});

	it.skip('Merge cells.', function() {
		// Select the full row
		calcHelper.selectFirstRow();

		// Even after we get the cell row selection the merge cell options is still disabled
		// So we open mobile wizard again and again until merge cells get the right state
		mobileHelper.openMobileWizard();
		cy.get('body')
			.should(function() {
				mobileHelper.closeMobileWizard();
				mobileHelper.openMobileWizard();

				cy.get('#ScAlignmentPropertyPanel')
					.click();

				cy.get('#AlignLeft')
					.should('be.visible');

				cy.get('input#mergecells')
					.then(function(items) {
						expect(items).to.have.lengthOf(1);
						expect(items[0]).to.not.have.attr('disabled');
					});
			});

		// Click merge cells
		cy.get('input#mergecells')
			.should('not.have.prop', 'checked', true);

		cy.get('input#mergecells')
			.click();

		cy.get('input#mergecells')
			.should('have.prop', 'checked', true);

		// Check content
		calcHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'colspan', '1024');
	});
});
