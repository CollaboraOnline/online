/* global cy expect */

function removeTextSelection() {
	cy.log('Removing text selection - start.');

	cy.get('.spreadsheet-header-columns')
		.click();

	var regex = /[A-Z]1:[A-Z]1048576/;
	cy.get('input#addressInput')
		.should('have.prop', 'value')
		.should('match', regex);

	cy.log('Removing text selection - end.');
}

function selectAllMobile(removeSelection = true) {
	cy.log('Selecting all text - start.');

	if (removeSelection)
		removeTextSelection();

	cy.get('#spreadsheet-header-corner')
		.then(function(corner) {
			var yPos = corner.height() - 10;
			cy.get('#spreadsheet-header-corner')
				.click(0, yPos);
		});

	cy.get('.spreadsheet-cell-resize-marker')
		.should('be.visible');

	cy.get('input#addressInput')
		.should('have.prop', 'value', 'A1:AMJ1048576');

	cy.log('Selecting all text - end.');
}

function selectFirstRow() {
	cy.get('.spreadsheet-header-rows')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);

			var XPos = (items[0].getBoundingClientRect().right + items[0].getBoundingClientRect().left) / 2;
			var YPos = items[0].getBoundingClientRect().top + 10;
			cy.get('body')
				.click(XPos, YPos);
		});

	cy.get('.spreadsheet-cell-resize-marker:nth-of-type(1)')
		.should('be.visible');

	cy.get('.spreadsheet-cell-resize-marker:nth-of-type(2)')
		.should('not.be.visible');

	cy.get('input#addressInput')
		.should('have.prop', 'value', 'A1:AMJ1');
}

function selectFirstColumn() {
	cy.get('.spreadsheet-header-columns')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);

			var XPos = items[0].getBoundingClientRect().left + 10;
			var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
			cy.get('body')
				.click(XPos, YPos);
		});

	cy.get('input#addressInput')
		.should('have.prop', 'value', 'A1:A1048576');
}

module.exports.removeTextSelection = removeTextSelection;
module.exports.selectAllMobile = selectAllMobile;
module.exports.selectFirstRow = selectFirstRow;
module.exports.selectFirstColumn = selectFirstColumn;
