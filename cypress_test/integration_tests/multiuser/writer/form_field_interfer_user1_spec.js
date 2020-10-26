/* global describe it cy require afterEach expect Cypress */

var helper = require('../../common/helper');

describe('Form field button interference test: user-1.', {retries : 0}, function() {
	var testFileName = 'form_field_interfer.odt';

	function before(fileName) {
		testFileName = fileName;
		helper.beforeAll(fileName, 'writer');

		cy.get('#tb_actionbar_item_userlist', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 })
			.should('be.visible');

		// Wait for the interfering user to actually open the document.
		cy.wait(5000);

		// Blinking cursor is not visible for some reason.
		cy.get('textarea.clipboard')
			.type('x');

		cy.get('.blinking-cursor')
			.should('be.visible');
	}
	afterEach(function() {
		helper.afterAll(testFileName, 'writer');
	});

	function buttonShouldNotExist() {
		cy.get('.form-field-frame')
			.should('not.exist');

		cy.get('.form-field-button')
			.should('not.exist');

		cy.get('.drop-down-field-list')
			.should('not.exist');
	}

	function buttonShouldExist() {
		cy.get('.form-field-frame')
			.should('exist');

		cy.get('.form-field-button')
			.should('exist');

		cy.get('.drop-down-field-list')
			.should('exist');

		// Check also the position relative to the blinking cursor
		cy.get('.blinking-cursor')
			.then(function(cursors) {
				// TODO: why we have two blinking cursors here?
				//expect(cursors).to.have.lengthOf(1);

				var cursorRect = cursors[0].getBoundingClientRect();
				cy.get('.form-field-frame')
					.should(function(frames) {
						expect(frames).to.have.lengthOf(1);
						var frameRect = frames[0].getBoundingClientRect();
						expect(frameRect.top).to.at.most(cursorRect.top);
						expect(frameRect.bottom).to.be.at.least(cursorRect.bottom);
						expect(frameRect.left).to.at.most(cursorRect.left);
						expect(frameRect.right).to.be.at.least(cursorRect.right);
					});
			});
	}


	it('Activate and deactivate form field button.', function() {
		before('form_field_interfer.odt');

		// We don't have the button by default
		buttonShouldNotExist();

		// Move the cursor next to the form field
		helper.moveCursor('right');

		buttonShouldExist();

		// Move the cursor again to the other side of the field
		helper.moveCursor('right');

		buttonShouldExist();

		// Move the cursor away
		helper.moveCursor('right');

		buttonShouldNotExist();

		// Move the cursor back next to the field
		helper.moveCursor('left');

		buttonShouldExist();
	});
});

