/* global cy expect require */

var helper = require('../../common/helper');

function removeTextSelection() {
	cy.log('Removing text selection - start.');

	// TODO: select all does not work with core/master
	// if we have a column selected
	if (helper.getLOVersion() === 'master') {
		cy.get('body')
			.type('{enter}');

		cy.get('.leaflet-marker-icon')
			.should('exist');
	} else {
		cy.get('.spreadsheet-header-columns')
			.click();

		cy.get('.spreadsheet-cell-resize-marker')
			.invoke('attr', 'style')
			.should('contain', '-8px,');

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B1:B1048576');
	}

	cy.log('Removing text selection - end.');
}

function selectAllMobile(removeSelection = true) {
	cy.log('Selecting all text - start.');

	if (removeSelection)
		removeTextSelection();

	cy.get('#spreadsheet-header-corner')
		.click();

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

	cy.get('.spreadsheet-cell-resize-marker')
		.invoke('attr', 'style')
		.should('contain', '-8px,');

	cy.get('input#addressInput')
		.should('have.prop', 'value', 'A1:A1048576');
}

module.exports.removeTextSelection = removeTextSelection;
module.exports.selectAllMobile = selectAllMobile;
module.exports.selectFirstRow = selectFirstRow;
module.exports.selectFirstColumn = selectFirstColumn;
