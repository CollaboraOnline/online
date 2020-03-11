/* global cy Cypress expect*/

function loadTestDoc(fileName, subFolder, mobile) {
	// Get a clean test document
	if (subFolder === undefined) {
		cy.task('copyFile', {
			sourceDir: Cypress.env('DATA_FOLDER'),
			destDir: Cypress.env('WORKDIR'),
			fileName: fileName,
		});
	} else {
		cy.task('copyFile', {
			sourceDir: Cypress.env('DATA_FOLDER') + subFolder + '/',
			destDir: Cypress.env('WORKDIR') + subFolder + '/',
			fileName: fileName,
		});
	}

	if (mobile === true) {
		cy.viewport('iphone-6');
	}

	// Open test document
	var URI;
	if (subFolder === undefined) {
		URI = 'http://localhost:'+
			Cypress.env('SERVER_PORT') +
			'/loleaflet/' +
			Cypress.env('WSD_VERSION_HASH') +
			'/loleaflet.html?lang=en-US&file_path=file://' +
			Cypress.env('WORKDIR') + fileName;
	} else {
		URI = 'http://localhost:'+
			Cypress.env('SERVER_PORT') +
			'/loleaflet/' +
			Cypress.env('WSD_VERSION_HASH') +
			'/loleaflet.html?lang=en-US&file_path=file://' +
			Cypress.env('WORKDIR') + subFolder + '/' + fileName;
	}

	cy.visit(URI, {
		onLoad: function(win) {
			win.onerror = cy.onUncaughtException;
		}});
	// Wait for the document to fully load
	cy.get('.leaflet-tile-loaded', {timeout : 10000});
}

function beforeAllMobile(fileName, subFolder) {
	loadTestDoc(fileName, subFolder, true);

	detectLOCoreVersion();
}

function afterAll() {
	// Make sure that the document is closed
	cy.visit('http://admin:admin@localhost:' +
			Cypress.env('SERVER_PORT') +
			'/loleaflet/dist/admin/admin.html');
	cy.get('#doclist')
		.should('exist');
	cy.get('#doclist tr')
		.should('not.exist', {timeout : 10000});
	cy.wait(200);
}

function detectLOCoreVersion() {
	if (Cypress.env('LO_CORE_VERSION') === undefined) {
		// Open hamburger menu
		cy.get('#toolbar-hamburger')
			.click();

		// Open about dialog
		cy.get('.ui-header.level-0 .menu-entry-with-icon')
			.contains('About')
			.click();

		// Get the version
		cy.get('#lokit-version')
			.then(function(items) {
				expect(items).have.lengthOf(1);
				if (items[0].textContent.includes('Collabora OfficeDev 6.2')) {
					Cypress.env('LO_CORE_VERSION', 'cp-6-2');}
				else {
					Cypress.env('LO_CORE_VERSION', 'master');
				}
			});

		// Close about dialog
		cy.get('body')
			.type('{esc}');
	}
}

function longPressOnDocument(posX, posY) {
	cy.get('.leaflet-pane.leaflet-map-pane')
		.then(function(items) {
			expect(items).have.length(1);

			var eventOptions = {
				force: true,
				button: 0,
				pointerType: 'mouse',
				x: posX - items[0].getBoundingClientRect().left,
				y: posY - items[0].getBoundingClientRect().top
			};

			cy.get('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerdown', eventOptions)
				.trigger('pointermove', eventOptions);

			cy.wait(600);

			cy.get('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerup', eventOptions);
		});
}

module.exports.loadTestDoc = loadTestDoc;
module.exports.afterAll = afterAll;
module.exports.beforeAllMobile = beforeAllMobile;
module.exports.longPressOnDocument = longPressOnDocument;
