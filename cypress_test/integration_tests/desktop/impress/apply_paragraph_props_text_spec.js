/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');

describe('Apply paragraph properties on selected shape.', function() {
	var testFileName = 'apply_paragraph_props_text.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		helper.clickOnIdle('#toolbar-up > .w2ui-scroll-right');

		cy.get('#tb_editbar_item_modifypage').click();

		impressHelper.selectTextShapeInTheCenter();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it.skip('Apply left/right alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_rightpara');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		helper.clickOnIdle('#tb_editbar_item_leftpara');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it.skip('Apply center alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_centerpara');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');
	});

	it.skip('Apply justified alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_rightpara');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_justifypara');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});
	it.skip('Apply default bulleting on selected text.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_defaultbullet');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it.skip('Apply default numbering on selected text.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_defaultnumbering');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it.skip('Increase/decrease spacing of selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_linespacing');

		cy.contains('td','Increase Paragraph Spacing').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6700');

		impressHelper.selectTextOfShape();

		helper.clickOnIdle('#tb_editbar_item_linespacing');

		cy.contains('td','Decrease Paragraph Spacing').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');
	});
});
