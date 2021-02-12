/* global describe it cy require Cypress */

var helper = require('../common/helper');
var mobileHelper = require('../common/mobile_helper');
var calcHelper = require('../common/calc_helper');

describe('Interfering second user.', function() {
	function getComponent(fileName) {
		if (fileName.endsWith('.odt'))
			return 'writer';
		else if (fileName.endsWith('.ods'))
			return 'calc';
		else if (fileName.endsWith('.odp'))
			return 'impress';
	}

	it('Spaming keyboard input.', function() {
		cy.waitUntil(function() {
			// Wait for the user-1 to open the document
			cy.visit('http://admin:admin@localhost:' +
				Cypress.env('SERVER_PORT') +
				'/loleaflet/dist/admin/admin.html');

			cy.get('#uptime')
				.should('not.have.text', '0');

			cy.get('#doclist > tr > td').eq(3)
				.should('not.be.empty')
				.invoke('text')
				.then(function(text) {

					// We open the same document
					helper.beforeAll(text, getComponent(text), true);
				});

			cy.get('#tb_actionbar_item_userlist', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 })
				.should('be.visible');

			helper.doIfOnMobile(function() {
				mobileHelper.enableEditingMobile();
			});

			helper.doIfInCalc(function() {
				calcHelper.clickOnFirstCell();
			});

			// Do some interfering activity.
			cy.waitUntil(function() {
				// We are doing some keyboard input activity for non impress test cases.
				helper.doIfNotInImpress(function() {
					for (var i = 0; i < 3; i++) {
						helper.typeIntoDocument('{rightArrow}');
					}
					for (var j = 0; j < 3; j++) {
						helper.typeIntoDocument('{leftArrow}');
					}
				});

				// In Impress we do some mouse activity.
				helper.doIfInImpress(function() {
					for (var i = 0; i < 5; i++) {
						cy.get('.leaflet-pane.leaflet-tile-pane')
							.click(10, 10);
					}
				});

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

			// Wait some time for our own instance to be closed.
			cy.wait(5000);

			return cy.get('#doclist')
				.invoke('text')
				.then(function(text) {
					return text.length === 0;
				});

		}, {timeout: 60000, log: false});
	});
});
