/* global cy expect require Cypress*/

var mobileHelper = require('../../common/mobile_helper');

function clickOnFirstCell(firstClick = true, dblClick = false) {
	cy.log('Clicking on first cell - start.');
	cy.log('Param - firstClick: ' + firstClick);
	cy.log('Param - dblClick: ' + dblClick);

	// Enable editing if it's in read-only mode
	mobileHelper.enableEditingMobile();

	// Use the tile's edge to find the first cell's position
	cy.get('.leaflet-tile-container')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().right + 10;
			var YPos = items[0].getBoundingClientRect().top + 10;
			if (dblClick) {
				cy.get('body')
					.dblclick(XPos, YPos);
			} else {
				cy.get('body')
					.click(XPos, YPos);
			}
		});

	if (firstClick && !dblClick)
		cy.get('.spreadsheet-cell-resize-marker')
			.should('exist');
	else
		cy.get('.leaflet-cursor.blinking-cursor')
			.should('exist');

	cy.log('Clicking on first cell - end.');
}

function dblClickOnFirstCell() {
	clickOnFirstCell(false, true);
}

function copyContentToClipboard() {
	cy.log('Copying content to clipboard - start.');

	selectAllMobile();

	cy.get('.leaflet-tile-container')
		.then(function(items) {
			expect(items).to.have.lengthOf(1);
			var XPos = items[0].getBoundingClientRect().right + 10;
			var YPos = items[0].getBoundingClientRect().top + 10;
			mobileHelper.longPressOnDocument(XPos, YPos);
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

	cy.log('Copying content to clipboard - end.');
}

function removeTextSelection() {
	cy.log('Removing all text - start.');

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

	cy.log('Removing all text - end.');
}

function selectAllMobile() {
	cy.log('Selecting all text - start.');

	removeTextSelection();


	cy.get('#spreadsheet-header-corner')
		.click();

	cy.get('.leaflet-marker-icon')
		.should('exist');

	cy.log('Selecting all text - end.');
}

module.exports.copyContentToClipboard = copyContentToClipboard;
module.exports.removeTextSelection = removeTextSelection;
module.exports.selectAllMobile = selectAllMobile;
module.exports.clickOnFirstCell = clickOnFirstCell;
module.exports.dblClickOnFirstCell = dblClickOnFirstCell;
