/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var calcHelper = require('../../common/calc_helper');

describe('Top toolbar tests.', function() {
	var testFileName = 'top_toolbar.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		calcHelper.clickOnFirstCell();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});
	function getTextEndPosForFirstCell() {
		calcHelper.dblClickOnFirstCell();

		helper.moveCursor('end');

		helper.getCursorPos('left', 'currentTextEndPos');
	}

	it.skip('Save.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		cy.get('#tb_editbar_item_save')
			.click();

		helper.beforeAll(testFileName, 'calc', true);

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td b')
			.should('exist');
	});

	it('Print', function() {
		// A new window should be opened with the PDF.
		cy.window()
			.then(function(win) {
				cy.stub(win, 'open');
			});

		cy.get('#tb_editbar_item_print')
		    .click();

		cy.window().its('open').should('be.called');
	});

	it('Enable text wrapping.', function() {
		getTextEndPosForFirstCell();

		helper.initAliasToNegative('originalTextEndPos');
		cy.get('@currentTextEndPos')
			.as('originalTextEndPos');

		cy.get('@currentTextEndPos')
			.should('be.greaterThan', 0);

		calcHelper.selectFirstColumn();

		cy.get('.w2ui-tb-image.w2ui-icon.wraptext')
			.click();

		calcHelper.clickOnFirstCell();

		// We use the text position as indicator
		cy.waitUntil(function() {
			getTextEndPosForFirstCell();

			return cy.get('@currentTextEndPos')
				.then(function(currentTextEndPos) {
					return cy.get('@originalTextEndPos')
						.then(function(originalTextEndPos) {
							return originalTextEndPos > currentTextEndPos;
						});
				});
		});
	});
	it('Merge cells', function() {

		// Select the full column
		calcHelper.selectFirstColumn();

		// Despite the selection is there, merge cells needs more time here.
		cy.wait(1000);

		cy.get('.w2ui-tb-image.w2ui-icon.togglemergecells')
			.click();

		desktopHelper.checkDialogAndClose('Merge Cells');
	});


	it('Remove cell border', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		//Add left border
		cy.get('.w2ui-tb-image.w2ui-icon.frame02')
			 .click({force: true});

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000');

		// Then remove it
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame01')
			 .click({force: true});

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('not.have.attr', 'style');
	});

	it('Apply left border', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame02')
			 .click({force: true});

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000');
	});

	it('Apply right border', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame03')
			 .click({force: true});

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-right: 1px solid #000000');
	});

	it('Apply left and right border', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame04')
			 .click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it('Apply top border', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame05')
			 .click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000');
	});

	it('Apply bottom border', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame06')
			 .click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-bottom: 1px solid #000000');
	});

	it('Apply top and bottom border', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame07')
			 .click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
	});

	it('Apply border for all sides', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame08')
			 .click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it('Apply horizontal borders for multiple cells', function() {
		calcHelper.selectEntireSheet();

		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame09')
			 .click();

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

		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame10')
			 .click();

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

		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame11')
			 .click();

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

		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame12')
			 .click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
				}
			});
	});

	it('Apply More Border styles', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame13')
		    .click();

		 desktopHelper.checkDialogAndClose('Format Cells');
	});

	it('Clear Direct formatting.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td b')
			.should('exist');

		cy.get('#tb_editbar_item_reset')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td b')
			.should('not.exist');

	});

	it('Apply font style.', function() {
		cy.get('#tb_editbar_item_fonts')
			.click();

		desktopHelper.selectFromListbox('Alef');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
		    .should('have.attr', 'face', 'Alef');
	});

	it('Apply font size.', function() {
		cy.get('#tb_editbar_item_fontsizes')
			.click();

		desktopHelper.selectFromListbox('12');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
		    .should('have.attr', 'size', '3');
	});

	it('Apply bold font.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td b')
			.should('exist');
	});

	it('Apply underline.', function() {
		cy.get('#tb_editbar_item_underline')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td u')
			.should('exist');
	});

	it('Apply italic.', function() {
		cy.get('#tb_editbar_item_italic')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td i')
			.should('exist');
	});

	it('Apply strikethrough.', function() {
		cy.get('#tb_editbar_item_strikeout')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td s')
			.should('exist');
	});

	it('Apply highlight color.', function() {
		cy.get('#tb_editbar_item_backgroundcolor')
			.click();

		desktopHelper.selectColorFromPalette('8E7CC3');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'bgcolor', '#8E7CC3');
	});

	it('Apply font color.', function() {
		cy.get('#tb_editbar_item_fontcolor')
			.click();

		desktopHelper.selectColorFromPalette('FFF2CC');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'color', '#FFF2CC');
	});

	it('Add/Delete decimal places', function() {
		// Add decimal place
		cy.get('#tb_editbar_item_numberformatincdecimals')
			.click();

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';0;0.0$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		// Delete Decimal place
		calcHelper.clickOnFirstCell();

		cy.get('#tb_editbar_item_numberformatdecdecimals')
			.click();

		calcHelper.selectEntireSheet();

		regex = new RegExp(';0;0$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);
	});

	it('Format as currency.', function() {
		cy.get('#tb_editbar_item_numberformatcurrency')
			.click();

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';0;\\[\\$\\$-409]#,##0.00;\\[RED]-\\[\\$\\$-409]#,##0.00$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);
	});

	it('Format as Percent.', function() {
		cy.get('#tb_editbar_item_numberformatpercent')
			.click();

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';0;0.00%$');
		cy.get('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);
	});

	it('Apply left/right alignment', function() {
		// Set right aligment first
		cy.get('#tb_editbar_item_textalign .w2ui-tb-down')
			.click();

		cy.contains('.menu-text', 'Align Right')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'right');

		// Change alignment back
		calcHelper.clickOnFirstCell();

		cy.get('#tb_editbar_item_textalign .w2ui-tb-down')
			.click();

		cy.contains('.menu-text', 'Align Left')
			.click({force: true}); // tooltip

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'left');
	});

});
