/* global describe it cy beforeEach require expect */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Apply paragraph properties on selected shape.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/apply_paragraph_props_text.odp');
		desktopHelper.switchUIToCompact();
		cy.cGet('#toolbar-up .ui-scroll-right').click();
		cy.cGet('#modifypage button').click({force: true});
		cy.cGet('#sidebar-panel').should('not.be.visible');
		cy.cGet('.close-navigation-button').click();
		cy.cGet('#navigator-sidebar').should('not.exist');
	});

	function selectText() {
		impressHelper.triggerNewSVGForShapeInTheCenter();
		impressHelper.selectTextOfShape();
	}

	it('Apply horizontal alignment on selected text.', function() {
		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment
		cy.cGet('#rightpara').click();

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.invoke('attr', 'x')
			.then((x) => {
				const value = Number(x);
				expect(value).to.be.closeTo(23583, 5);
			});

		// Set left alignment
		cy.cGet('#leftpara').click();

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set centered alignment
		cy.cGet('#centerpara').click();

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.invoke('attr', 'x')
			.then((x) => {
				const value = Number(x);
				expect(value).to.be.closeTo(12491, 5);
			});

		// Set justified alignment
		cy.cGet('#justifypara').click();

		selectText();
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply default bulleting on selected text.', function() {
		selectText();
		// We have no bulleting by default
		cy.cGet('#document-container g.Page .BulletChars')
			.should('not.exist');

		// Apply bulleting
		cy.cGet('#toolbar-up #defaultbullet').click();

		selectText();
		cy.cGet('#document-container g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering on selected text.', function() {
		selectText();
		// We have no bulleting by default
		cy.cGet('#document-container g.Page .SVGTextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		// Apply numbering
		cy.cGet('#toolbar-up #defaultnumbering').click();

		selectText();
		cy.cGet('#document-container g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Increase/decrease spacing of selected text.', function() {
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
