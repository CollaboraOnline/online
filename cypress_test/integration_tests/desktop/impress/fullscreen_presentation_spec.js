/* global describe it cy require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Fullscreen Presentation.', function() {
	var testFileName = 'text_fields.odp';

	function getSlideShowContent() {
		return cy.get('@coolIFrameGlobal')
			.find('.leaflet-slideshow').then(($iframe) =>{
				cy.wrap($iframe.contents());
			});
	}

	function before(fileName) {
		testFileName = fileName;
		helper.beforeAll(testFileName, 'impress');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		} else {
			desktopHelper.hideSidebar();
		}

		cy.get('#menu-slide > a')
			.click();
		cy.get('#menu-fullscreen-presentation > a')
			.click();
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Text fields.', function() {
		before('text_fields.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id1').should('have.class', 'Slide');

		getSlideShowContent().find('#tf2 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', '1');

		getSlideShowContent().find('#tf6 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', '1');

		getSlideShowContent().find('#tf5 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', 'SlideOne');

		// go to second slide
		getSlideShowContent().find('#id1').click();

		getSlideShowContent().find('#id2').should('have.class', 'Slide');

		getSlideShowContent().find('#tf7 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', '2');

		getSlideShowContent().find('#tf9 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', '2');

		getSlideShowContent().find('#tf8 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', 'SlideHello');
	});

	it('Custom background.', function() {
		before('slide-bitmap-background.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id1')
			.should('have.class', 'Slide');
		getSlideShowContent().find('#id1 > g').its('0')
			.should('have.class', 'MasterPageView');
		getSlideShowContent().find('#id1 > g > use')
			.should('have.class', 'Background')
			.should('have.attr', 'href', '#bg-id1');

		getSlideShowContent().find('#id1 > .Page > .SlideBackground > .Background')
			.should('have.attr', 'id', 'bg-id1');
	});
});
