/* global cy expect Cypress require */

var helper = require('./helper');

// Click on the formula bar.
// mouseover is triggered to avoid leaving the mouse on the Formula-Bar,
// which shows the tooltip and messes up tests.
function clickFormulaBar() {

	// The inputbar_container is 100% width, which
	// can extend behind the sidebar. So we can't
	// rely on its width. Instead, we rely on the
	// canvas, which is accurately sized.
	// N.B. Setting the width of the inputbar_container
	// is futile because it messes the size of the canvas.
	cy.get('.inputbar_canvas')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().width / 2;
			var YPos = items[0].getBoundingClientRect().height / 2;
			cy.get('.inputbar_container')
				.click(XPos, YPos);
		});

	cy.get('body').trigger('mouseover');
}

function clickOnFirstCell(firstClick = true, dblClick = false) {
	cy.log('Clicking on first cell - start.');
	cy.log('Param - firstClick: ' + firstClick);
	cy.log('Param - dblClick: ' + dblClick);

	// Use the tile's edge to find the first cell's position
	cy.get('#map')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().left + 10;
			var YPos = items[0].getBoundingClientRect().top + 10;
			if (dblClick) {
				cy.get('body')
					.dblclick(XPos, YPos);
			} else {
				cy.get('body')
					.click(XPos, YPos);
			}
		});

	if (firstClick && !dblClick) {
		cy.get('.spreadsheet-cell-autofill-marker')
			.should('be.visible');

		helper.doIfOnMobile(function() {
			cy.get('.spreadsheet-cell-resize-marker[style=\'transform: translate3d(-8px, -8px, 0px); z-index: -8;')
				.should('be.visible');
		});
	} else
		cy.get('.leaflet-cursor.blinking-cursor')
			.should('be.visible');

	cy.get('input#addressInput')
		.should('have.prop', 'value', 'A1');

	cy.log('Clicking on first cell - end.');
}

function dblClickOnFirstCell() {
	clickOnFirstCell(false, true);
}

function typeIntoFormulabar(text) {
	cy.log('Typing into formulabar - start.');

	cy.get('#calc-inputbar .lokdialog-cursor')
		.then(function(cursor) {
			if (!Cypress.dom.isVisible(cursor)) {
				clickFormulaBar();
			}
		});

	cy.get('#calc-inputbar .lokdialog-cursor')
		.should('be.visible');

	helper.doIfOnMobile(function() {
		cy.get('#tb_actionbar_item_acceptformula')
			.should('be.visible');

		cy.get('#tb_actionbar_item_cancelformula')
			.should('be.visible');
	});

	cy.get('body')
		.type(text);

	cy.log('Typing into formulabar - end.');
}

module.exports.clickOnFirstCell = clickOnFirstCell;
module.exports.dblClickOnFirstCell = dblClickOnFirstCell;
module.exports.clickFormulaBar = clickFormulaBar;
module.exports.typeIntoFormulabar = typeIntoFormulabar;
