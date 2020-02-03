/* global cy Cypress expect*/

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

function copyTextToClipboard() {
	// Do a new selection
	selectAllMobile();

	// Open context menu
	cy.get('.leaflet-marker-icon')
		.then(function(marker) {
			expect(marker).to.have.lengthOf(2);
			var XPos =  (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
			var YPos = marker[0].getBoundingClientRect().top - 5;
			cy.get('body').rightclick(XPos, YPos);
		});

	// Execute copy
	cy.get('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon .context-menu-link')
		.contains('Copy')
		.click();

	// Close warning about clipboard operations
	cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
		.click();

	// Wait until it's closed
	cy.get('.vex-overlay')
		.should('not.exist');
}

function afterAll() {
	// Make sure that the document is closed
	cy.visit('http://admin:admin@localhost:9980/loleaflet/dist/admin/admin.html');
	cy.get('#doclist')
		.should('exist');
	cy.get('#doclist tr')
		.should('not.exist', {timeout : 10000});
}

module.exports.loadTestDoc = loadTestDoc;
module.exports.selectAllMobile = selectAllMobile;
module.exports.copyTextToClipboard = copyTextToClipboard;
module.exports.afterAll = afterAll;
