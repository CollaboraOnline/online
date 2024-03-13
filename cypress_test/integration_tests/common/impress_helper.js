/* global cy require expect Cypress */

var helper = require('./helper');

// Assert that Impress is *not* in Text Edit Mode.
function assertNotInTextEditMode() {
	cy.log('>> assertNotInTextEditMode - start');

	// In edit mode, we should have the blinking cursor.
	cy.cGet('.leaflet-cursor.blinking-cursor').should('not.exist');
	cy.cGet('.leaflet-cursor-container').should('not.exist');
	helper.assertNoKeyboardInput();

	cy.log('<< assertNotInTextEditMode - end');
}

// Assert that Impress is in Text Edit Mode.
function assertInTextEditMode() {
	cy.log('>> assertInTextEditMode - start');

	// In edit mode, we should have the edit container.
	cy.cGet('#doc-clipboard-container').should('exist');
	cy.cGet('.leaflet-interactive').should('exist');
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');
	helper.assertCursorAndFocus();

	cy.log('<< assertInTextEditMode - end');
}

// Enter some text and confirm we get it back.
function typeTextAndVerify(text, expected) {
	cy.log('>> typeTextAndVerify - start');

	if (!expected)
		expected = text;

	assertInTextEditMode();

	// Type some text.
	helper.typeIntoDocument(text);

	// Still in edit mode.
	assertInTextEditMode();

	helper.selectAllText();

	helper.expectTextForClipboard(expected);

	cy.log('<< typeTextAndVerify - end');
}

// Make sure we have the right number of slides in the document.
// We use the number of slide previews as indicators.
// Parameters:
// slides - number of expected slides
function assertNumberOfSlidePreviews(slides) {
	cy.log('>> assertNumberOfSlidePreviews - start');

	cy.cGet('#slide-sorter .preview-frame')
		.should('have.length', slides + 1);

	cy.log('<< assertNumberOfSlidePreviews - end');
}

// Select a text shape at the center of the slide / view.
// This method triggers mouse click in the center to achive
// a shape selection. It fails, if there is no shape there.
function selectTextShapeInTheCenter() {
	cy.log('>> selectTextShapeInTheCenter - start');

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

	cy.log('<< selectTextShapeInTheCenter - end');
}

function selectTableInTheCenter() {
	cy.log('>> selectTableInTheCenter - start');

	// Click on the center of the slide to select the text shape there
	cy.cGet('#document-container')
		.then(function(items) {
			expect(items).to.have.length(1);
			var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
			var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
			cy.cGet('body').click(XPos, YPos);
		});

	cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).should('be.visible');
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g.Page g').should('exist');

	cy.log('<< selectTableInTheCenter - end');
}

// Remove existing shape selection by clicking outside of the shape.
function removeShapeSelection() {
	cy.log('>> removeShapeSelection - start');

	// Remove selection with clicking on the top-left corner of the slide
	cy.waitUntil(function() {
		cy.cGet('.leaflet-canvas-container canvas')
			.then(function(items) {
				var XPos = items[0].getBoundingClientRect().left + 10;
				var YPos = items[0].getBoundingClientRect().top + 10;
				cy.cGet('body').click(XPos, YPos);
			});

		cy.wait(2000);

		return cy.cGet('.leaflet-overlay-pane svg')
		.then(function(overlay) {
				return overlay.children('g').length === 0;
			});
	});

	cy.cGet('.leaflet-drag-transform-marker').should('not.exist');

	cy.log('<< removeShapeSelection - end');
}


// We use an SVG representation of the Impress shapes
// to check it's content, it's shape, etc. We can use
// this method to trigger the update of the SVG representation
// so we can be sure that it's in an updated state.
function triggerNewSVGForShapeInTheCenter() {
	cy.log('>> triggerNewSVGForShapeInTheCenter - start');

	removeShapeSelection();

	// If we click too fast on the shape again
	// then it steps into edit mode, might be a bug
	cy.wait(200);

	// Select text shape again which will retrigger a new SVG from core
	selectTextShapeInTheCenter();

	cy.log('<< triggerNewSVGForShapeInTheCenter - end');
}

// Select the text inside a preselected shape. So we assume
// we have already a shape selected. We try to select the
// text of this shape by double clicking into it, until the
// cursor becomes visible.
function selectTextOfShape(selectAllText = true) {
	cy.log('>> selectTextOfShape - start');

	// Double click onto the selected shape
	cy.waitUntil(function() {
		cy.cGet('svg g .leaflet-interactive')
			.then(function(items) {
				expect(items).to.have.length(1);
				// Slide does not fit the viewport in cypress.
				// Use the center of the visible area of the svg group element else the click
				// event could go to other elements like slide sorter.
				const clientRect = helper.getVisibleBounds(items[0].getBoundingClientRect());
				const XPos = (clientRect.left + clientRect.right) / 2;
				const YPos = (clientRect.top + clientRect.bottom) / 2;
				cy.cGet('body').dblclick(XPos, YPos);
			});

		cy.wait(2000);

		return cy.cGet('.cursor-overlay')
			.then(function(overlay) {
				return overlay.children('.leaflet-cursor-container').length !== 0;
			});
	});

	cy.cGet('.leaflet-cursor.blinking-cursor').should('exist');

	if (selectAllText)
		helper.selectAllText();

	cy.log('<< selectTextOfShape - end');
}

// Step into text editing of the preselected shape. So we assume
// we have already a shape selected. We try to make the document
// to switch text editing mode by double clicking into the shape.
function dblclickOnSelectedShape() {
	cy.log('>> dblclickOnSelectedShape - start');

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

	cy.log('<< dblclickOnSelectedShape - end');
}

//add multiple slides
function addSlide(numberOfSlides) {
	cy.log('>> addSlide - start');

	helper.waitUntilIdle('#tb_presentation-toolbar_item_insertpage');
	var insertSlideButton = cy.cGet('#tb_presentation-toolbar_item_insertpage');
	for (let i = 0; i < numberOfSlides; i++) {
		insertSlideButton.should('not.have.class', 'disabled').click();
	}

	cy.log('<< addSlide - end');
}

//change multiple slides
function changeSlide(changeNum,direction) {
	cy.log('>> changeSlide - start');

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

	cy.log('<< changeSlide - end');
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
