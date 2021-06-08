/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Change cell appearance.', function() {
	var testFileName = 'cell_appearance.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply background color', function() {
		calcHelper.clickOnFirstCell();

		desktopHelper.actionOnSelector('backgroundColor', (selector) => { helper.clickOnIdle(selector); });

		desktopHelper.selectColorFromPalette('006CE7');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'bgcolor', '#006CE7');
	});

	it('Apply left border', function() {
		calcHelper.clickOnFirstCell();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame02').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000');
	});

	it('Remove cell border', function() {
		calcHelper.clickOnFirstCell();

		// First add left border
		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame02').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000');

		// Then remove it
		calcHelper.clickOnFirstCell();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame01').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('not.have.attr', 'style');
	});

	it('Apply right border', function() {
		calcHelper.clickOnFirstCell();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame03').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-right: 1px solid #000000');
	});

	it('Apply left and right border', function() {
		calcHelper.clickOnFirstCell();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame04').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it('Apply top border', function() {
		calcHelper.clickOnFirstCell();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame05').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000');
	});

	it('Apply bottom border', function() {
		calcHelper.clickOnFirstCell();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame06').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-bottom: 1px solid #000000');
	});

	it('Apply top and bottom border', function() {
		calcHelper.clickOnFirstCell();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame07').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
	});

	it('Apply border for all sides', function() {
		calcHelper.clickOnFirstCell();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame08').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it('Apply horizontal borders for multiple cells', function() {
		calcHelper.selectEntireSheet();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame09').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
				}
			});
	});

	it('Apply horizontal inner borders and vertical outer borders', function() {
		calcHelper.selectEntireSheet();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame10').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					if (i == 0 || i == 2)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000');
					else
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
				}
			});
	});

	it('Apply vertical inner borders and horizontal outer borders', function() {
		calcHelper.selectEntireSheet();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame11').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					if (i == 0 || i == 1)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
					else
						expect(cells[i]).to.have.attr('style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
				}
			});
	});

	it('Apply all inner and outer borders', function() {
		calcHelper.selectEntireSheet();

		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame12').click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
				}
			});
	});

	it('Apply border color', function() {
		calcHelper.clickOnFirstCell();

		// Apply left border first
		desktopHelper.actionOnSelector('borderStyle', (selector) => { helper.clickOnIdle(selector); });

		cy.get('.w2ui-tb-image.w2ui-icon.frame02').click();

		// Then apply border color
		helper.clickOnIdle('#FrameLineColor');

		desktopHelper.selectColorFromPalette('006CE7');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #006ce7');
	});

});
