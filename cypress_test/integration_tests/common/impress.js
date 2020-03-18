/* global cy require expect*/

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

	cy.get('.leaflet-zoom-animated')
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
	cy.get('#document-container')
		.type(text);

	// Still in edit mode.
	assertInTextEditMode();

	helper.selectAllText();

	//FIXME: Should retry the next check instead of
	// an unreliable sleep, but for now this will do.
	cy.wait(600);

	helper.expectTextForClipboard(expected);
}

function copyShapeContentToClipboard() {
	// TODO: this fails on assertHaveKeyboardInput()
	// assertInTextEditMode();

	helper.selectAllText(false);

	// Open context menu
	cy.get('.leaflet-marker-icon')
		.then(function(marker) {
			expect(marker).to.have.lengthOf(2);
			var XPos = (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
			var YPos = marker[0].getBoundingClientRect().top - 5;
			helper.longPressOnDocument(XPos, YPos);
		});

	cy.get('#mobile-wizard')
		.should('be.visible');

	// Execute copy
	cy.get('.ui-header.level-0.mobile-wizard.ui-widget .context-menu-link .menu-entry-with-icon', {timeout : 10000})
		.contains('Copy')
		.click();

	// Close warning about clipboard operations
	cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
		.click();

	// Wait until it's closed
	cy.get('.vex-overlay')
		.should('not.exist');
}

module.exports.assertNotInTextEditMode = assertNotInTextEditMode;
module.exports.assertInTextEditMode = assertInTextEditMode;
module.exports.typeTextAndVerify = typeTextAndVerify;
module.exports.copyShapeContentToClipboard = copyShapeContentToClipboard;
