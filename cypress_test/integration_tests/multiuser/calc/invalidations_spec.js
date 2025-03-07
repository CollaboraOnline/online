/* global describe it cy beforeEach expect require Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagmultiuser'], 'Joining a document should not trigger an invalidation', function() {

	beforeEach(function() {
		// Turn off SpellChecking by default because grammar checking,
		// when available, currently adds an extra empty update when
		// grammar checking kicks in at server-side idle after a change.
		localStorage.setItem('SpellOnline', false);
		helper.setupAndLoadDocument('calc/invalidations.ods',true);
		desktopHelper.switchUIToNotebookbar();
	});

	it('Join document', function() {
		cy.cSetActiveFrame('#iframe1');

		cy.cGet('#InsertMode', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 }).should('have.text', 'Tracking changes: on');
		helper.typeIntoDocument('X');
		cy.cGet('#InsertMode', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 }).should('have.text', 'Insert');
		helper.typeIntoDocument('{enter}');
		cy.cGet('#InsertMode', { timeout: Cypress.config('defaultCommandTimeout') * 2.0 }).should('have.text', 'Tracking changes: on');
		cy.cGet(helper.addressInputSelector).should('have.prop', 'value', 'A2');
		helper.typeIntoDocument('{uparrow}');
		// wait until round trip of cell address
		cy.cGet(helper.addressInputSelector).should('have.prop', 'value', 'A1');

		cy.cGet('.empty-deltas').then(($before) => {
			const beforeCount = $before.text();

			// joining triggered some theme related invalidations

			// Reload page
			cy.cSetActiveFrame('#iframe2');
			cy.get('#form2').submit();
			// Wait for page to unload
			cy.wait(1000);
			// Wait for page to finish loading
			helper.documentChecks(true);

			cy.cSetActiveFrame('#iframe1');
			cy.cGet(helper.addressInputSelector).should('have.prop', 'value', 'A1');
			// wait until round trip of cell address
			helper.typeIntoDocument('{rightarrow}');
			cy.cGet(helper.addressInputSelector).should('have.prop', 'value', 'B1');

			cy.cGet('.empty-deltas').should(($after) => {
				expect($after.text()).to.eq(beforeCount);
			});
		});
	});
});
