/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Apply paragraph properties on selected shape.', function() {
	var origTestFileName = 'apply_paragraph_props_text.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		desktopHelper.switchUIToCompact();
		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		cy.cGet('#tb_editbar_item_modifypage').click();
		impressHelper.selectTextShapeInTheCenter();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply left/right alignment on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();
		cy.cGet('#tb_editbar_item_rightpara').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		cy.cGet('#tb_editbar_item_leftpara').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply center alignment on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();
		cy.cGet('#tb_editbar_item_centerpara').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');
	});

	it('Apply justified alignment on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();
		cy.cGet('#tb_editbar_item_rightpara').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		impressHelper.selectTextOfShape();
		cy.cGet('#tb_editbar_item_justifypara').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply default bulleting on selected text.', function() {
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		impressHelper.selectTextOfShape();
		cy.cGet('#tb_editbar_item_defaultbullet').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering on selected text.', function() {
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		impressHelper.selectTextOfShape();
		cy.cGet('#tb_editbar_item_defaultnumbering').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Increase/decrease spacing of selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressHelper.selectTextOfShape();
		cy.cGet('#tb_editbar_item_linespacing').click();
		cy.cGet('body').contains('td','Increase Paragraph Spacing').click();
		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6700');

		impressHelper.selectTextOfShape();
		cy.cGet('#tb_editbar_item_linespacing').click();
		cy.cGet('body').contains('td','Decrease Paragraph Spacing').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');
	});
});
