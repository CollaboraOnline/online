/* global describe it cy beforeEach expect require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var ceHelper = require('../../common/contenteditable_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagmultiuser'], 'Joining a document should not trigger an invalidation', function() {
	var origTestFileName = 'invalidations.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer', undefined, true);
		desktopHelper.switchUIToNotebookbar();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Join document', function() {
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('div.clipboard').as('clipboard');

		// Disable Grammar (and SpellChecking)
		// TODO: Grammar checking, when available, adds an extra empty update when
		// it kicks in after a change
		cy.cGet('#Review-tab-label').click();
		cy.cGet('.notebookbar > .unoSpellOnline > button').click();

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

		// Disable Grammar (and SpellChecking)
		// TODO: Grammar checking, when available, adds an extra empty update when
		// it kicks in after a change
		cy.cGet('#Review-tab-label').click();
		cy.cGet('.notebookbar > .unoSpellOnline > button').click();

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
			// Wait for page to finish loading
			helper.checkIfDocIsLoaded(true);

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
