/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe('Apply paragraph properties on selected text.', function() {
	var testFileName = 'apply_paragraph_props_text.odp';

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
		impressHelper.triggerNewSVGForShapeInTheCenter();
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

	it.skip('Apply left/right alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();

		// Set right alignment first
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#RightPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Set left alignment
		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.clickOnIdle('#LeftPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply center alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.clickOnIdle('#CenterPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');
	});

	it.skip('Apply justified alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();

		// Set right alignment first
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#RightPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		impressHelper.selectTextOfShape();

		// Then set justified alignment
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#JustifyPara');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it.skip('Set top/bottom alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		impressHelper.selectTextOfShape();

		// Set bottom alignment first
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#CellVertBottom');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '10810');

		impressHelper.selectTextOfShape();

		// Then set top alignment
		openParagraphPropertiesPanel();

		helper.clickOnIdle('#CellVertTop');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');
	});

	it('Apply center vertical alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.clickOnIdle('#CellVertCenter');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '7822');
	});

	it('Apply default bulleting on selected text.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		helper.clickOnIdle('#DefaultBullet');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering on selected text.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		helper.clickOnIdle('#DefaultNumbering');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Apply spacing above on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.typeIntoInputField('#aboveparaspacing input', '2', true, false);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Apply spacing below on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.typeIntoInputField('#belowparaspacing input', '2', true, false);

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Increase/decrease spacing of selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.clickOnIdle('#ParaspaceIncrease');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6700');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.clickOnIdle('#ParaspaceDecrease');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');
	});

	it.skip('Change writing direction of selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Change right-to-left first
		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.clickOnIdle('#ParaRightToLeft');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Change back to the default left-to-right
		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.clickOnIdle('#ParaLeftToRight');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it.skip('Change bulleting level of selected text.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		// Apply bulleting first
		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		helper.clickOnIdle('#DefaultBullet');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(1700,4563)');

		// Change bulleting level
		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		helper.clickOnIdle('#OutlineRight');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(2900,4536)');

		// Change bulleting level back to default
		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		helper.clickOnIdle('#OutlineLeft');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(1700,4563)');
	});
});
