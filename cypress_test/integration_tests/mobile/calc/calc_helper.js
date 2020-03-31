/* global cy expect require*/

var helper = require('../../common/helper');

function clickOnFirstCell() {
	// Enable editing if it's in read-only mode
	helper.enableEditingMobile();

	// Use the tile's edge to find the first cell's position
	cy.get('.leaflet-tile-container')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().right + 10;
			var YPos = items[0].getBoundingClientRect().top + 10;
			cy.get('body')
				.click(XPos, YPos);
		});
}

function copyContentToClipboard() {
	selectAllMobile();

	cy.get('.leaflet-tile-container')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().right + 10;
			var YPos = items[0].getBoundingClientRect().top + 10;
			helper.longPressOnDocument(XPos, YPos);
		});

	cy.get('#mobile-wizard')
		.should('be.visible');

	// Execute copy
	cy.get('.menu-entry-with-icon', {timeout : 10000})
		.contains('Copy')
		.click();

	// Close warning about clipboard operations
	cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
		.click();

	// Wait until it's closed
	cy.get('.vex-overlay')
		.should('not.exist');
}

function selectAllMobile() {
	cy.get('.spreadsheet-header-columns')
		.click();

	cy.get('.spreadsheet-cell-resize-marker')
		.should('exist');

	cy.get('#spreadsheet-header-corner')
		.click();

	cy.get('.leaflet-marker-icon')
		.should('exist');
}

module.exports.copyContentToClipboard = copyContentToClipboard;
module.exports.selectAllMobile = selectAllMobile;
module.exports.clickOnFirstCell = clickOnFirstCell;
