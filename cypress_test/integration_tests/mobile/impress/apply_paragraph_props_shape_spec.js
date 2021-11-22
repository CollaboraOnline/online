/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe('Apply paragraph properties on selected shape.', function() {
	var testFileName = 'apply_paragraph_props_shape.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		impressHelper.selectTextShapeInTheCenter();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();

		cy.wait(1000);

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.wait(1000);
	}

	function openParagraphPropertiesPanel() {
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ParaPropertyPanel');

		cy.get('#ParaLeftToRight')
			.should('be.visible');
	}

	function openListsPropertiesPanel() {
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ListsPropertyPanel');

		cy.get('#DefaultBullet')
			.should('be.visible');
	}

	it('Apply left/right alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment first
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#RightPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Set left alignment
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#LeftPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply center alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		openParagraphPropertiesPanel();

		helper.clickOnIdle('#CenterPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');
	});

	it('Apply justified alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment first
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#RightPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Then set justified alignment
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#JustifyPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Set top/bottom alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		// Set bottom alignment first
		openParagraphPropertiesPanel();

		helper.clickOnIdle('.unoCellVertBottom');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '10811');

		// Then set top alignment
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#CellVertTop');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');
	});

	it('Apply center vertical alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		openParagraphPropertiesPanel();

		helper.clickOnIdle('#CellVertCenter');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '7823');
	});

	it('Apply default bulleting on text shape.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		openListsPropertiesPanel();

		helper.clickOnIdle('#DefaultBullet');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering on text shape.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		openListsPropertiesPanel();

		helper.clickOnIdle('#DefaultNumbering');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Apply spacing above on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		openParagraphPropertiesPanel();

		helper.typeIntoInputField('#aboveparaspacing input', '2', true, false);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Apply spacing below on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		openParagraphPropertiesPanel();

		helper.typeIntoInputField('#belowparaspacing input', '2', true, false);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});
});
