/* global cy require expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

function copyShapeContentToClipboard() {
	// TODO: this fails on assertHaveKeyboardInput()
	// assertInTextEditMode();

	helper.selectAllText(false);

	// Open context menu
	cy.get('.leaflet-marker-icon')
		.then(function(marker) {
			expect(marker).to.have.lengthOf(2);
			var XPos = (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
			var YPos = marker[0].getBoundingClientRect().top - 5;
			mobileHelper.longPressOnDocument(XPos, YPos);
		});

	cy.get('#mobile-wizard')
		.should('be.visible');

	// Execute copy
	cy.get('.ui-header.level-0.mobile-wizard.ui-widget .context-menu-link .menu-entry-with-icon', {timeout : 10000})
		.contains('Copy')
		.click();

	// Close warning about clipboard operations
	cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
		.click();

	// Wait until it's closed
	cy.get('.vex-overlay')
		.should('not.exist');
}


module.exports.copyShapeContentToClipboard = copyShapeContentToClipboard;
