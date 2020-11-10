/* global cy Cypress require */

var mobileHelper = require('./mobile_helper');

function openRevisionHistory() {
	mobileHelper.selectHamburgerMenuItem(['File']);

	cy.contains('.menu-entry-with-icon', 'See revision history')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '');
			cy.wrap(item)
				.click();
		});

	cy.get('#app-sidebar-vue')
		.should('be.visible');

	cy.get('section#tab-versionsTabView')
		.should('be.visible');

}

function checkAndCloseRevisionHistory() {
	openRevisionHistory();

	cy.get('.app-sidebar__close.icon-close')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '1');
			cy.wrap(item)
				.click();
		});

	cy.wait(2000);

	cy.get('#revViewerContainer .icon-close')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '2');
			cy.wrap(item)
				.click();
		});
}

function restorePreviousVersion() {
	openRevisionHistory();

	cy.get('#versionsTabView .versions li:nth-of-type(1) .revertVersion')
		.click();

	cy.wait(10000);

	cy.get('.app-sidebar__close.icon-close')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '1');
			cy.wrap(item)
				.click();
		});

	cy.wait(2000);

	cy.get('#revViewerContainer .icon-close')
		.then(function(item) {
			Cypress.env('IFRAME_LEVEL', '2');
			cy.wrap(item)
				.click();
		});

	cy.wait(2000);
}

function checkAndCloseSharing() {
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
}

function insertImageFromStorage(fileName) {
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
}

function saveFileAs(fileName) {
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
}

module.exports.checkAndCloseRevisionHistory = checkAndCloseRevisionHistory;
module.exports.checkAndCloseSharing = checkAndCloseSharing;
module.exports.insertImageFromStorage = insertImageFromStorage;
module.exports.saveFileAs = saveFileAs;
module.exports.restorePreviousVersion = restorePreviousVersion;
