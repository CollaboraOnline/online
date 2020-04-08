/* global cy require expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

function copyShapeContentToClipboard() {
	cy.log('Copying shape content to clipboard - start.');

	// TODO: this fails on assertHaveKeyboardInput()
	// assertInTextEditMode();

	helper.selectAllText(false);

	// Open context menu
	cy.get('.leaflet-marker-icon')
		.then(function(marker) {
			expect(marker).to.have.lengthOf(2);
			var XPos = (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
			var YPos = marker[0].getBoundingClientRect().top - 5;
			mobileHelper.executeCopyFromContextMenu(XPos, YPos);
		});

	cy.log('Copying shape content to clipboard - end.');
}


module.exports.copyShapeContentToClipboard = copyShapeContentToClipboard;
