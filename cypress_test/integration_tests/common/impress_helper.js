/* global cy require expect Cypress */

var helper = require('./helper');

// Assert that Impress is *not* in Text Edit Mode.
function assertNotInTextEditMode() {
	cy.log('Verifying NO Text-Edit context.');
	// In edit mode, we should have the blinking cursor.
	cy.cGet('.leaflet-cursor.blinking-cursor').should('not.exist');
	cy.cGet('.leaflet-cursor-container').should('not.exist');
	helper.assertNoKeyboardInput();
	cy.log('NO Text-Edit context verified.');
}

// Assert that Impress is in Text Edit Mode.
function assertInTextEditMode() {
	cy.log('Verifying Impress in Text-Edit context.');
	// In edit mode, we should have the edit container.
	cy.cGet('#doc-clipboard-container').should('exist');
	cy.cGet('.leaflet-interactive').should('exist');
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');
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

// Make sure we have the right number of slides in the document.
// We use the number of slide previews as indicators.
// Parameters:
// slides - number of expected slides
function assertNumberOfSlidePreviews(slides) {
	cy.cGet('#slide-sorter .preview-frame')
		.should('have.length', slides + 1);
}

// Select a text shape at the center of the slide / view.
// This method triggers mouse click in the center to achive
// a shape selection. It fails, if there is no shape there.
function selectTextShapeInTheCenter() {
	cy.log('Selecting text shape - start.');

	// Click on the center of the slide to select the text shape there
	cy.cGet('#document-container')
		.then(function(items) {
			expect(items).to.have.length(1);
			var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
			var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
			cy.cGet('body').click(XPos, YPos);
		});

	cy.cGet('.leaflet-drag-transform-marker').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).should('be.visible');
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g.Page g').should('exist');
	cy.log('Selecting text shape - end.');
}

function selectTableInTheCenter() {
	cy.log('Selecting table - start.');

	// Click on the center of the slide to select the text shape there
	// Retry until it works
	cy.waitUntil(function() {
		cy.cGet('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.cGet('body').click(XPos, YPos);
			});

		return cy.cGet('.leaflet-marker-pane')
			.then(function (pane) {
				return pane[0].children.length !== 0;
			});
	});

	cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).should('be.visible');
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g.Page g').should('exist');

	cy.log('Selecting table - end.');
}

// Remove existing shape selection by clicking outside of the shape.
function removeShapeSelection() {
	cy.log('Removing shape selection - start.');

	// Remove selection with clicking on the top-left corner of the slide
	cy.waitUntil(function() {
		cy.cGet('.leaflet-canvas-container canvas')
			.then(function(items) {
				var XPos = items[0].getBoundingClientRect().left + 10;
				var YPos = items[0].getBoundingClientRect().top + 10;
				cy.cGet('body').click(XPos, YPos);
			});

		return cy.cGet('.leaflet-overlay-pane svg')
		.then(function(overlay) {
				return overlay.children('g').length === 0;
			});
	});

	cy.cGet('.leaflet-drag-transform-marker').should('not.exist');

	cy.log('Removing shape selection - end.');
}


// We use an SVG representation of the Impress shapes
// to check it's content, it's shape, etc. We can use
// this method to trigger the update of the SVG representation
// so we can be sure that it's in an updated state.
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

// Select the text inside a preselected shape. So we assume
// we have already a shape selected. We try to select the
// text of this shape by double clicking into it, until the
// cursor becomes visible.
function selectTextOfShape(selectAllText = true) {
	cy.log('Selecting text of shape - start.');

	// Double click onto the selected shape
	// Retry until the cursor appears
	cy.waitUntil(function() {
		cy.cGet('svg g .leaflet-interactive').dblclick({force: true});
		return cy.cGet('.cursor-overlay')
			.then(function(overlay) {
				return overlay.children('.leaflet-cursor-container').length !== 0;
			});
	});

	cy.cGet('.leaflet-cursor.blinking-cursor').should('exist');

	if (selectAllText)
		helper.selectAllText();

	cy.log('Selecting text of shape - end.');
}

// Step into text editing of the preselected shape. So we assume
// we have already a shape selected. We try to make the document
// to switch text editing mode by double clicking into the shape.
function dblclickOnSelectedShape() {
	cy.cGet('.transform-handler--rotate')
		.then(function(items) {
			expect(items).to.have.length(1);
			var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
			var YPos = items[0].getBoundingClientRect().bottom + 50;
			cy.cGet('body')
				.dblclick(XPos, YPos);
		});

	cy.cGet('.leaflet-cursor.blinking-cursor')
		.should('exist');
}

//add multiple slides
function addSlide(numberOfSlides) {
	cy.cGet('.preview-frame').then(function (result) {
		var origSlides = result.length;
		for (let i = 0; i < numberOfSlides; i++) {
			cy.cGet('#tb_presentation-toolbar_item_insertpage')
				.should('not.have.class', 'disabled')
				.click();
		}
		cy.cGet('.preview-frame')
			.should('have.length',origSlides+numberOfSlides);
	});
}

//change multiple slides
function changeSlide(changeNum,direction) {
	var slideButton;
	if (direction === 'next') {
		slideButton = cy.cGet('#tb_actionbar_item_next');
	} else if (direction === 'previous') {
		slideButton = cy.cGet('#tb_actionbar_item_prev');
	}
	if (slideButton) {
		for (var n = 0; n < changeNum; n++) {
			slideButton.click();
		}
	}
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
module.exports.addSlide = addSlide;
module.exports.changeSlide = changeSlide;
module.exports.selectTableInTheCenter = selectTableInTheCenter;
