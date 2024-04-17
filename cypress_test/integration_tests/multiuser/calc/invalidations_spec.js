/* global describe it cy beforeEach expect require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagmultiuser'], 'Joining a document should not trigger an invalidation', function() {
	var origTestFileName = 'invalidations.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc', undefined, true);
		desktopHelper.switchUIToNotebookbar();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Join document', function() {
		cy.cSetActiveFrame('#iframe1');

		cy.cGet('#InsertMode').should('have.text', 'Insert mode: inactive');
		helper.typeIntoDocument('X');
		cy.cGet('#InsertMode').should('have.text', 'Insert');
		helper.typeIntoDocument('{enter}');
		cy.cGet('#InsertMode').should('have.text', 'Insert mode: inactive');
		cy.cGet('input#addressInput').should('have.prop', 'value', 'A2');
		helper.typeIntoDocument('{uparrow}');
		// wait until round trip of cell address
		cy.cGet('input#addressInput').should('have.prop', 'value', 'A1');

		cy.cGet('.empty-deltas').then(($before) => {
			const beforeCount = $before.text();

			// joining triggered some theme related invalidations
			cy.cSetActiveFrame('#iframe2');
			cy.get('#form2').submit();
			// Wait for page to finish loading
			helper.checkIfDocIsLoaded(true);

			cy.cSetActiveFrame('#iframe1');
			cy.cGet('input#addressInput').should('have.prop', 'value', 'A1');
			// wait until round trip of cell address
			helper.typeIntoDocument('{rightarrow}');
			cy.cGet('input#addressInput').should('have.prop', 'value', 'B1');

			cy.cGet('.empty-deltas').should(($after) => {
				expect($after.text()).to.eq(beforeCount);
			});
		});
	});
});
