/* global cy require*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

function selectAllMobile() {
	cy.log('Select all via hamburger menu - start.');

	// Remove selection if exist
	helper.typeIntoDocument('{downarrow}');
	cy.get('.leaflet-selection-marker-start')
		.should('not.exist');

	// Open hamburger menu
	mobileHelper.openHamburgerMenu();

	// Open edit menu
	cy.contains('.ui-header.level-0 .menu-entry-with-icon', 'Edit')
		.click();

	// Do the selection
	cy.contains('.ui-header.level-1 .menu-entry-with-icon', 'Select All')
		.click();
	cy.get('.leaflet-marker-icon')
		.should('exist');

	cy.log('Select all via hamburger menu - end.');
}

module.exports.selectAllMobile = selectAllMobile;
