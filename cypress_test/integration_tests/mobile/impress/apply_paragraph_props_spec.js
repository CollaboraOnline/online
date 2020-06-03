/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Apply paragraph properties.', function() {
	var testFileName = 'apply_paragraph_props.odp';

	beforeEach(function() {
		mobileHelper.beforeAllMobile(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		selectTextShape();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	function selectTextShape() {
		// Click on the center of the slide to select the text shape there
		cy.get('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.get('body')
					.click(XPos, YPos);
			});

		cy.get('.leaflet-drag-transform-marker')
			.should('be.visible');

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'Outline');
	}

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();

		// Remove selection first with clicking next to the rotate handler
		cy.get('.transform-handler--rotate')
			.then(function(items) {
				var XPos = items[0].getBoundingClientRect().left - 10;
				var YPos = items[0].getBoundingClientRect().top;
				cy.get('body')
					.click(XPos, YPos);

				cy.get('body')
					.dblclick(XPos, YPos);
			});

		cy.get('.leaflet-drag-transform-marker')
			.should('not.exist');

		// If we click two fast on shape again
		// then it steps into edit mode
		cy.wait(200);

		// Select text shape again which will retrigger a new SVG from core
		selectTextShape();
	}

	function openParagraphPropertiesPanel() {
		mobileHelper.openMobileWizard();

		cy.get('#ParaPropertyPanel')
			.click();

		cy.get('.ui-content.level-0.mobile-wizard')
			.should('be.visible');
	}

	it('Apply left/right alignment.', function() {
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

	it('Apply center alignment.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		openParagraphPropertiesPanel();

		cy.get('#CenterPara')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');
	});

	it('Apply justified alignment.', function() {
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

	it('Set top/bottom alignment.', function() {
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

	it('Apply center vertical alignment.', function() {
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		openParagraphPropertiesPanel();

		cy.get('#CellVertCenter')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '7823');
	});

	it('Apply default bulleting.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		openParagraphPropertiesPanel();

		cy.get('#DefaultBullet')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering.', function() {
		// We have no bulleting by default
		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		openParagraphPropertiesPanel();

		cy.get('#DefaultNumbering')
			.click();

		triggerNewSVG();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Apply spacing above.', function() {
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

	it('Apply spacing below.', function() {
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
});
