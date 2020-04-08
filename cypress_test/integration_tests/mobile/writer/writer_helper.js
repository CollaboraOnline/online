/* global cy expect require*/

var mobileHelper = require('../../common/mobile_helper');

function copyTextToClipboard() {
	cy.log('Copying text to clipboard - start.');

	// Do a new selection
	selectAllMobile();

	// Open context menu
	cy.get('.leaflet-marker-icon')
		.then(function(marker) {
			expect(marker).to.have.lengthOf(2);
			var XPos = (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
			var YPos = marker[0].getBoundingClientRect().top - 5;
			mobileHelper.executeCopyFromContextMenu(XPos, YPos);
		});

	cy.log('Copying text to clipboard - end.');
}

function copyTableToClipboard() {
	cy.log('Copying table to clipboard - start.');

	// Do a new selection
	selectAllMobile();

	// Open context menu
	cy.get('.leaflet-marker-icon')
		.then(function(markers) {
			expect(markers.length).to.have.greaterThan(1);
			for (var i = 0; i < markers.length; i++) {
				if (markers[i].classList.contains('leaflet-selection-marker-start')) {
					var startPos = markers[i].getBoundingClientRect();
				} else if (markers[i].classList.contains('leaflet-selection-marker-end')) {
					var endPos = markers[i].getBoundingClientRect();
				}
			}

			var XPos = startPos.right + 10;
			var YPos = (startPos.top + endPos.top) / 2;
			mobileHelper.executeCopyFromContextMenu(XPos, YPos);
		});

	cy.log('Copying table to clipboard - end.');
}

function selectAllMobile() {
	cy.log('Select all via hamburger menu - start.');

	// Remove selection if exist
	cy.get('#document-container')
		.type('{downarrow}');
	cy.get('.leaflet-marker-icon')
		.should('not.exist');

	// Open hamburger menu
	mobileHelper.openHamburgerMenu();
	cy.get('#mobile-wizard')
		.should('be.visible', {timeout : 10000});

	// Open edit menu
	cy.get('.ui-header.level-0 .menu-entry-with-icon')
		.contains('Edit')
		.click();

	cy.get('.ui-header.level-1 .menu-entry-with-icon')
		.should('be.visible');

	// Do the selection
	cy.get('.ui-header.level-1 .menu-entry-with-icon')
		.contains('Select All')
		.click();
	cy.get('.leaflet-marker-icon')
		.should('exist');

	cy.log('Select all via hamburger menu - end.');
}

module.exports.copyTextToClipboard = copyTextToClipboard;
module.exports.copyTableToClipboard = copyTableToClipboard;
module.exports.selectAllMobile = selectAllMobile;
