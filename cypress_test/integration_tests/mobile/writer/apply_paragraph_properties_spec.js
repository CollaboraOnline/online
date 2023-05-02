/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');

describe.skip('Apply paragraph properties.', function() {
	var origTestFileName = 'apply_paragraph_properties.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		mobileHelper.enableEditingMobile();
		writerHelper.selectAllTextOfDoc();
		mobileHelper.openMobileWizard();
		// Open paragraph properties
		helper.clickOnIdle('#Paragraph');
		cy.cGet('#Paragraph').should('have.class', 'selected');
		cy.cGet('#LeftPara').should('be.visible');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	/*it('Apply left/right alignment.', function() {
		helper.clickOnIdle('#RightPara');

		mobileHelper.closeMobileWizard();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');

		// Then apply left alignment
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#Paragraph');

		cy.get('#Paragraph')
			.should('have.class', 'selected');

		helper.clickOnIdle('#LeftPara');

		cy.get('#LeftParaimg')
			.should('have.class', 'selected');

		mobileHelper.closeMobileWizard();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Apply center alignment.', function() {
		helper.clickOnIdle('#CenterPara');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply justify alignment.', function() {
		helper.clickOnIdle('#JustifyPara');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Change writing direction.', function() {
		helper.clickOnIdle('#ParaRightToLeft');

		mobileHelper.closeMobileWizard();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'dir', 'rtl');

		writerHelper.selectAllTextOfDoc();

		mobileHelper.openMobileWizard();

		// Open paragraph properties
		helper.clickOnIdle('#Paragraph');

		// Change writing mode
		helper.clickOnIdle('#ParaLeftToRight');

		mobileHelper.closeMobileWizard();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('not.have.attr', 'dir');
	});

	it('Apply default bulleting.', function() {
		helper.clickOnIdle('#DefaultBullet');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container ul li p')
			.should('exist');
	});

	it('Apply default numbering.', function() {
		helper.clickOnIdle('#DefaultNumbering');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container ol li p')
			.should('exist');
	});*/

	it('Apply background color.', function() {
		helper.clickOnIdle('#BackgroundColor .ui-header');
		mobileHelper.selectFromColorPalette(4, 5, 5, 2);
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'background: #6aa84f');
	});

	it('Increase / decrease para spacing.', function() {
		// Increase para spacing
		helper.clickOnIdle('#ParaspaceIncrease');
		helper.clickOnIdle('#ParaspaceIncrease');
		mobileHelper.closeMobileWizard();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-top: 0.08in');
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-bottom: 0.08in');
		writerHelper.selectAllTextOfDoc();
		mobileHelper.openMobileWizard();
		// Open paragraph properties
		helper.clickOnIdle('#Paragraph');
		// Decrease para spacing
		helper.clickOnIdle('#ParaspaceDecrease');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-top: 0.04in');
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-bottom: 0.04in');
	});

	it('Change para spacing via combobox.', function() {
		// Check para spacing current value
		cy.cGet('#aboveparaspacing .spinfield').should('have.value', '0');
		cy.cGet('#belowparaspacing .spinfield').should('have.value', '0');

		// Change spacing
		helper.clickOnIdle('#aboveparaspacing .plus');
		cy.cGet('#aboveparaspacing .spinfield').should('have.value', '0.01');
		helper.clickOnIdle('#aboveparaspacing .plus');
		cy.cGet('#aboveparaspacing .spinfield').should('have.value', '0.02');

		helper.clickOnIdle('#aboveparaspacing .plus');
		cy.cGet('#aboveparaspacing .spinfield').should('have.value', '0.03');

		helper.clickOnIdle('#aboveparaspacing .plus');
		cy.cGet('#aboveparaspacing .spinfield').should('have.value', '0.04');

		helper.clickOnIdle('#aboveparaspacing .minus');
		cy.cGet('#aboveparaspacing .spinfield').should('have.value', '0.03');

		helper.clickOnIdle('#belowparaspacing .plus');
		cy.cGet('#belowparaspacing .spinfield').should('have.value', '0.01');

		writerHelper.selectAllTextOfDoc();

		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-top: 0.03in');
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-bottom: 0.01in');
	});

	it('Increase / decrease indent.', function() {
		// Increase indent
		helper.clickOnIdle('#IncrementIndent');
		helper.clickOnIdle('#IncrementIndent');
		mobileHelper.closeMobileWizard();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-left: 0.98in');
		writerHelper.selectAllTextOfDoc();
		mobileHelper.openMobileWizard();
		// Open paragraph properties
		helper.clickOnIdle('#Paragraph');
		// Decrease indent
		helper.clickOnIdle('#DecrementIndent');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-left: 0.49in');
	});

	it('Apply before text indent.', function() {
		// Change indent
		helper.clickOnIdle('#beforetextindent .plus');
		cy.cGet('#beforetextindent .spinfield').should('have.value', '0.01');

		helper.clickOnIdle('#beforetextindent .plus');
		cy.cGet('#beforetextindent .spinfield').should('have.value', '0.02');

		writerHelper.selectAllTextOfDoc();

		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-left: 0.02in');
	});

	it('Apply after text indent.', function() {
		// Change indent
		helper.clickOnIdle('#aftertextindent .plus');
		cy.cGet('#aftertextindent .spinfield').should('have.value', '0.01');

		helper.clickOnIdle('#aftertextindent .plus');
		cy.cGet('#aftertextindent .spinfield').should('have.value', '0.02');

		writerHelper.selectAllTextOfDoc();

		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'margin-right: 0.02in');
	});

	it('Apply first line indent.', function() {
		// Increase firstline indent
		helper.clickOnIdle('#firstlineindent .plus');
		cy.cGet('#firstlineindent .spinfield').should('have.value', '0.01');

		helper.clickOnIdle('#firstlineindent .plus');
		cy.cGet('#firstlineindent .spinfield').should('have.value', '0.02');

		writerHelper.selectAllTextOfDoc();

		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'text-indent: 0.02in');
	});

	it('Linespacing item is hidden.', function() {
		// Linespacing item triggers a drop down menu in core
		// which is not implemented in online yet.
		cy.cGet('#LineSpacing').should('not.exist');
	});
});
