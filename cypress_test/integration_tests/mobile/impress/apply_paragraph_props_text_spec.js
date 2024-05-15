/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Apply paragraph properties on selected text.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/apply_paragraph_props_text.odp');
		mobileHelper.enableEditingMobile();
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

	it('Apply horizontal alignment on selected text.', function() {
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set right alignment first
		openParagraphPropertiesPanel();
		cy.cGet('.unoRightPara').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Set left alignment
		openParagraphPropertiesPanel();
		cy.cGet('.unoLeftPara').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Set center alignment
		openParagraphPropertiesPanel();
		cy.cGet('.unoCenterPara').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '12493');

		// Set justified alignment
		openParagraphPropertiesPanel();
		cy.cGet('.unoJustifyPara').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Apply vertical alignment on selected text.', function() {
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		// Set bottom alignment
		openParagraphPropertiesPanel();
		cy.cGet('.unoCellVertBottom').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '10811');

		// Set top alignment
		openParagraphPropertiesPanel();
		cy.cGet('.unoCellVertTop').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '4834');

		// Set center alignment
		openParagraphPropertiesPanel();
		cy.cGet('.unoCellVertCenter').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition').should('have.attr', 'y');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition').invoke('attr', 'y').then(parseInt).should('be.closeTo', 7822, 5);
	});

	it('Apply default bulleting on selected text.', function() {
		selectText();
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		// Apply bulleting
		openListsPropertiesPanel();
		cy.cGet('#ListsPropertyPanel .unoDefaultBullet').click();
		mobileHelper.closeMobileWizard();

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
		openListsPropertiesPanel();
		cy.cGet('#ListsPropertyPanel .unoDefaultNumbering').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .SVGTextShape tspan')
			.should('have.attr', 'ooo:numbering-type', 'number-style');
	});

	it('Apply spacing above on selected text.', function() {
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		// Apply spacing above
		openParagraphPropertiesPanel();
		helper.typeIntoInputField('#aboveparaspacing input', '2', true, false);
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Apply spacing below on selected text.', function() {
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		// Apply spacing below
		openParagraphPropertiesPanel();
		helper.typeIntoInputField('#belowparaspacing input', '2', true, false);
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '11180');
	});

	it('Increase/decrease spacing of selected text.', function() {
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');

		// Increase spacing
		openParagraphPropertiesPanel();
		cy.cGet('.unoParaspaceIncrease').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6700');

		// Decrease spacing
		openParagraphPropertiesPanel();
		cy.cGet('.unoParaspaceDecrease').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph:nth-of-type(2) tspan')
			.should('have.attr', 'y', '6600');
	});

	it('Change writing direction of selected text.', function() {
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');

		// Change right-to-left first
		openParagraphPropertiesPanel();
		cy.cGet('.unoParaRightToLeft').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '23586');

		// Change back to the default left-to-right
		openParagraphPropertiesPanel();
		cy.cGet('.unoParaLeftToRight').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '1400');
	});

	it('Change bulleting level of selected text.', function() {
		selectText();
		// We have no bulleting by default
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('not.exist');

		// Apply bulleting first
		openListsPropertiesPanel();
		cy.cGet('#ListsPropertyPanel .unoDefaultBullet').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChars')
			.should('exist');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(1700,4563)');

		// Change bulleting level
		openListsPropertiesPanel();
		cy.cGet('.unoOutlineRight').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(2900,4536)');

		// Change bulleting level back to default
		openListsPropertiesPanel();
		cy.cGet('.unoOutlineLeft').click();
		mobileHelper.closeMobileWizard();

		impressHelper.removeShapeSelection();
		selectText();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .BulletChar:nth-of-type(2) g')
			.should('have.attr', 'transform', 'translate(1700,4563)');
	});
});
