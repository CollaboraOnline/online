/* global cy Cypress */

function loadTestDoc(fileName, mobile) {
	// Get a clean test document
	cy.task('copyFile', {
		sourceDir: Cypress.env('DATA_FOLDER'),
		destDir: Cypress.env('WORKDIR'),
		fileName: fileName,
	});

	if (mobile === true) {
		cy.viewport('iphone-3');
	}

	// Open test document
	cy.visit('http://localhost:9980/loleaflet/' +
		Cypress.env('WSD_VERSION_HASH') +
		'/loleaflet.html?file_path=file://' +
		Cypress.env('WORKDIR') + fileName, {
		onLoad: function(win) {
			win.onerror = cy.onUncaughtException;
		}});
	// Wait for the document to fully load
	cy.get('.leaflet-tile-loaded', {timeout : 10000});
}

function selectAllMobile() {
	// Remove selection if exist
	cy.get('#document-container').click();
	cy.get('.leaflet-marker-icon')
		.should('not.exist');

	// Enable editing if it's in read-only mode
	cy.get('#mobile-edit-button')
		.then(function(button) {
			if (button.css('display') !== 'none') {
				cy.get('#mobile-edit-button')
					.click();
			}
		});

	// Open hamburger menu
	cy.get('#toolbar-hamburger')
		.click();

	// Open edit menu
	cy.get('.ui-header.level-0 .sub-menu-title')
		.contains('Edit')
		.click();

	cy.wait(200);

	// Do the selection
	cy.get('.ui-header.level-1 .menu-entry-with-icon')
		.contains('Select All')
		.click();
}

module.exports.loadTestDoc = loadTestDoc;
module.exports.selectAllMobile = selectAllMobile;
