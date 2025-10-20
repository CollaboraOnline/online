/* global describe it cy beforeEach expect require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Test jumping on large cell selection', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/cell_cursor.ods');
	});

	it('No jump on long merged cell', function() {
		desktopHelper.assertScrollbarPosition('horizontal', 205, 330);
		calcHelper.clickOnFirstCell(true, false, false);

		cy.cGet(helper.addressInputSelector).should('have.value', 'A1:Z1');
		desktopHelper.assertScrollbarPosition('horizontal', 205, 330);
	});

	it('Jump on address with not visible cursor', function() {
		desktopHelper.assertScrollbarPosition('vertical', 0, 30);
		cy.cGet(helper.addressInputSelector).should('have.value', 'Z11');

		helper.typeIntoInputField(helper.addressInputSelector, 'A110');
		desktopHelper.assertScrollbarPosition('vertical', 205, 330);
	});

	it('Jump on search with not visible cursor', function() {
		desktopHelper.assertScrollbarPosition('vertical', 0, 30);
		cy.cGet(helper.addressInputSelector).should('have.value', 'Z11');

		desktopHelper.assertScrollbarPosition('horizontal', 205, 330);
		helper.typeIntoDocument('{ctrl}f');
		cy.cGet('input#searchterm-input-dialog').clear().type('FIRST');
		cy.cGet('#search').find('button').click();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A10');
		desktopHelper.assertScrollbarPosition('horizontal', 40, 60);
	});

	it('Show cursor on sheet insertion', function() {
		// scroll down
		helper.typeIntoInputField(helper.addressInputSelector, 'A110');
		desktopHelper.assertScrollbarPosition('vertical', 205, 330);

		// insert sheet before
		calcHelper.selectOptionFromContextMenu('Insert sheet before this');

		// we should see the top left corner of the sheet
		cy.cGet(helper.addressInputSelector).should('have.value', 'A1');
		desktopHelper.assertScrollbarPosition('vertical', 0, 30);
	});
});

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Test Cell Selections', function() {
	beforeEach(function() {
		helper.setupAndLoadDocument('calc/empty-selections.ods');

		cy.cGet('[id="SidebarDeck.PropertyDeck"]').click();
		cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');
	});

	it('Check non-range cell selection with CTRL', function() {
		calcHelper.clickOnACell(1, 1, 2, 3);

		// Press CTRL and hold.
		cy.cGet('div.clipboard').type('{ctrl}', { release: false });

		cy.wait(500);
		calcHelper.clickOnACell(2, 3, 4, 3);

		cy.wait(500);
		calcHelper.clickOnACell(4, 3, 2, 6);

		// Press SHIFT and hold.
		cy.cGet('div.clipboard').type('{shift}', { release: false });

		cy.wait(500);
		calcHelper.clickOnACell(2, 6, 2, 10);

		cy.wait(500);

		cy.cGet('#document-container').compareSnapshot('selections', 0.02);
	});
});

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Test jumping on large cell selection with split panes', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/cell_cursor_split.ods');
	});

	it('No jump on long merged cell with split panes', function() {
		desktopHelper.assertScrollbarPosition('horizontal', 270, 390);

		// Click on second cell in second row
		cy.cGet('#map')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().left + 140;
			var YPos = items[0].getBoundingClientRect().top + 30;
			cy.cGet('body').click(XPos, YPos);
		});

		cy.cGet(helper.addressInputSelector).should('have.value', 'B2:AA2');
		desktopHelper.assertScrollbarPosition('horizontal', 270, 390);
	});
});

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Test decimal separator of cells with different languages.', function() {
	beforeEach(function() {
		helper.setupAndLoadDocument('calc/decimal_separator.ods');
	});

	it('Check different decimal separators', function() {
		helper.typeIntoInputField(helper.addressInputSelector, 'A1');
		cy.wait(400);

		cy.window().then(win => {
			var app = win['0'].app;
			cy.expect(app.calc.decimalSeparator).to.be.equal('.');
		});

		helper.typeIntoInputField(helper.addressInputSelector, 'B1');
		cy.wait(400);

		cy.window().then(win => {
			var app = win['0'].app;
			cy.expect(app.calc.decimalSeparator).to.be.equal(',');
		});
	});
});
