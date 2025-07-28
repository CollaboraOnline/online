/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Apply paragraph properties on selected shape.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/apply_paragraph_props_text.odp');
		desktopHelper.switchUIToCompact();

		cy.cGet('.close-navigation-button').click();
		cy.cGet('#navigator-sidebar').should('not.exist');

		desktopHelper.hideSidebarImpress();
		cy.wait(500);
	});

	function selectText() {
		impressHelper.triggerNewSVGForShapeInTheCenter();
		impressHelper.selectTextOfShape();
	}

	it.skip('Apply horizontal alignment on selected text.', function() {
		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment
		cy.cGet('#rightpara').click();
		cy.wait(500);

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition[x="23583"], #document-container g.Page .TextParagraph .TextPosition[x="23584"]')
			.should('exist');

		// Set left alignment
		cy.cGet('#leftpara').click();
		cy.wait(500);

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set centered alignment
		cy.cGet('#centerpara').click();
		cy.wait(500);

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition[x="12491"], #document-container g.Page .TextParagraph .TextPosition[x="12492"]')
			.should('exist');

		// Set justified alignment
		cy.cGet('#justifypara').click();
		cy.wait(500);

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply default bulleting on selected text.', function() {
		selectText();
		cy.wait(500);

		// We have no bulleting by default
		cy.cGet('#document-container g.Page .BulletChars')
			.should('not.exist');

		cy.cGet('#toolbar-up #overflow-button-other-toptoolbar .arrowbackground').click();

		// Apply bulleting
		cy.cGet('#defaultbullet').click();

		selectText();
		cy.cGet('#document-container g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering on selected text.', function() {
		selectText();
		cy.wait(500);

		// We have no bulleting by default
		cy.cGet('#document-container g.Page .SVGTextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		cy.cGet('#toolbar-up #overflow-button-other-toptoolbar .arrowbackground').click();

		// Apply numbering
		cy.cGet('#defaultnumbering').click();

		selectText();
		cy.cGet('#document-container g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	// FIXME: fails on 6600 might be related to recent core margin updates
	it.skip('Increase/decrease spacing of selected text.', function() {
		selectText();
		cy.cGet('#document-container g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		// Increase spacing
		cy.cGet('#linespacing').click();
		cy.cGet('#linespacing-dropdown .ui-combobox-entry').contains('Increase Paragraph Spacing').click();

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6700');

		// Decrease spacing
		cy.cGet('#linespacing').click();
		cy.cGet('#linespacing-dropdown .ui-combobox-entry').contains('Decrease Paragraph Spacing').click();

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');
	});
});
