/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Top toolbar tests.', function() {
	var testFileName = 'top_toolbar.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		desktopHelper.hideSidebar();

		impressHelper.selectTextShapeInTheCenter();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Apply bold on text shape.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		impressHelper.triggerNewSVGForShapeInTheCenter();

		cy.get('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph')
			.should('have.attr', 'font-weight', '700');
	});
});
