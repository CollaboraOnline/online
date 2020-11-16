/* global cy require*/

var helper = require('./helper');

function selectAllTextOfDoc() {
	cy.log('Select all text of Writer document - start.');

	// Remove selection if exist
	cy.get('.leaflet-marker-pane')
		.then(function(body) {
			if (body.find('.leaflet-selection-marker-start').length !== 0) {
				helper.typeIntoDocument('{downarrow}');
			}
		});

	cy.get('.leaflet-selection-marker-start')
		.should('not.exist');

	helper.selectAllText(false);

	cy.log('Select all text of Writer document - end.');
}

module.exports.selectAllTextOfDoc = selectAllTextOfDoc;
