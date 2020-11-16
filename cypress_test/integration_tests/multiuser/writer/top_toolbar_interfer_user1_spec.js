/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var writerHelper = require('../../common/writer_helper');

describe('Top toolbar interfering test: user-1.', function() {
	var testFileName = 'top_toolbar_interfer.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		cy.get('#tb_actionbar_item_userlist', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 })
			.should('be.visible');

		cy.wait(2000);

		writerHelper.selectAllTextOfDoc();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Apply bold font.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		cy.get('#tb_editbar_item_italic')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
		    .should('exist');
	});

	it('Apply underline.', function() {
		cy.get('#tb_editbar_item_underline')
			.click();
		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikethrough.', function() {
		cy.get('#tb_editbar_item_strikeout')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply left alignment.', function() {
		cy.get('#tb_editbar_item_centerpara')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');

		cy.get('#tb_editbar_item_leftpara')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Insert comment.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		cy.get('#tb_editbar_item_insertannotation')
			.click();

		// Comment insertion dialog is opened
		cy.get('.loleaflet-annotation-table')
			.should('exist');

		// Add some comment
		cy.get('.loleaflet-annotation-edit:nth-of-type(2) .loleaflet-annotation-textarea')
			.type('some text');

		cy.get('#annotation-save')
			.click();

		cy.get('.loleaflet-annotation')
			.should('exist');

		cy.get('.loleaflet-annotation-content.loleaflet-dont-break')
			.should('have.text', 'some text');
	});
});
