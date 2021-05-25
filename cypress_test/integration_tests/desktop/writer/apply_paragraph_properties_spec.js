/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var writerHelper = require('../../common/writer_helper');

describe('Apply paragraph properties.', function() {
	var testFileName = 'apply_paragraph_properties.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		writerHelper.selectAllTextOfDoc();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply left/right alignment.', function() {
		helper.clickOnIdle('#tb_editbar_item_leftpara');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');

		helper.clickOnIdle('#tb_editbar_item_rightpara');

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');
	});

	it('Apply center alignment.', function() {
		helper.clickOnIdle('#tb_editbar_item_centerpara');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply justify alignment.', function() {
		helper.clickOnIdle('#tb_editbar_item_justifypara');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Apply default bulleting.', function() {
		helper.clickOnIdle('#toolbar-up > .w2ui-scroll-right');

		helper.clickOnIdle('#tb_editbar_item_defaultbullet');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container ul li p')
			.should('exist');
	});

	it('Apply default numbering.', function() {
		helper.clickOnIdle('#tb_editbar_item_defaultnumbering');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container ol li p')
			.should('exist');
	});

	it('Increase / decrease para spacing.', function() {
		helper.clickOnIdle('#tb_editbar_item_linespacing');

		cy.contains('td','Increase Paragraph Spacing').click();

		helper.clickOnIdle('#tb_editbar_item_linespacing');

		cy.contains('td','Increase Paragraph Spacing').click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-top: 0.08in');

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-bottom: 0.08in');

		writerHelper.selectAllTextOfDoc();

		helper.clickOnIdle('#tb_editbar_item_linespacing');

		cy.contains('td','Decrease Paragraph Spacing').click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-top: 0.04in');

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-bottom: 0.04in');
	});

	it('Increase / decrease indent.', function() {
		helper.clickOnIdle('#toolbar-up > .w2ui-scroll-right');

		helper.clickOnIdle('#tb_editbar_item_incrementindent');

		helper.clickOnIdle('#tb_editbar_item_incrementindent');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.98in');

		writerHelper.selectAllTextOfDoc();

		helper.clickOnIdle('#tb_editbar_item_decrementindent');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.49in');
	});
});
