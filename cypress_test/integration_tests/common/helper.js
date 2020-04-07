/* global cy Cypress expect*/

function loadTestDoc(fileName, subFolder, mobile) {
	cy.log('Loading test document - start.');
	cy.log('Param - fileName: ' + fileName);
	cy.log('Param - subFolder: ' + subFolder);
	cy.log('Param - mobile: ' + mobile);

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

	cy.log('Loading test document - end.');
}

// Assert that NO keyboard input is accepted (i.e. keyboard should be HIDDEN).
function assertNoKeyboardInput() {
	cy.window().then(win => {
		var acceptInput = win.canAcceptKeyboardInput();
		expect(acceptInput, 'Should accept input').to.equal(false);
	});
}

// Assert that keyboard input is accepted (i.e. keyboard should be VISIBLE).
function assertHaveKeyboardInput() {
	cy.window().then(win => {
		var acceptInput = win.canAcceptKeyboardInput();
		expect(acceptInput, 'Should accept input').to.equal(true);
	});
}

// Assert that we have cursor and focus.
function assertCursorAndFocus() {
	cy.log('Verifying Cursor and Focus.');

	// Active element must be the textarea named clipboard.
	cy.document().its('activeElement.className')
		.should('be.eq', 'clipboard');

	// In edit mode, we should have the blinking cursor.
	cy.get('.leaflet-cursor.blinking-cursor')
		.should('exist');
	cy.get('.leaflet-cursor-container')
		.should('exist');

	assertHaveKeyboardInput();

	cy.log('Cursor and Focus verified.');
}

// Select all text via CTRL+A shortcut.
function selectAllText(assertFocus = true) {
	if (assertFocus)
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
// helper.getTextForClipboard((plainText) => {
// 	expect(plainText, 'Selection Text').to.equal(testText);
// });
function getTextForClipboard(f) {
	cy.window().then(win => {
		f(win.getTextForClipboard());
	});
}

// Expects getTextForClipboard return the given
// plain-text, and asserts equality.
function expectTextForClipboard(expectedPlainText) {
	getTextForClipboard((plainText) => {
		expect(plainText, 'Selection Text').to.equal(expectedPlainText);
	});
}

function afterAll(fileName) {
	cy.log('Waiting for closing the document - start.');
	cy.log('Param - fileName: ' + fileName);

	// Make sure that the document is closed
	cy.visit('http://admin:admin@localhost:' +
			Cypress.env('SERVER_PORT') +
			'/loleaflet/dist/admin/admin.html');

	cy.get('#uptime')
		.should('not.have.text', '0');

	cy.get('#doclist td:nth-child(2)')
		.should('not.contain.text', fileName);

	cy.log('Waiting for closing the document - end.');
}

module.exports.loadTestDoc = loadTestDoc;
module.exports.assertCursorAndFocus = assertCursorAndFocus;
module.exports.assertNoKeyboardInput = assertNoKeyboardInput;
module.exports.assertHaveKeyboardInput = assertHaveKeyboardInput;
module.exports.selectAllText = selectAllText;
module.exports.clearAllText = clearAllText;
module.exports.getTextForClipboard = getTextForClipboard;
module.exports.expectTextForClipboard = expectTextForClipboard;
module.exports.afterAll = afterAll;
