/* global cy require*/

var helper = require('./helper');
var desktopHelper = require('./desktop_helper');

// A special text selection method for Writer. It selects
// all text of the document, but it also removes previous
// selection if exists. This selection removal is helpful,
// when we use the copy-paste-container to check the selected
// text's content, because reselection will force an update
// on this content, so we don't need to worry about testing an
// out-dated content.
function selectAllTextOfDoc() {
	cy.log('Select all text of Writer document - start.');

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

	cy.log('Select all text of Writer document - end.');
}

function openFileProperties() {
	desktopHelper.actionOnSelector('fileTab', (selector) => { cy.cGet(selector).click(); });

	desktopHelper.actionOnSelector('documentProperties', (selector) => { cy.cGet(selector).click(); });
}

module.exports.selectAllTextOfDoc = selectAllTextOfDoc;
module.exports.openFileProperties = openFileProperties;
