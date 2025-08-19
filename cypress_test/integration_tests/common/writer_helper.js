/* global cy require*/

var helper = require('./helper');

// A special text selection method for Writer. It selects
// all text of the document, but it also removes previous
// selection if exists. This selection removal is helpful,
// when we use the copy-paste-container to check the selected
// text's content, because reselection will force an update
// on this content, so we don't need to worry about testing an
// out-dated content.
function selectAllTextOfDoc() {
	cy.log('>> selectAllTextOfDoc - start');

	// Remove selection if exist
	helper.typeIntoDocument('{downarrow}');

	cy.cGet('.text-selection-handle-start').should('not.be.visible');

	helper.selectAllText();

	cy.log('<< selectAllTextOfDoc - end');
}

function openFileProperties() {
	cy.log('>> openFileProperties - start');

	cy.cGet('.jsdialog-window').should('not.exist');

	cy.cGet('#File-tab-label').then(function(element) {
		if (!element.hasClass('selected'))
			element.click();

		cy.cGet('#File-container .unoSetDocumentProperties').click();
	});

	cy.cGet('.jsdialog-window').should('exist');

	cy.log('<< openFileProperties - end');
}

// QuickFind Related functions

function openQuickFind() {
	cy.log('>> openQuickFind - start');

	cy.cGet('#quickfind-dock-wrapper').should('not.be.visible');

	cy.cGet('#floating-navigator').click();

	// wait for navigator to load
	cy.cGet('#navigator-dock-wrapper').find('#contenttree').should('be.visible');

	cy.cGet('#tab-quick-find').click();

	cy.cGet('#quickfind-dock-wrapper').should('be.visible');

	cy.log('<< openQuickFind - end');
}

function searchInQuickFind(text) {
	cy.log('>> searchInQuickFind - start');

	cy.cGet('input#navigator-search-input').clear().type(text);
	cy.cGet('input#navigator-search-input').should('have.prop', 'value', text);

	cy.cGet('#navigator-search-button').click();

	cy.cGet('#numberofsearchfinds').should('not.be.empty');

	cy.log('<< searchInQuickFind - end');
}

function assertQuickFindMatches(expectedCount) {
	cy.log('>> assertQuickFindMatches - start');

	cy.cGet('#numberofsearchfinds').should('have.text', expectedCount + ' results');

	cy.log('<< assertQuickFindMatches - end');
}

module.exports.selectAllTextOfDoc = selectAllTextOfDoc;
module.exports.openFileProperties = openFileProperties;
module.exports.openQuickFind = openQuickFind;
module.exports.searchInQuickFind = searchInQuickFind;
module.exports.assertQuickFindMatches = assertQuickFindMatches;
