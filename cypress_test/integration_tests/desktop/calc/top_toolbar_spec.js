/* global describe it cy beforeEach require expect */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop'], 'Top toolbar tests.', function() {
	var origTestFileName = 'top_toolbar.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
		desktopHelper.switchUIToCompact();
		calcHelper.clickOnFirstCell();
	});

	it('Save.', { defaultCommandTimeout: 60000 }, function() {
		cy.cGet('#bold').click();
		cy.cGet('#save').click();

		helper.reload(testFileName, 'calc', true);
		cy.log('reload happened');
		helper.setDummyClipboardForCopy();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td b').should('exist');
	});

	it('Clone Formatting.', function() {
		helper.setDummyClipboardForCopy();
		helper.typeIntoDocument('{downarrow}');

		// Apply bold and try to clone it to the whole word.
		cy.cGet('#bold').click();
		cy.cGet('#toolbar-up #formatpaintbrush').click();

		calcHelper.clickOnFirstCell(true,false);

		helper.typeIntoDocument('{shift}{downarrow}');
		helper.copy();

		cy.wait(1000);

		cy.cGet('#copy-paste-container tbody').find('td b').each(($el) => {
			cy.wrap($el)
				.should('exist');
		});
	});

	it('Print', function() {
		// A new window should be opened with the PDF.
		cy.getFrameWindow()
			.then(function(win) {
				cy.stub(win, 'open').as('windowOpen');
			});

		cy.cGet('#toolbar-up #printoptions .arrowbackground').click();
		cy.cGet('body').contains('.ui-combobox-entry', 'Active Sheet').click();

		cy.get('@windowOpen').should('be.called');
	});

	it('Enable text wrapping.', function() {
		// Get cursor position at end of line before wrap
		calcHelper.dblClickOnFirstCell();
		helper.moveCursor('end');
		helper.getCursorPos('left', 'currentTextEndPos');

		cy.get('@currentTextEndPos').should('be.greaterThan', 0);

		helper.initAliasToNegative('originalTextEndPos');
		cy.get('@currentTextEndPos').then(function(pos) {
			cy.wrap(pos).as('originalTextEndPos');
		});

		// Leave cell
		helper.typeIntoDocument('{enter}');
		// Wait for enter to work before clicking on first cell again
		cy.cGet('input#addressInput').should('have.prop', 'value', 'A2');
		cy.wait(100);

		// Turn text wrap on
		calcHelper.clickOnFirstCell();
		cy.cGet('#toolbar-up .unoWrapText').click();

		// Leave cell
		helper.typeIntoDocument('{enter}');
		// Wait for enter to work before clicking on first cell again
		cy.cGet('input#addressInput').should('have.prop', 'value', 'A2');
		cy.wait(100);

		// Get cursor position at end of line after wrap
		calcHelper.dblClickOnFirstCell();
		helper.moveCursor('end');
		helper.getCursorPos('left', 'currentTextEndPos');

		cy.get('@currentTextEndPos').then(function(currentTextEndPos) {
			cy.get('@originalTextEndPos').then(function(originalTextEndPos) {
				expect(currentTextEndPos).to.be.lessThan(originalTextEndPos);
			});
		});
	});

	it('Merge cells', function() {

		// Select the full column
		calcHelper.selectFirstColumn();

		// Despite the selection is there, merge cells needs more time here.
		cy.wait(1000);

		cy.cGet('#toolbar-up #togglemergecells').click();

		desktopHelper.checkDialogAndClose('Merge Cells');
	});

	it('Clear Direct formatting.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#bold').click();

		calcHelper.selectEntireSheet();
		helper.copy();

		cy.cGet('#copy-paste-container table td b').should('exist');
		cy.cGet('#reset').click();

		calcHelper.selectEntireSheet();
		helper.copy();

		cy.cGet('#copy-paste-container table td b').should('not.exist');
	});

	it('Apply font style.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#toolbar-up #fontnamecombobox').click();
		desktopHelper.selectFromListbox('Alef');
		calcHelper.selectEntireSheet();
		helper.copy();
		helper.waitUntilIdle('#copy-paste-container');
		cy.cGet('#copy-paste-container table td font').should('have.attr', 'face', 'Alef');
	});

	it('Apply font size.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#toolbar-up #fontsizecombobox').click();
		desktopHelper.selectFromListbox('12');
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td font').should('have.attr', 'size', '3');
	});

	it('Apply bold font.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#bold').click();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td b').should('exist');
	});

	it('Apply underline.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#underline').click();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td u').should('exist');
	});

	it('Apply italic.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#italic').click();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td i').should('exist');
	});

	it('Apply strikethrough.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#strikeout').click();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td s').should('exist');
	});

	it('Apply highlight color.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#backgroundcolor .arrowbackground').click();
		desktopHelper.selectColorFromPalette('8E7CC3');
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'bgcolor', '#8E7CC3');
	});

	it('Apply font color.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#fontcolor .arrowbackground').click();
		desktopHelper.selectColorFromPalette('FFF2CC');
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td font').should('have.attr', 'color', '#FFF2CC');
	});

	it('Add/Delete decimal places', function() {
		helper.setDummyClipboardForCopy();
		// Add decimal place
		cy.cGet('#toolbar-up .ui-scroll-right').click();
		cy.cGet('#numberformatincdecimals').click();
		calcHelper.selectEntireSheet();
		helper.copy();

		var regex = new RegExp(';0;0.0$');
		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);

		// Delete Decimal place
		calcHelper.clickOnFirstCell();

		cy.cGet('#numberformatdecdecimals').click();

		calcHelper.selectEntireSheet();
		helper.copy();
		regex = new RegExp(';0;0$');
		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);
	});

	it('Format as currency.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#toolbar-up .ui-scroll-right').click();
		cy.cGet('#numberformatcurrency').click();

		calcHelper.selectEntireSheet();
		helper.copy();

		var regex = new RegExp(';0;\\[\\$\\$-409]#,##0.00;\\[RED]-\\[\\$\\$-409]#,##0.00$');
		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);
	});

	it('Format as Percent.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#toolbar-up .ui-scroll-right').click();
		cy.cGet('#numberformatpercent').click();

		calcHelper.selectEntireSheet();
		helper.copy();

		var regex = new RegExp(';0;0.00%$');
		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);
	});

	it('Apply left/right alignment', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('#toolbar-up .ui-scroll-right').click();
		// Set right aligment first
		cy.cGet('#textalign .arrowbackground').click();
		cy.cGet('body').contains('.ui-combobox-entry', 'Align Right').click();
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'align', 'right');

		// Change alignment back
		calcHelper.clickOnFirstCell();

		cy.cGet('#textalign .arrowbackground').click();
		cy.cGet('body').contains('.ui-combobox-entry', 'Align Left').click({force: true}); // tooltip
		calcHelper.selectEntireSheet();
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'align', 'left');
	});

});
