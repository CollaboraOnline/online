/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Top toolbar tests.', function() {
	var origTestFileName = 'top_toolbar.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		} else {
			desktopHelper.hideSidebar();
		}

		impressHelper.selectTextShapeInTheCenter();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply bold on text shape.', function() {
		cy.cGet('#tb_editbar_item_bold').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-weight', '700');
	});

	it('Apply italic on text shape.', function() {
		cy.cGet('#tb_editbar_item_italic').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-style', 'italic');
	});

	it('Apply underline on text shape.', function() {
		cy.cGet('#tb_editbar_item_underline')
			.click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'underline');
	});

	it('Apply strikethrough on text shape.', function() {
		cy.cGet('#tb_editbar_item_strikeout').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'text-decoration', 'line-through');
	});

	it('Apply font color on text shape.', function() {
		cy.cGet('#tb_editbar_item_fontcolor')
			.click();

		desktopHelper.selectColorFromPalette('FF011B');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape .TextParagraph .TextPosition tspan')
			.should('have.attr', 'fill', 'rgb(255,1,27)');
	});

	it('Apply highlight color on text shape.', function() {
		cy.cGet('#tb_editbar_item_backcolor').click();

		desktopHelper.selectColorFromPalette('FF9838');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.wait(500);

		//highlight color is not in the SVG
		// that's why we didn't test there

	});

	it('Apply a selected font name on the text shape', function() {
		cy.cGet('#tb_editbar_item_fonts').click();

		desktopHelper.selectFromListbox('Liberation Mono');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape .TextParagraph')
			.should('have.attr', 'font-family', 'Liberation Mono');
	});

	it('Apply a selected font size on the text shape', function() {

		cy.cGet('#tb_editbar_item_fontsizes').click();

		desktopHelper.selectFromListbox('22');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape .TextParagraph')
			.should('have.attr', 'font-size', '776px');
	});

	it('Apply left/right alignment on text selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment first
		impressHelper.selectTextOfShape();

		cy.cGet('#tb_editbar_item_rightpara').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition').should('have.attr', 'x', '24526');

		// Set left alignment
		impressHelper.selectTextOfShape();

		cy.cGet('#tb_editbar_item_leftpara').click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition').should('have.attr', 'x', '1400');
	});

	it('Apply superscript on selected text.', function() {
		impressHelper.selectTextOfShape();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '8643');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '1129px');

		helper.typeIntoDocument('{ctrl}{shift}p');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '8271');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '655px');
	});

	it('Apply subscript on selected text.', function() {
		impressHelper.selectTextOfShape();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '8643');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '1129px');

		helper.typeIntoDocument('{ctrl}{shift}b');

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextPosition')
			.should('have.attr', 'y', '8734');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-size', '655px');
	});
});
