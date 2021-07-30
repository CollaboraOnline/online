/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');

describe('Apply font on selected text.', function() {
	var testFileName = 'apply_font_text.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		cy.get('#toolbar-up > .w2ui-scroll-right')
			.click();

		cy.get('#tb_editbar_item_modifypage')
			.click();

		impressHelper.selectTextShapeInTheCenter();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply font name',function() {
		cy.get('#toolbar-up > .w2ui-scroll-left')
			.click();

		impressHelper.selectTextOfShape();

		cy.get('#tb_editbar_item_fonts').click();

		cy.contains('.select2-results__option','Linux Libertine G')
			.click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-family', 'Linux Libertine G');
	});


	it('Apply font size.', function() {
		impressHelper.selectTextOfShape();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		cy.get('#tb_editbar_item_fontsizes').click();

		cy.contains('.select2-results__option','24')
			.click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '847px');
	});


	it('Apply bold font', function() {
		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_bold');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-weight', '700');
	});

	it('Apply italic font.', function() {
		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_italic');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-style', 'italic');
	});


	it('Apply underline.', function() {
		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_underline');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikeout.', function() {
		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_strikeout');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply font color.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(0,0,0)');

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_fontcolor');

		cy.get('.color[name="FF011B"]')
			.click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(255,1,27)');
	});

	it('Apply highlight color.', function() {
		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_backcolor');

		cy.get('.color[name="FF011B"]')
			.click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		// TODO: highlight color is not in the SVG
		// At least check the mobile wizard's state
		cy.wait(400);

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_backcolor');

		cy.get('.color[name="FF011B"]').eq(0)
			.should('have.text', '•    ');
	});

	it('Apply superscript on selected text.', function() {
		impressHelper.selectTextOfShape();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.typeIntoDocument('{ctrl}{shift}p');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3285');

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});

	it('Apply subscript on selected text.', function() {
		impressHelper.selectTextOfShape();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3495');

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '635px');

		helper.typeIntoDocument('{ctrl}{shift}b');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '3705');

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '368px');
	});
});

