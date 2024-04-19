/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Apply paragraph properties on selected text.', function() {
	var origTestFileName = 'apply_paragraph_props_text.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		mobileHelper.enableEditingMobile();

		impressHelper.selectTextShapeInTheCenter();
	});

	function triggerNewSVG() {
		mobileHelper.closeMobileWizard();
		impressHelper.triggerNewSVGForShapeInTheCenter();
	}

	function openParagraphPropertiesPanel() {
		mobileHelper.openMobileWizard();

		cy.cGet('#ParaPropertyPanel').click();

		cy.cGet('.unoParaLeftToRight').should('be.visible');
	}

	function openListsPropertiesPanel() {
		mobileHelper.openMobileWizard();

		cy.cGet('#ListsPropertyPanel').click();

		cy.cGet('.unoDefaultBullet').should('be.visible');
	}

	it('Apply left/right alignment on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();

		// Set right alignment first
		openParagraphPropertiesPanel();

		cy.cGet('.unoRightPara').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Set left alignment
		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.cGet('.unoLeftPara').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply center alignment on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.cGet('.unoCenterPara').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');
	});

	it('Apply justified alignment on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		impressHelper.selectTextOfShape();

		// Set right alignment first
		openParagraphPropertiesPanel();

		cy.cGet('.unoRightPara').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		impressHelper.selectTextOfShape();

		// Then set justified alignment
		openParagraphPropertiesPanel();

		cy.cGet('.unoJustifyPara').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Set top/bottom alignment on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		impressHelper.selectTextOfShape();

		// Set bottom alignment first
		openParagraphPropertiesPanel();

		cy.cGet('.unoCellVertBottom').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '10811');

		impressHelper.selectTextOfShape();

		// Then set top alignment
		openParagraphPropertiesPanel();

		cy.cGet('.unoCellVertTop').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');
	});

	it('Apply center vertical alignment on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.cGet('.unoCellVertCenter').click();

		triggerNewSVG();

		cy.wait(2000);

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition').should('have.attr', 'y');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition').invoke('attr', 'y').then(parseInt).should('be.closeTo', 7822, 5);
	});

	it('Apply default bulleting on selected text.', function() {
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.cGet('#ListsPropertyPanel .unoDefaultBullet').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
	});

	it.skip('Apply default numbering on selected text.', function() {
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('not.have.attr', 'ooo:numbering-type');

		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.cGet('#ListsPropertyPanel .unoDefaultNumbering').click();

		triggerNewSVG();

		// TODO: SVG does not get retriggered

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Apply spacing above on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.typeIntoInputField('#aboveparaspacing input', '2', true, false);

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Apply spacing below on selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		helper.typeIntoInputField('#belowparaspacing input', '2', true, false);

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Increase/decrease spacing of selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.cGet('.unoParaspaceIncrease').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6700');

		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.cGet('.unoParaspaceDecrease').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');
	});

	it('Change writing direction of selected text.', function() {
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Change right-to-left first
		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.cGet('.unoParaRightToLeft').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Change back to the default left-to-right
		impressHelper.selectTextOfShape();

		openParagraphPropertiesPanel();

		cy.cGet('.unoParaLeftToRight').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Change bulleting level of selected text.', function() {
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		// Apply bulleting first
		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.cGet('#ListsPropertyPanel .unoDefaultBullet').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(1700,4563)');

		// Change bulleting level
		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.cGet('.unoOutlineRight').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(2900,4536)');

		// Change bulleting level back to default
		impressHelper.selectTextOfShape();

		openListsPropertiesPanel();

		cy.cGet('.unoOutlineLeft').click();

		triggerNewSVG();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(1700,4563)');
	});
});
