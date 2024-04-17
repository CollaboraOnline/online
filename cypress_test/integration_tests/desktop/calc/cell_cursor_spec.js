/* global describe it cy beforeEach expect require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Test jumping on large cell selection', function() {
	var testFileName = 'cell_cursor.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
		desktopHelper.switchUIToCompact();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#sidebar').click({force: true});
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('No jump on long merged cell', function() {
		desktopHelper.assertScrollbarPosition('horizontal', 205, 315);
		calcHelper.clickOnFirstCell(true, false, false);
		cy.cGet('input#addressInput').should('have.prop', 'value', 'A1:Z1');
		desktopHelper.assertScrollbarPosition('horizontal', 205, 315);
	});
});

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Test jumping on large cell selection with split panes', function() {
	var testFileName = 'cell_cursor_split.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
		desktopHelper.switchUIToCompact();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#sidebar').click({force: true});
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
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

		cy.cGet('input#addressInput').should('have.prop', 'value', 'B2:AA2');
		desktopHelper.assertScrollbarPosition('horizontal', 270, 390);
	});
});
