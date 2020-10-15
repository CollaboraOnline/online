/* global cy require*/

var helper = require('./helper');

// Assert that Impress is *not* in Text Edit Mode.
function assertNotInTextEditMode() {
	cy.log('Verifying NO Text-Edit context.');

	// In edit mode, we should have the blinking cursor.
	cy.get('.leaflet-cursor.blinking-cursor')
		.should('not.exist');
	cy.get('.leaflet-cursor-container')
		.should('not.exist');

	helper.assertNoKeyboardInput();

	cy.log('NO Text-Edit context verified.');
}

// Assert that Impress is in Text Edit Mode.
function assertInTextEditMode() {
	cy.log('Verifying Impress in Text-Edit context.');

	// In edit mode, we should have the edit container.
	cy.get('#doc-clipboard-container')
		.should('exist');

	cy.get('.leaflet-interactive')
		.should('exist');

	cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
		.should('exist');

	helper.assertCursorAndFocus();

	cy.log('Impress Text-Edit context verified.');
}

// Enter some text and confirm we get it back.
function typeTextAndVerify(text, expected) {
	if (!expected)
		expected = text;

	assertInTextEditMode();

	// Type some text.
	helper.typeIntoDocument(text);

	// Still in edit mode.
	assertInTextEditMode();

	helper.selectAllText();

	helper.expectTextForClipboard(expected);
}

function assertNumberOfSlidePreviews(slides) {
	cy.get('#slide-sorter .preview-frame')
		.should('have.length', slides + 1);
}

module.exports.assertNotInTextEditMode = assertNotInTextEditMode;
module.exports.assertInTextEditMode = assertInTextEditMode;
module.exports.typeTextAndVerify = typeTextAndVerify;
module.exports.assertNumberOfSlidePreviews = assertNumberOfSlidePreviews;
