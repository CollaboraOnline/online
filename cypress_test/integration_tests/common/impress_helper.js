/* global cy require expect */

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

function selectTextShapeInTheCenter() {
	cy.log('Selecting text shape - start.');

	// Click on the center of the slide to select the text shape there
	cy.get('#document-container')
		.then(function(items) {
			expect(items).to.have.length(1);
			var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
			var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
			cy.get('body')
				.click(XPos, YPos);
		});

	cy.get('.leaflet-drag-transform-marker')
		.should('be.visible');

	cy.get('.leaflet-pane.leaflet-overlay-pane svg g.Page g')
		.should('be.visible');

	cy.log('Selecting text shape - end.');
}

function removeShapeSelection() {
	cy.log('Removing shape selection - start.');

	// Remove selection with clicking on the top-left corner of the slide
	cy.waitUntil(function() {
		cy.get('.leaflet-canvas-container canvas')
			.then(function(items) {
				var XPos = items[0].getBoundingClientRect().left + 10;
				var YPos = items[0].getBoundingClientRect().top + 10;
				cy.get('body')
					.click(XPos, YPos);
			});

		cy.wait(2000);

		return cy.get('.leaflet-overlay-pane svg')
			.then(function(overlay) {
				return overlay.children('g').length === 0;
			});
	});

	cy.get('.leaflet-drag-transform-marker')
		.should('not.exist');

	cy.log('Removing shape selection - end.');
}

function triggerNewSVGForShapeInTheCenter() {
	cy.log('Triggering new SVG for shape - start.');

	removeShapeSelection();

	// If we click too fast on the shape again
	// then it steps into edit mode, might be a bug
	cy.wait(200);

	// Select text shape again which will retrigger a new SVG from core
	selectTextShapeInTheCenter();

	cy.log('Triggering new SVG for shape - end.');
}

function selectTextOfShape() {
	cy.log('Selecting text of shape - start.');

	// Double click onto the selected shape
	cy.waitUntil(function() {
		cy.get('svg g .leaflet-interactive')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.get('body')
					.dblclick(XPos, YPos);
			});

		cy.wait(2000);

		return cy.get('.leaflet-overlay-pane')
			.then(function(overlay) {
				return overlay.children('.leaflet-cursor-container').length !== 0;
			});
	});

	cy.get('.leaflet-cursor.blinking-cursor')
		.should('exist');

	helper.selectAllText(false);

	cy.log('Selecting text of shape - end.');
}

function dblclickOnSelectedShape() {
	cy.get('.transform-handler--rotate')
		.then(function(items) {
			expect(items).to.have.length(1);
			var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
			var YPos = items[0].getBoundingClientRect().bottom + 50;
			cy.get('body')
				.dblclick(XPos, YPos);
		});

	cy.get('.leaflet-cursor.blinking-cursor')
		.should('exist');
}

module.exports.assertNotInTextEditMode = assertNotInTextEditMode;
module.exports.assertInTextEditMode = assertInTextEditMode;
module.exports.typeTextAndVerify = typeTextAndVerify;
module.exports.assertNumberOfSlidePreviews = assertNumberOfSlidePreviews;
module.exports.selectTextShapeInTheCenter = selectTextShapeInTheCenter;
module.exports.triggerNewSVGForShapeInTheCenter = triggerNewSVGForShapeInTheCenter;
module.exports.removeShapeSelection = removeShapeSelection;
module.exports.selectTextOfShape = selectTextOfShape;
module.exports.dblclickOnSelectedShape = dblclickOnSelectedShape;
