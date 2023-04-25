/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Apply paragraph properties on selected shape.', function() {
	var origTestFileName = 'apply_paragraph_props_shape.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

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

		cy.cGet('.unoParaLeftToRight').should('be.visible');
	}

	function openListsPropertiesPanel() {
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ListsPropertyPanel');

		cy.cGet('.unoDefaultBullet').should('be.visible');
	}

	it('Apply left/right alignment on text shape.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment first
		openParagraphPropertiesPanel();

		helper.clickOnIdle('.unoRightPara');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Set left alignment
		openParagraphPropertiesPanel();

		helper.clickOnIdle('.unoLeftPara');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply center alignment on text shape.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		openParagraphPropertiesPanel();

		helper.clickOnIdle('.unoCenterPara');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');
	});

	it('Apply justified alignment on text shape.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment first
		openParagraphPropertiesPanel();

		helper.clickOnIdle('.unoRightPara');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Then set justified alignment
		openParagraphPropertiesPanel();

		helper.clickOnIdle('.unoJustifyPara');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Set top/bottom alignment on text shape.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		// Set bottom alignment first
		openParagraphPropertiesPanel();

		helper.clickOnIdle('.unoCellVertBottom');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '10811');

		// Then set top alignment
		openParagraphPropertiesPanel();

		helper.clickOnIdle('.unoCellVertTop');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');
	});

	it('Apply center vertical alignment on text shape.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		openParagraphPropertiesPanel();

		helper.clickOnIdle('.unoCellVertCenter');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '7822');
	});

	it('Apply default bulleting on text shape.', function() {
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		openListsPropertiesPanel();

		helper.clickOnIdle('#ListsPropertyPanel .unoDefaultBullet');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it('Apply default numbering on text shape.', function() {
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		openListsPropertiesPanel();

		helper.clickOnIdle('#ListsPropertyPanel .unoDefaultNumbering');

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Apply spacing above on text shape.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		openParagraphPropertiesPanel();

		helper.typeIntoInputField('#aboveparaspacing input', '2', true, false);

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Apply spacing below on text shape.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		openParagraphPropertiesPanel();

		helper.typeIntoInputField('#belowparaspacing input', '2', true, false);

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});
});
