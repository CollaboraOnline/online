/* -*- js-indent-level: 8 -*- */

/* global describe it cy require expect afterEach beforeEach */
var helper = require('../../common/helper');

describe(['tagdesktop'], 'JSDialog unit test', function() {
	var testFileName = 'help_dialog.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('JSDialog popup dialog', function() {
		cy.getFrameWindow()
			.its('L')
			.then(function(L) {
				var jsonDialog = {
					id: 'testpopup',
					jsontype: 'dialog',
					type: 'modalpopup',
					children: [{
						id: 'busycontainer',
						type: 'container',
						vertical: 'true',
						children: [{
							id: 'busylabel',
							type: 'fixedtext',
							text: 'test popup dialog'}]
					}]
				};
				var dialog = L.control.jsDialog();
				var fnClosePopup = cy.spy(dialog, 'closePopover');
				dialog.onJSDialog({data: jsonDialog, callback: function() {}});
				expect(Object.keys(dialog.dialogs)).to.have.length(1);
				dialog.closeAll(false);
				expect(fnClosePopup).to.be.called;
			});
	});

	it('JSDialog dropdown', function() {
		// Open conditional format menu
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#toolbar-up #home-conditional-format-menu-button').click();

		// Click on overlay to close
		cy.cGet('.jsdialog-overlay').click();

		// Dropdown should be closed
		cy.cGet('.jsdialog-overlay').should('not.exist');
		cy.cGet('#home-conditional-format-menu-dropdown').should('not.exist');
	});
});
