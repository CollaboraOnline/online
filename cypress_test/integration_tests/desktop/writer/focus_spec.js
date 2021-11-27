/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Focus tests', function() {
	var testFileName = 'focus.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Basic document focus.', function() {
		// Document has the focus after load
		helper.assertFocus('className', 'clipboard');
	});

	it('Search for non existing word.', function() {
		// Move focus to the search field
		cy.get('#search-input')
			.click();

		helper.assertFocus('id','search-input');

		var text = 'qqqqq';
		helper.typeText('body', text, 100);

		// Search field still has the focus.
		helper.assertFocus('id','search-input');

		cy.get('#search-input')
			.should('have.prop', 'value', text);
	});

	it('Search for existing word (with bold font).', function() {
		// Move focus to the search field
		cy.get('#search-input')
			.click();

		helper.assertFocus('id','search-input');

		var text = 'text';
		helper.typeText('body', text, 100);

		// Search field still has the focus.
		helper.assertFocus('id','search-input');

		cy.get('#search-input')
			.should('have.prop', 'value', text);
	});

	it('Search for existing word (in table).', function() {
		// Move focus to the search field
		cy.get('#search-input')
			.click();

		helper.assertFocus('id','search-input');

		var text = 'word';
		helper.typeText('body', text, 200);

		// Search field still has the focus.
		helper.assertFocus('id','search-input');

		cy.get('#search-input')
			.should('have.prop', 'value', text);
	});

	it('Search with fast typing.', function() {
		// Move focus to the search field
		cy.get('#search-input')
			.click();

		helper.assertFocus('id','search-input');

		var text = 'qqqqqqqqqqqqqqqqqqqq';
		cy.get('body')
			.type(text);

		// Search field still has the focus.
		helper.assertFocus('id','search-input');

		cy.get('#search-input')
			.should('have.prop', 'value', text);
	});
});
