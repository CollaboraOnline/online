/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud'], 'Calc insertion wizard.', function() {
	var origTestFileName = 'insertion_wizard.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		calcHelper.clickOnFirstCell();

		mobileHelper.openInsertionWizard();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Inset local image.', function() {
		// We can't use the menu item directly, because it would open file picker.
		cy.cGet('body').contains('.menu-entry-with-icon', 'Local Image...')
			.should('be.visible');

		cy.cGet('#insertgraphic[type=file]')
			.attachFile('/mobile/calc/image_to_insert.png');

		// Could not find a good indicator here, because the inserted image
		// is not selected after insertion.
		cy.wait(1000);

		// Select image
		cy.cGet('.spreadsheet-cell-resize-marker:nth-of-type(2)')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				var XPos = items[0].getBoundingClientRect().right + 10;
				var YPos = items[0].getBoundingClientRect().top;
				cy.cGet('body').click(XPos, YPos);
			});

		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g.Graphic')
			.should('exist');
	});

	it('Insert chart.', function() {
		cy.cGet('body').contains('.menu-entry-with-icon', 'Chart...')
			.click();

		// TODO: why we have 32 markers here instead of 8?
		cy.cGet('.leaflet-drag-transform-marker')
			.should('have.length', 32);
	});

	it('Insert hyperlink.', function() {
		cy.cGet('body').contains('.menu-entry-with-icon', 'Hyperlink...')
			.click();

		// Dialog is opened
		cy.cGet('#hyperlink-link-box')
			.should('exist');

		// Type text and link
		cy.cGet('#hyperlink-text-box')
			.clear()
			.type('some text');
		cy.cGet('#hyperlink-link-box')
			.type('www.something.com');

		// Insert
		cy.cGet('#response-ok')
			.click();

		cy.cGet('.blinking-cursor')
			.should('be.visible');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td a')
			.should('have.text', 'some text');

		cy.cGet('#copy-paste-container table td a')
			.should('have.attr', 'href', 'http://www.something.com');
	});

	it('Insert shape.', function() {
		// Do insertion
		cy.cGet('body').contains('.menu-entry-with-icon', 'Shape')
			.click();

		cy.cGet('.basicshapes_ellipse').
			click();

		// Check that the shape is there
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg.bottomright-svg-pane')
			.should(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
			});
	});

	it('Insert date.', function() {
		// Do insertion
		cy.cGet('body').contains('.menu-entry-with-icon', 'Date')
			.click();

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';MM/DD/YY$');
		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);
	});

	it('Insert time.', function() {
		// Do insertion
		cy.cGet('body').contains('.menu-entry-with-icon', 'Time')
			.click();

		calcHelper.selectEntireSheet();

		var regex = new RegExp(';HH:MM:SS AM/PM$');
		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'sdnum')
			.should('match', regex);
	});
});
