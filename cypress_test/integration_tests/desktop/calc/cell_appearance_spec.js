/* global describe it cy beforeEach require expect Cypress */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Change cell appearance.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/cell_appearance.ods');
	});

	it('Apply background color', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		cy.cGet('#Home').click();
		cy.cGet('#Home-container .unoBackgroundColor .arrowbackground').click();
		desktopHelper.selectColorFromPalette('BF0041');
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'bgcolor', '#BF0041');
	});

	it('Apply left border', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame02').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'style', 'border-left: 1px solid #000000');
	});

	it('Remove cell border', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		// First add left border
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame02').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		helper.copy();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'style', 'border-left: 1px solid #000000');
		// Then remove it
		calcHelper.clickOnFirstCell();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame01').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		helper.copy();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td').should('not.have.attr', 'style');
	});

	it('Apply right border', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame03').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'style', 'border-right: 1px solid #000000');
	});

	it('Apply left and right border', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame04').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		helper.copy();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it('Apply top border', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame05').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		helper.copy();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'style', 'border-top: 1px solid #000000');
	});

	it('Apply bottom border', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame06').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		helper.copy();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'style', 'border-bottom: 1px solid #000000');
	});

	it('Apply top and bottom border', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame07').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		helper.copy();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
	});

	it('Apply border for all sides', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame08').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		helper.copy();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it('Apply horizontal borders for multiple cells', function() {
		desktopHelper.switchUIToNotebookbar();
		calcHelper.selectEntireSheet();
		// Click on the one in notebookbar (not sidebar).
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame09').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		calcHelper.selectEntireSheet();

		// copy-paste container is not stable for now.
		//cy.cGet('#copy-paste-container table td').should(function(cells) {
		//		expect(cells).to.have.lengthOf(4);
		//		for (var i = 0; i < cells.length; i++) {
		//			expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
		//		}
		//	});
	});

	it('Apply horizontal inner borders and vertical outer borders', function() {
		desktopHelper.switchUIToNotebookbar();
		calcHelper.selectEntireSheet();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame10').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		calcHelper.selectEntireSheet();
		//cy.cGet('#copy-paste-container table td')
		//	.should(function(cells) {
		//		expect(cells).to.have.lengthOf(4);
		//		for (var i = 0; i < cells.length; i++) {
		//			if (i == 0 || i == 2)
		//				expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000');
		//			else
		//				expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
		//		}
		//	});
	});

	it('Apply vertical inner borders and horizontal outer borders', function() {
		desktopHelper.switchUIToNotebookbar();
		calcHelper.selectEntireSheet();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame11').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		calcHelper.selectEntireSheet();
		//cy.cGet('#copy-paste-container table td')
		//	.should(function(cells) {
		//		expect(cells).to.have.lengthOf(4);
		//		for (var i = 0; i < cells.length; i++) {
		//			if (i == 0 || i == 1)
		//				expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
		//			else
		//				expect(cells[i]).to.have.attr('style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
		//		}
		//	});
	});

	it('Apply all inner and outer borders', function() {
		desktopHelper.switchUIToNotebookbar();
		calcHelper.selectEntireSheet();
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame12').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		calcHelper.selectEntireSheet();
		//cy.cGet('#copy-paste-container table td')
		//	.should(function(cells) {
		//		expect(cells).to.have.lengthOf(4);
		//		for (var i = 0; i < cells.length; i++) {
		//			expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
		//		}
		//	});
	});

	it('Apply border color', function() {
		helper.setDummyClipboardForCopy();
		desktopHelper.switchUIToNotebookbar();
		calcHelper.clickOnFirstCell();
		// Apply left border first
		cy.cGet('.notebookbar .unoSetBorderStyle').click();
		cy.wait(500);
		cy.cGet('.w2ui-tb-image.w2ui-icon.frame02').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();

		cy.wait(500); // Wait for first popup to close.

		// Then apply border color
		cy.cGet('#FrameLineColor .arrowbackground').click();
		desktopHelper.selectColorFromPalette('BF0041');
		helper.copy();
		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #bf0041');
	});
});
