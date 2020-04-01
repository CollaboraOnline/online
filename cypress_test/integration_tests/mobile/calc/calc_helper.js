/* global cy expect require Cypress*/

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

	cy.get('.spreadsheet-cell-resize-marker')
		.should('exist');
}

function dblClickOnFirstCell() {
	// Enable editing if it's in read-only mode
	helper.enableEditingMobile();

	// Use the tile's edge to find the first cell's position
	cy.get('.leaflet-tile-container')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().right + 10;
			var YPos = items[0].getBoundingClientRect().top + 10;
			cy.get('body')
				.dblclick(XPos, YPos);
		});

	cy.get('.leaflet-cursor.blinking-cursor')
		.should('exist');
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

function removeTextSelection() {
	// TODO: select all does not work with core/master
	// if we have a column selected
	if (Cypress.env('LO_CORE_VERSION') === 'master') {
		cy.get('body')
			.type('{enter}');

		cy.get('.leaflet-marker-icon')
			.should('exist');
	} else {
		cy.get('.spreadsheet-header-columns')
			.click();

		cy.get('.spreadsheet-cell-resize-marker')
			.should('exist');
	}
}

function selectAllMobile() {
	removeTextSelection();


	cy.get('#spreadsheet-header-corner')
		.click();

	cy.get('.leaflet-marker-icon')
		.should('exist');
}

module.exports.copyContentToClipboard = copyContentToClipboard;
module.exports.removeTextSelection = removeTextSelection;
module.exports.selectAllMobile = selectAllMobile;
module.exports.clickOnFirstCell = clickOnFirstCell;
module.exports.dblClickOnFirstCell = dblClickOnFirstCell;
