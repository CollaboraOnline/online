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

// Enable editing if we are in read-only mode.
function enableEditingMobile() {
	cy.get('#mobile-edit-button')
		.then(function(button) {
			if (button.css('display') !== 'none') {
				cy.get('#mobile-edit-button')
					.click();
			}
		});

	cy.get('#tb_actionbar_item_mobile_wizard')
		.should('not.have.class', 'disabled');
}

// Assert that NO keyboard input is accepted (i.e. keyboard should be HIDDEN).
function assertNoKeyboardInput() {
	cy.window().then(win => {
		var acceptInput = win.map._textInput.shouldAcceptInput();
		expect(acceptInput, 'Should accept input').to.equal(false);
	});
}

// Assert that keyboard input is accepted (i.e. keyboard should be VISIBLE).
function assertHaveKeyboardInput() {
	cy.window().then(win => {
		var acceptInput = win.map._textInput.shouldAcceptInput();
		expect(acceptInput, 'Should accept input').to.equal(true);
	});
}

// Assert that we have cursor and focus.
function assertCursorAndFocus() {
	cy.log('Verifying Cursor and Focus.');

	// In edit mode, we should have the blinking cursor.
	cy.get('.leaflet-cursor.blinking-cursor')
		.should('exist');
	cy.get('.leaflet-cursor-container')
		.should('exist');

	assertHaveKeyboardInput();

	cy.log('Cursor and Focus verified.');
}

// Select all text via CTRL+A shortcut.
function selectAllText() {
	assertCursorAndFocus();

	cy.log('Select all text');

	// Trigger select all
	cy.get('textarea.clipboard')
		.type('{ctrl}a');

	cy.get('.leaflet-marker-icon')
		.should('exist');
}

// Clear all text by selecting all and deleting.
function clearAllText() {
	assertCursorAndFocus();

	cy.log('Clear all text');

	cy.get('textarea.clipboard')
		.type('{ctrl}a{del}').wait(300);
}

// Returns the text that should go to the
// clipboard on Ctrl+C.
// So this isn't equivalent to reading the
// clipboard (which Cypress doesn't support).
// Takes a closure f that takes the text
// string as argument. Use as follows:
// helper.getTextForClipboard((htmlText, plainText) => {
// 	expect(plainText, 'Selection Text').to.equal(testText);
// });
function getTextForClipboard(f) {
	cy.window().then(win => {
		var htmlText = win.map._clip._getHtmlForClipboard();
		var plainText = win.map._clip.stripHTML(htmlText);
		f(htmlText, plainText);
	});
}

// Expects getTextForClipboard return the given
// plain-text, and asserts equality.
function expectTextForClipboard(expectedPlainText) {
	getTextForClipboard((htmlText, plainText) => {
		expect(plainText, 'Selection Text').to.equal(expectedPlainText);
	});
}

function beforeAllMobile(fileName, subFolder) {
	loadTestDoc(fileName, subFolder, true);

	detectLOCoreVersion();
}

function afterAll(fileName) {
	// Make sure that the document is closed
	cy.visit('http://admin:admin@localhost:' +
			Cypress.env('SERVER_PORT') +
			'/loleaflet/dist/admin/admin.html');

	cy.get('#uptime')
		.should('not.have.text', '0');

	cy.get('#doclist td:nth-child(2)')
		.should('not.contain.text', fileName);
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

		cy.get('.vex-content')
			.should('exist');

		// Get the version
		cy.get('#lokit-version')
			.then(function(items) {
				expect(items).have.lengthOf(1);
				if (items[0].textContent.includes('Collabora') &&
				    items[0].textContent.includes('6.2')) {
					Cypress.env('LO_CORE_VERSION', 'cp-6-2');}
				else {
					Cypress.env('LO_CORE_VERSION', 'master');
				}
			});

		// Close about dialog
		cy.get('.vex-close')
			.click({force : true});

		cy.get('.vex-content')
			.should('not.exist');
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

			// This value is set in Map.TouchGesture.js.
			cy.wait(500);

			cy.get('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerup', eventOptions);
		});
}

module.exports.loadTestDoc = loadTestDoc;
module.exports.enableEditingMobile = enableEditingMobile;
module.exports.assertCursorAndFocus = assertCursorAndFocus;
module.exports.assertNoKeyboardInput = assertNoKeyboardInput;
module.exports.assertHaveKeyboardInput = assertHaveKeyboardInput;
module.exports.selectAllText = selectAllText;
module.exports.clearAllText = clearAllText;
module.exports.getTextForClipboard = getTextForClipboard;
module.exports.expectTextForClipboard = expectTextForClipboard;
module.exports.afterAll = afterAll;
module.exports.beforeAllMobile = beforeAllMobile;
module.exports.longPressOnDocument = longPressOnDocument;
