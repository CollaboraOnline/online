/* global describe it cy beforeEach require afterEach Cypress*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('./writer_helper');

describe('Apply paragraph properties.', function() {
	var testFileName = 'apply_paragraph_properties.odt';

	beforeEach(function() {
		mobileHelper.beforeAllMobile(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Do a selection
		writerHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		cy.get('#Paragraph')
			.should('have.class', 'selected');
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Apply left alignment.', function() {
		// Change alignment
		cy.get('#CenterPara')
			.click();

		cy.get('#CenterParaimg')
			.should('have.class', 'selected');

		cy.get('#LeftPara')
			.click();

		cy.get('#LeftParaimg')
			.should('have.class', 'selected');

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Apply center alignment.', function() {
		// Change alignment
		cy.get('#CenterPara')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply right alignment.', function() {
		// Change alignment
		cy.get('#RightPara')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');
	});

	it('Apply justify alignment.', function() {
		// Change alignment
		cy.get('#JustifyPara')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Change writing direction.', function() {
		// Change writing mode
		cy.get('#ParaRightToLeft')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'dir', 'rtl');

		// Select text
		writerHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		// Change writing mode
		cy.get('#ParaLeftToRight')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('not.have.attr', 'dir');
	});

	it('Apply default bulleting.', function() {
		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		cy.get('#DefaultBullet')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container ul li p')
			.should('exist');
	});

	it('Apply default numbering.', function() {
		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		cy.get('#DefaultNumbering')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container ol li p')
			.should('exist');
	});

	it('Apply background color.', function() {
		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Change background color
		cy.get('#BackgroundColor')
			.click();

		cy.get('#color-picker-2-basic-color-5')
			.click();

		cy.get('#color-picker-2-tint-2')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'background: #6aa84f');
	});

	it('Increase / decrease para spacing.', function() {
		// Increase para spacing
		cy.get('#ParaspaceIncrease')
			.click();
		cy.get('#ParaspaceIncrease')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-top: 0.08in');

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-bottom: 0.08in');

		// Select text
		writerHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		// Decrease para spacing
		cy.get('#ParaspaceDecrease')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-top: 0.04in');

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-bottom: 0.04in');
	});

	it('Change para spacing via combobox.', function() {
		// Check para spacing current value
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0');
		cy.get('#belowparaspacing .spinfield')
			.should('have.attr', 'value', '0');

		// Change spacing
		cy.get('#aboveparaspacing .spinfieldcontrols .plus')
			.click();
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#aboveparaspacing .spinfieldcontrols .plus')
			.click();
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.04');
		cy.get('#aboveparaspacing .spinfieldcontrols .plus')
			.click();
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.06');

		cy.get('#belowparaspacing .spinfieldcontrols .plus')
			.click();
		cy.get('#belowparaspacing .spinfield')
			.should('have.attr', 'value', '0.02');

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-top: 0.06in');

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-bottom: 0.02in');
	});

	it('Increase / decrease indent.', function() {
		// Increase indent
		cy.get('#IncrementIndent')
			.click();
		cy.get('#IncrementIndent')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.98in');

		// Select text
		writerHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		// Decrease indent
		cy.get('#DecrementIndent')
			.click();

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.49in');
	});

	it('Apply before text indent.', function() {
		// Change indent
		cy.get('#beforetextindent .spinfieldcontrols .plus')
			.click();
		cy.get('#beforetextindent .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#beforetextindent .spinfieldcontrols .plus')
			.click();
		cy.get('#beforetextindent .spinfield')
			.should('have.attr', 'value', '0.04');

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.04in');
	});

	it('Apply after text indent.', function() {
		// Change indent
		cy.get('#aftertextindent .spinfieldcontrols .plus')
			.click();
		cy.get('#aftertextindent .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#aftertextindent .spinfieldcontrols .plus')
			.click();
		cy.get('#aftertextindent .spinfield')
			.should('have.attr', 'value', '0.04');

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-right: 0.04in');
	});

	it('Apply first line indent.', function() {
		// Increase firstline indent
		cy.get('#firstlineindent .spinfieldcontrols .plus')
			.click();
		cy.get('#firstlineindent .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#firstlineindent .spinfieldcontrols .plus')
			.click();
		cy.get('#firstlineindent .spinfield')
			.should('have.attr', 'value', '0.04');

		writerHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'text-indent: 0.04in');
	});

	it('Linespacing item is hidden.', function() {
		// Linespacing item triggers a drop down menu in core
		// which is not implemented in online yet.
		cy.get('#LineSpacing')
			.should('not.exist');
	});
});
