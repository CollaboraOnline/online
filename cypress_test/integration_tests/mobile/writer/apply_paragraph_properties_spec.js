/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerMobileHelper = require('./writer_mobile_helper');

describe('Apply paragraph properties.', function() {
	var testFileName = 'apply_paragraph_properties.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Do a selection
		writerMobileHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		helper.clickOnIdle('#Paragraph');

		cy.get('#Paragraph')
			.should('have.class', 'selected');

		cy.get('#LeftPara')
			.should('be.visible');
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Apply left alignment.', function() {
		helper.clickOnIdle('#CenterPara');

		cy.get('#CenterParaimg')
			.should('have.class', 'selected');

		helper.clickOnIdle('#LeftPara');

		cy.get('#LeftParaimg')
			.should('have.class', 'selected');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Apply center alignment.', function() {
		helper.clickOnIdle('#CenterPara');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply right alignment.', function() {
		helper.clickOnIdle('#RightPara');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');
	});

	it('Apply justify alignment.', function() {
		helper.clickOnIdle('#JustifyPara');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Change writing direction.', function() {
		helper.clickOnIdle('#ParaRightToLeft');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'dir', 'rtl');

		// Select text
		writerMobileHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		helper.clickOnIdle('#Paragraph');

		// Change writing mode
		helper.clickOnIdle('#ParaLeftToRight');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('not.have.attr', 'dir');
	});

	it('Apply default bulleting.', function() {
		helper.clickOnIdle('#DefaultBullet');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container ul li p')
			.should('exist');
	});

	it('Apply default numbering.', function() {
		helper.clickOnIdle('#DefaultNumbering');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container ol li p')
			.should('exist');
	});

	it('Apply background color.', function() {
		helper.clickOnIdle('#BackgroundColor');

		mobileHelper.selectFromColorPalette(2, 5, 2);

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'background: #6aa84f');
	});

	it('Increase / decrease para spacing.', function() {
		// Increase para spacing
		helper.clickOnIdle('#ParaspaceIncrease');

		helper.clickOnIdle('#ParaspaceIncrease');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-top: 0.08in');

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-bottom: 0.08in');

		// Select text
		writerMobileHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		helper.clickOnIdle('#Paragraph');

		// Decrease para spacing
		helper.clickOnIdle('#ParaspaceDecrease');

		writerMobileHelper.selectAllMobile();

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
		helper.clickOnIdle('#aboveparaspacing .plus');
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.02');

		helper.clickOnIdle('#aboveparaspacing .plus');
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.04');

		helper.clickOnIdle('#aboveparaspacing .plus');
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.06');

		helper.clickOnIdle('#aboveparaspacing .plus');
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.08');

		helper.clickOnIdle('#aboveparaspacing .minus');
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.06');

		helper.clickOnIdle('#belowparaspacing .plus');
		cy.get('#belowparaspacing .spinfield')
			.should('have.attr', 'value', '0.02');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-top: 0.06in');

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-bottom: 0.02in');
	});

	it('Increase / decrease indent.', function() {
		// Increase indent
		helper.clickOnIdle('#IncrementIndent');
		helper.clickOnIdle('#IncrementIndent');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.98in');

		// Select text
		writerMobileHelper.selectAllMobile();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		helper.clickOnIdle('#Paragraph');

		// Decrease indent
		helper.clickOnIdle('#DecrementIndent');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.49in');
	});

	it('Apply before text indent.', function() {
		// Change indent
		helper.clickOnIdle('#beforetextindent .plus');
		cy.get('#beforetextindent .spinfield')
			.should('have.attr', 'value', '0.02');

		helper.clickOnIdle('#beforetextindent .plus');
		cy.get('#beforetextindent .spinfield')
			.should('have.attr', 'value', '0.04');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.04in');
	});

	it('Apply after text indent.', function() {
		// Change indent
		helper.clickOnIdle('#aftertextindent .plus');
		cy.get('#aftertextindent .spinfield')
			.should('have.attr', 'value', '0.02');

		helper.clickOnIdle('#aftertextindent .plus');
		cy.get('#aftertextindent .spinfield')
			.should('have.attr', 'value', '0.04');

		writerMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-right: 0.04in');
	});

	it('Apply first line indent.', function() {
		// Increase firstline indent
		helper.clickOnIdle('#firstlineindent .plus');
		cy.get('#firstlineindent .spinfield')
			.should('have.attr', 'value', '0.02');

		helper.clickOnIdle('#firstlineindent .plus');
		cy.get('#firstlineindent .spinfield')
			.should('have.attr', 'value', '0.04');

		writerMobileHelper.selectAllMobile();

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
