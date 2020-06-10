/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressMobileHelper = require('./impress_mobile_helper');

describe('Apply paragraph properties.', function() {
	var testFileName = 'apply_paragraph_props.odp';

	beforeEach(function() {
		mobileHelper.beforeAllMobile(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		impressMobileHelper.selectTextShapeInTheCenter();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	function triggerNewSVG() {
		impressMobileHelper.triggerNewSVGForShapeInTheCenter();
	}

	function openParagraphPropertiesPanel() {
		mobileHelper.openMobileWizard();

		cy.get('#ParaPropertyPanel')
			.click();

		cy.get('.ui-content.level-0.mobile-wizard')
			.should('be.visible');
	}

	function openListsPropertiesPanel() {
		mobileHelper.openMobileWizard();

		cy.get('#ListsPropertyPanel')
			.click();

		cy.get('.ui-content.level-0.mobile-wizard')
			.should('be.visible');
	}

	it('Apply left/right alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment first
		openParagraphPropertiesPanel();

		cy.get('#RightPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Set left alignment
		openParagraphPropertiesPanel();

		cy.get('#LeftPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply center alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		openParagraphPropertiesPanel();

		cy.get('#CenterPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');
	});

	it('Apply justified alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment first
		openParagraphPropertiesPanel();

		cy.get('#RightPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Then set justified alignment
		openParagraphPropertiesPanel();

		cy.get('#JustifyPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Set top/bottom alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		// Set bottom alignment first
		openParagraphPropertiesPanel();

		cy.get('#CellVertBottom')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '10811');

		// Then set top alignment
		openParagraphPropertiesPanel();

		cy.get('#CellVertTop')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');
	});

	it('Apply center vertical alignment on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		openParagraphPropertiesPanel();

		cy.get('#CellVertCenter')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '7823');
	});

	it('Apply default bulleting on text shape.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		openListsPropertiesPanel();

		cy.get('#DefaultBullet')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering on text shape.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		openListsPropertiesPanel();

		cy.get('#DefaultNumbering')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Apply spacing above on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		openParagraphPropertiesPanel();

		cy.get('#aboveparaspacing input')
			.clear()
			.type('2{enter}');

		cy.get('#aboveparaspacing input')
			.should('have.attr', 'value', '2');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Apply spacing below on text shape.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		openParagraphPropertiesPanel();

		cy.get('#belowparaspacing input')
			.clear()
			.type('2{enter}');

		cy.get('#belowparaspacing input')
			.should('have.attr', 'value', '2');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Apply left/right alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressMobileHelper.selectTextOfShape();

		// Set right alignment first
		openParagraphPropertiesPanel();

		cy.get('#RightPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Set left alignment
		impressMobileHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.get('#LeftPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply center alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressMobileHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.get('#CenterPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');
	});

	it('Apply justified alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressMobileHelper.selectTextOfShape();

		// Set right alignment first
		openParagraphPropertiesPanel();

		cy.get('#RightPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		impressMobileHelper.selectTextOfShape();

		// Then set justified alignment
		openParagraphPropertiesPanel();

		cy.get('#JustifyPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Set top/bottom alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		impressMobileHelper.selectTextOfShape();

		// Set bottom alignment first
		openParagraphPropertiesPanel();

		cy.get('#CellVertBottom')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '10811');

		impressMobileHelper.selectTextOfShape();

		// Then set top alignment
		openParagraphPropertiesPanel();

		cy.get('#CellVertTop')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');
	});

	it('Apply center vertical alignment on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		impressMobileHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.get('#CellVertCenter')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '7823');
	});

	it('Apply default bulleting on selected text.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		impressMobileHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.get('#DefaultBullet')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering on selected text.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		impressMobileHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.get('#DefaultNumbering')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Apply spacing above on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressMobileHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.get('#aboveparaspacing input')
			.clear()
			.type('2{enter}');

		cy.get('#aboveparaspacing input')
			.should('have.attr', 'value', '2');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Apply spacing below on selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressMobileHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.get('#belowparaspacing input')
			.clear()
			.type('2{enter}');

		cy.get('#belowparaspacing input')
			.should('have.attr', 'value', '2');

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Increase/decrease spacing of selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressMobileHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.get('#ParaspaceIncrease')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6700');

		impressMobileHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.get('#ParaspaceDecrease')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');
	});

	it('Change writing direction of selected text.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Change right-to-left first
		impressMobileHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.get('#ParaRightToLeft')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Change back to the default left-to-right
		impressMobileHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.get('#ParaLeftToRight')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Change bulleting level of selected text.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		// Apply bulleting first
		impressMobileHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.get('#DefaultBullet')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(1700,4563)');

		// Change bulleting level
		impressMobileHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.get('#OutlineRight')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(2900,4536)');

		// Change bulleting level back to default
		impressMobileHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.get('#OutlineLeft')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(1700,4563)');
	});
});
