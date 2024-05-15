/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Apply paragraph properties on selected shape.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/apply_paragraph_props_text.odp');
		desktopHelper.switchUIToCompact();
		cy.cGet('#modifypage').scrollIntoView();
		cy.cGet('#modifypage button').click();
		cy.cGet('#sidebar-panel').should('not.be.visible');
	});

	function selectText() {
		// Select the text in the shape by double
		// clicking in the center of the shape,
		// which is in the center of the slide,
		// which is in the center of the document

		// Only the svg (shape selection) is needed for the verifications,
		// but the text needs to be selected for the subsequent button clicks

		cy.cGet('#document-container').dblclick('center');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldExist();
	}

	it('Apply horizontal alignment on selected text.', function() {
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment
		cy.cGet('#rightpara').click();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Set left alignment
		cy.cGet('#leftpara').click();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set centered alignment
		cy.cGet('#centerpara').click();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');

		// Set justified alignment
		cy.cGet('#justifypara').click();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply default bulleting on selected text.', function() {
		selectText();
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		// Apply bulleting
		cy.cGet('#defaultbullet').click();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering on selected text.', function() {
		selectText();
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		// Apply numbering
		cy.cGet('#defaultnumbering').click();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Increase/decrease spacing of selected text.', function() {
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		// Increase spacing
		cy.cGet('#linespacing').click();
		cy.cGet('#linespacing-dropdown .ui-combobox-entry').contains('Increase Paragraph Spacing').click();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6700');

		// Decrease spacing
		cy.cGet('#linespacing').click();
		cy.cGet('#linespacing-dropdown .ui-combobox-entry').contains('Decrease Paragraph Spacing').click();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');
	});
});
