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
	cy.wait(500);

	cy.cGet('.leaflet-marker-pane')
		.then(function(body) {
			if (body.find('.leaflet-selection-marker-start').length !== 0) {
				helper.typeIntoDocument('{downarrow}');
				cy.wait(1000);
			}
		});

	cy.cGet('.leaflet-selection-marker-start').should('not.exist');

	helper.selectAllText();

	cy.log('<< selectAllTextOfDoc - end');
}

function openFileProperties() {
	cy.log('>> openFileProperties - start');

	cy.cGet('#File-tab-label').then(function(element) {
		if (!element.hasClass('selected'))
			element.click();

		cy.cGet('#File-container .unoSetDocumentProperties').click();
	});

	cy.log('<< openFileProperties - end');
}

module.exports.selectAllTextOfDoc = selectAllTextOfDoc;
module.exports.openFileProperties = openFileProperties;
