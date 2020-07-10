/* globals cy expect require */

var helper = require('../../common/helper');

function selectTextShapeInTheCenter() {
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

	cy.get('.leaflet-pane.leaflet-overlay-pane g.Page g')
		.should(function(shape) {
			expect(shape.hasClass('com.sun.star.drawing.TextShape') ||
				   shape.hasClass('Outline')).to.be.true;
		});
}

function selectTextOfShape() {
	// Double click onto the selected shape
	cy.get('svg g .leaflet-interactive')
		.then(function(items) {
			expect(items).to.have.length(1);
			var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
			var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
			cy.get('body')
				.dblclick(XPos, YPos);
		});

	cy.get('.leaflet-cursor.blinking-cursor')
		.should('exist');

	helper.selectAllText(false);
}

function removeShapeSelection() {
	// Remove selection first with clicking next to the rotate handler
	cy.get('.transform-handler--rotate')
		.then(function(items) {
			var XPos = items[0].getBoundingClientRect().left - 10;
			var YPos = items[0].getBoundingClientRect().top;
			// Sometimes selection is persistent, so click more times
			// to achive actual deselection.
			cy.get('body')
				.click(XPos, YPos);

			cy.get('body')
				.dblclick(XPos, YPos);
		});

	cy.get('.leaflet-drag-transform-marker')
		.should('not.exist');
}

function triggerNewSVGForShapeInTheCenter() {
	removeShapeSelection();

	// If we click too fast on the shape again
	// then it steps into edit mode, might be a bug
	cy.wait(200);

	// Select text shape again which will retrigger a new SVG from core
	selectTextShapeInTheCenter();
}

module.exports.selectTextShapeInTheCenter = selectTextShapeInTheCenter;
module.exports.triggerNewSVGForShapeInTheCenter = triggerNewSVGForShapeInTheCenter;
module.exports.selectTextOfShape = selectTextOfShape;
module.exports.removeShapeSelection = removeShapeSelection;
