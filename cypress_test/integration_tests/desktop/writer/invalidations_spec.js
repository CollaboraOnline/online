/* global describe it cy beforeEach expect require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var ceHelper = require('../../common/contenteditable_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Invalidation tests.', function() {

	beforeEach(function() {
		// Turn off SpellChecking by default because grammar checking,
		// when available, currently adds an extra empty update when
		// grammar checking kicks in at server-side idle after a change.
		localStorage.setItem('SpellOnline', false);
		cy.viewport(1920,1080);
	});

	// Clicking in an empty header area shouldn't invalidate anything
	it('Click Empty Header.', function() {
		helper.setupAndLoadDocument('writer/invalidations.odt');
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('div.clipboard').as('clipboard');
		cy.cGet('#stylesview .ui-iconview-entry img').should('exist');
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', '0 words, 0 characters');

		// Add some main body text of X
		ceHelper.type('X');
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', '1 word, 1 character');

		cy.cGet('.empty-deltas').then(($before) => {
			const beforeCount = $before.text();

			// Click in header area (there is no actual header, We are testing that nothing
			// happens if there is no header in the document)
			cy.cGet('#document-container').click(200, 50);

			// Wait until we have round trip of selection of 'X' and tile updates will have arrived.
			writerHelper.selectAllTextOfDoc();
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 1 character');

			cy.cGet('.empty-deltas').should(($after) => {
				expect($after.text()).to.eq(beforeCount);
			});
		});
	});

	// Clicking in an existing header area shouldn't result in useless invalidations
	it('Click Existing Header.', function() {
		helper.setupAndLoadDocument('writer/invalidations_headers.odt');
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('div.clipboard').as('clipboard');
		cy.cGet('#stylesview .ui-iconview-entry img').should('exist');
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', '2 words, 3 characters');

		writerHelper.selectAllTextOfDoc();
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 1 character');

		cy.cGet('.empty-deltas').then(($before) => {
			const beforeCount = $before.text();

			// click in header area
			cy.cGet('#document-container').click(200, 50);

			// verify the content is 'YY'
			writerHelper.selectAllTextOfDoc();
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 2 characters');

			// verify empty deltas is unchanged
			cy.cGet('.empty-deltas').should(($after) => {
				expect($after.text()).to.eq(beforeCount);
			});
		});

		cy.cGet('.empty-deltas').then(($before) => {
			const beforeCount = $before.text();

			// click in main document
			cy.cGet('#document-container').click(200, 400);

			// verify the content is 'X'
			writerHelper.selectAllTextOfDoc();
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 1 character');

			// verify empty deltas is unchanged
			cy.cGet('.empty-deltas').should(($after) => {
				expect($after.text()).to.eq(beforeCount);
			});
		});
	});

	// Entering a bullet portion shouldn't invalidate anything
	it('Enter Numbering Portion.', function() {
		helper.setupAndLoadDocument('writer/invalidations.odt');
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('div.clipboard').as('clipboard');
		cy.cGet('#stylesview .ui-iconview-entry img').should('exist');
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', '0 words, 0 characters');

		// Add some main body text of X and bullet
		ceHelper.type('XX');
		cy.cGet('.notebookbar > .unoDefaultBullet > button').filter(':visible').click();
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', '2 words, 3 characters');

		cy.cGet('.empty-deltas').then(($before) => {
			const beforeCount = $before.text();

			// move caret before 'X' and after bullet
			ceHelper.moveCaret('home');

			// enter numbering portion, this used to invalidate
			ceHelper.moveCaret('left');

			// leave numbering portion, this used to invalidate
			ceHelper.moveCaret('end');

			ceHelper.moveCaret('left', 'shift');
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 1 character');

			cy.cGet('.empty-deltas').should(($after) => {
				expect($after.text()).to.eq(beforeCount);
			});
		});
	});

});
