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
		// Turn off SideBar by default so the visual area is always the
		// same regardless if the sidebar size changes between versions.
		localStorage.setItem('UIDefaults_text_ShowSidebar', false);
		helper.setupAndLoadDocument('writer/invalidations.odt');
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('div.clipboard').as('clipboard');
	});

	it('Click Existing Header.', function() {
		cy.cGet('.empty-deltas').should('have.text', '63:0:0');
		cy.pause();

		// Add some main body text of XX
		ceHelper.type('XX');

		cy.pause();
		cy.cGet('.empty-deltas').should('have.text', '63:2:10');

		// Add a header with YY in it
		cy.cGet('#Insert-tab-label').click();
		cy.pause();
		cy.cGet('.notebookbar > .unoInsertPageHeader > button').click();
		cy.pause();

		cy.cGet('.empty-deltas').should('have.text', '63:6:41');

		ceHelper.type('Y');

		cy.cGet('.empty-deltas').should('have.text', '63:7:46');

		// Click back in main document
		// Selects the wrong paragraph without this wait, not sure why
		cy.wait(200);
		cy.cGet('.leaflet-layer').click(200, 300);
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 2 characters');

//		cy.pause();
		cy.cGet('.empty-deltas').should('have.text', '63:8:46');

		{

			// Selects the wrong paragraph without this wait, not sure why
			cy.wait(200);

			// click in header area
			cy.cGet('.leaflet-layer').click(200, 50);

			// verify the content is 'Y'
			writerHelper.selectAllTextOfDoc();
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 1 character');

//			cy.pause();
			// verify empty deltas is unchanged
			cy.cGet('.empty-deltas').should('have.text', '63:9:46');
		}

		{

//			cy.pause();
			cy.cGet('.empty-deltas').should('have.text', '63:9:46');

			// click in main document
			cy.cGet('.leaflet-layer').click(200, 300);

			// verify the content is 'XX'
			writerHelper.selectAllTextOfDoc();
			cy.cGet('#toolbar-down #StateWordCount').should('have.text', 'Selected: 1 word, 2 characters');

//			cy.pause();
			// verify empty deltas is unchanged
			cy.cGet('.empty-deltas').should('have.text', '63:10:46');
		}
	});

});
