/* global describe it cy require expect afterEach*/

var helper = require('../../common/helper');

describe('Shape operations', function() {
	var testFileName = 'shape_operations.odt';

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert a simple shape.', function() {
		helper.beforeAll(testFileName, 'writer');

		// Scroll on the up toolbar
		cy.get('#toolbar-up .w2ui-scroll-right').click();
		cy.get('.w2ui-tb-image.w2ui-icon.basicshapes_ellipse')
			.should('be.visible')
			.click();

		// Insert a rectangle
		cy.get('.col.w2ui-icon.basicshapes_rectangle')
			.click({force : true});

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');

		// Check whether the rectangle was inserted as an SVG
		cy.get('.leaflet-pane.leaflet-overlay-pane svg')
			.should(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
			});
	});
});
