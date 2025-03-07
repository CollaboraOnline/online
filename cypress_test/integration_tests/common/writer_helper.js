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

	// file properties dialog appears 2 times due to embedded tab pages
	// do not use it just after first one appears
	cy.cGet('.jsdialog-window')
		.should('exist')
		.then(dialog => {
			dialog.remove();
		});

	cy.cGet('.jsdialog-window').should('exist');

	cy.log('<< openFileProperties - end');
}

module.exports.selectAllTextOfDoc = selectAllTextOfDoc;
module.exports.openFileProperties = openFileProperties;
