/* global describe it cy beforeEach expect require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var ceHelper = require('../../common/contenteditable_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagmultiuser'], 'Joining a document should not trigger an invalidation', function() {

	beforeEach(function() {
		// Turn off SpellChecking by default because grammar checking,
		// when available, currently adds an extra empty update when
		// grammar checking kicks in at server-side idle after a change.
		localStorage.setItem('SpellOnline', false);
		helper.setupAndLoadDocument('writer/invalidations.odt',true);
		desktopHelper.switchUIToNotebookbar();
	});

	it('Join document', function() {
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('div.clipboard').as('clipboard');

		ceHelper.type('X');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', '1 word, 1 character');

		cy.cSetActiveFrame('#iframe1');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 1 character');
		cy.cGet('.leaflet-layer').click({force:true});
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', '1 word, 1 character');

		cy.cGet('.empty-deltas').then(($before) => {
			const beforeCount = $before.text();

			// joining triggered a theme related invalidation
			cy.cSetActiveFrame('#iframe2');
			cy.get('#form2').submit();

			cy.cSetActiveFrame('#iframe1');
			writerHelper.selectAllTextOfDoc();
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 1 character');
			cy.cGet('.leaflet-layer').click({force:true});
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', '1 word, 1 character');

			cy.cGet('.empty-deltas').should(($after) => {
				expect($after.text()).to.eq(beforeCount);
			});
		});
	});

	it('Join after document save and modify', function() {
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('div.clipboard').as('clipboard');

		ceHelper.type('X');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', '1 word, 1 character');

		cy.cSetActiveFrame('#iframe1');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 1 character');
		cy.cGet('.leaflet-layer').click({force:true});
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', '1 word, 1 character');

		cy.cGet('.empty-deltas').then(($before) => {
			var beforeCount = parseInt($before.text());

			// joins after a save triggered excessive invalidations on changes
			cy.cGet('#File-tab-label').click();
			cy.cGet('.notebookbar-shortcuts-bar .unoSave > button').click();

			// Reload page
			cy.cSetActiveFrame('#iframe2');
			cy.get('#form2').submit();
			// Wait for page to unload
			cy.wait(1000);
			// Wait for page to finish loading
			helper.documentChecks();

			cy.cSetActiveFrame('#iframe1');
			writerHelper.selectAllTextOfDoc();
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 1 character');
			cy.cGet('.leaflet-layer').click({force:true});
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', '1 word, 1 character');
			ceHelper.type('X');
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', '1 word, 2 characters');

			cy.cGet('.empty-deltas').should(($after) => {
				// allow one row of empty deltas, the case this protects regression against
				// is a whole document invalidation
				expect(parseInt($after.text())).to.be.lessThan(beforeCount + 10);
			});
		});
	});

});
