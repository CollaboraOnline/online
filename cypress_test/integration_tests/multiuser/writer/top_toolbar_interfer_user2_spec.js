/* global describe it cy require Cypress */

var helper = require('../../common/helper');

describe('Top toolbar interfering test: user-2.', function() {
	var testFileName = 'top_toolbar_interfer.odt';

	function insertComment() {
		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		cy.get('#tb_editbar_item_insertannotation')
			.click();

		cy.get('.loleaflet-annotation-edit:nth-of-type(2) .loleaflet-annotation-textarea')
			.type('Ready!');

		cy.get('#annotation-save')
			.click();
	}

	it('Spaming keyboard input.', function() {
		cy.waitUntil(function() {
			// Wait for the user-1 to open the document
			cy.visit('http://admin:admin@localhost:' +
				Cypress.env('SERVER_PORT') +
				'/loleaflet/dist/admin/admin.html');

			cy.get('#uptime')
				.should('not.have.text', '0');

			var regex = new RegExp('[0-9]' + testFileName);
			cy.contains('#docview', regex);

			// We open the same document
			helper.beforeAll(testFileName, 'writer', true);

			cy.get('#tb_actionbar_item_userlist', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 })
				.should('be.visible');

			// Leave a comment to make user-1 to start the test.
			insertComment();

			// We are doing some keyboard input activity here.
			cy.waitUntil(function() {
				for (var i = 0; i < 5; i++) {
					helper.typeIntoDocument('{rightArrow}');
				}

				return cy.get('#tb_actionbar_item_userlist')
					.then(function(userlist) {
						return !Cypress.dom.isVisible(userlist[0]);
					});
			}, {timeout: 60000});

			// Check admin console, whether the first user is still active
			// If there is no more document we can assume the test is finished.
			cy.visit('http://admin:admin@localhost:' +
				Cypress.env('SERVER_PORT') +
				'/loleaflet/dist/admin/admin.html');

			cy.get('#uptime')
				.should('not.have.text', '0');

			cy.wait(2000);

			return cy.get('#docview')
				.invoke('text')
				.then(function(text) {
					return !text.match(regex);
				});

		}, {timeout: 60000, log: false});
	});
});
