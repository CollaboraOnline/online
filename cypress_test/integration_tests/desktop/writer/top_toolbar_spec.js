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

	it('Apply highlight color.', function() {
		cy.get('#tb_editbar_item_backcolor')
			.click();

		cy.get('.w2ui-color [name="FFF2CC"]')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #fff2cc');
	});

	it('Apply font color.', function() {
		cy.get('#tb_editbar_item_fontcolor')
			.click();

		cy.get('.w2ui-color [name="8E7CC3"]')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#8e7cc3');
	});

	it('Apply style.', function() {
		cy.get('#tb_editbar_item_styles')
			.click();

		cy.contains('.select2-results__option','Title')
			 .click({force: true});

		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');
	});

	it('Apply font name.', function() {
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
		
		cy.get('#tb_editbar_item_reset')
			.click();

		helper.selectAllText(false);

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

	it('Insert table.', function() {
		cy.get('#tb_editbar_item_inserttable')
			.click();

		cy.get('.inserttable-grid > .row > .col').eq(3)
		   .click();

		helper.reselectAllText();
		
		cy.get('#copy-paste-container table')
			.should('exist');
	});
});
