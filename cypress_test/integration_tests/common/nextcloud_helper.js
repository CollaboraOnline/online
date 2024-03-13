/* global cy Cypress require */

// Nextcloud integration related helper methods.

var mobileHelper = require('./mobile_helper');

// Open sharing sidebar of NC integration (mobile).
// We check whether the NC sidebar is opened and then we
// close it.
function checkAndCloseSharing() {
	cy.log('>> checkAndCloseSharing - start');

	mobileHelper.selectHamburgerMenuItem(['File']);

	cy.contains('.menu-entry-with-icon', 'Share...')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '');
			cy.wrap(item)
				.click();
		});

	cy.get('#app-sidebar-vue')
		.should('be.visible');

	// issue here
	//cy.get('section#sharing')
	//	.should('be.visible');

	cy.get('.app-sidebar__close.icon-close')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '2');
			cy.wrap(item)
				.click();
		});

	cy.log('<< checkAndCloseSharing - end');
}

// Insert an image from NC storage. We use the "Insert"
// menu for this, which will trigger NC's own image
// insert dialog, where we can select an existing image
// that was uploaded to NC storage earlier.
// Parameters:
// fileName - name of the image file.
function insertImageFromStorage(fileName) {
	cy.log('>> insertImageFromStorage - start');

	mobileHelper.openInsertionWizard();

	cy.get('.insertgraphicremote')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '');
			cy.wrap(item)
				.click();
		});

	cy.get('.oc-dialog')
		.should('be.visible');

	cy.get('tr[data-entryname=\'' + fileName + '\']')
		.click();

	cy.get('.oc-dialog-buttonrow .primary')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '2');
			cy.wrap(item)
				.click();
		});

	cy.log('<< insertImageFromStorage - end');
}

// Save an existing and opened document with a different
// name on the NC storage. We use the "File" -> "Save As..."
// menu option for this, which will trigger an NC dialog
// to specify the new file name.
// Parameters:
// fileName - the new filename we would like to save as.
function saveFileAs(fileName) {
	cy.log('>> saveFileAs - start');

	mobileHelper.enableEditingMobile();

	mobileHelper.selectHamburgerMenuItem(['File']);

	cy.contains('.menu-entry-with-icon', 'Save As...')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '1');
			cy.wrap(item)
				.click();
		});

	cy.get('.oc-dialog')
		.should('be.visible');

	cy.get('.oc-dialog input')
		.clear()
		.type(fileName);

	cy.get('.oc-dialog-buttonrow .primary')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '2');
			cy.wrap(item)
				.click();
		});

	cy.log('<< saveFileAs - end');
}

module.exports.checkAndCloseSharing = checkAndCloseSharing;
module.exports.insertImageFromStorage = insertImageFromStorage;
module.exports.saveFileAs = saveFileAs;
