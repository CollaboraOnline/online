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
		Cypress.env('WORKDIR') + fileName);

	// Wait for the document to fully load
	cy.get('.leaflet-tile-loaded', {timeout : 10000});
}

module.exports.loadTestDoc = loadTestDoc;
