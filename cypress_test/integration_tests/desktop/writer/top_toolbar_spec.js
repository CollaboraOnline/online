/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Top toolbar tests.', function() {
	var testFileName = 'top_toolbar.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		helper.selectAllText(false);
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Apply font style', function() {
		cy.get('#tb_editbar_item_fonts')
			.click();

		cy.contains('.select2-results__option','Alef')
			 .click({force: true});

		cy.get('#copy-paste-container p font')
		    .should('have.attr', 'face', 'Alef, sans-serif');
	});

	it('Apply bold font.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		cy.get('#tb_editbar_item_italic')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p i')
		    .should('exist');
	});
		
	it('Apply underline.', function() {
		cy.get('#tb_editbar_item_underline')
			.click();
		helper.reselectAllText();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikethrough.', function() {
		cy.get('#tb_editbar_item_strikeout')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply font size', function() {
		cy.get('#tb_editbar_item_fontsizes')
			.click();

		cy.contains('.select2-results__option','72')
			 .click();

		cy.get('#copy-paste-container p font')
		    .should('have.attr', 'style', 'font-size: 72pt');
	});

	it('Clear direct formatting', function() {
		cy.get('#tb_editbar_item_bold')
			.click();
		
		helper.selectAllText(false);

		cy.get('#copy-paste-container p b')
			.should('exist');

		helper.selectAllText(false);
		
		cy.get('#tb_editbar_item_reset')
			.click();
	
		cy.get('#copy-paste-container p b')
			.should('not.exist');
	});
	
	it('Apply left alignment.', function() {
		cy.get('#tb_editbar_item_centerpara')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');

		cy.get('#tb_editbar_item_leftpara')
			.click();

		helper.selectAllText(false);

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
