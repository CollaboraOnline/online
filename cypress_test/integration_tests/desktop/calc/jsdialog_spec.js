/* -*- js-indent-level: 8 -*- */

/* global describe it cy require expect beforeEach */
var helper = require('../../common/helper');

describe(['tagdesktop'], 'JSDialog unit test', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/help_dialog.ods');
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
		cy.cGet('#toolbar-up .ui-scroll-right').click();
		cy.cGet('#toolbar-up .ui-scroll-right').click();
		cy.cGet('#toolbar-up #home-conditional-format-menu-button').click();

		// Click on overlay to close
		cy.cGet('.jsdialog-overlay').click();

		// Dropdown should be closed
		cy.cGet('.jsdialog-overlay').should('not.exist');
		cy.cGet('#home-conditional-format-menu-dropdown').should('not.exist');
	});

	it('JSDialog check enable edit input', function() {
		cy.cGet('#File-tab-label').click();
		cy.cGet('#File-container .unodownloadas button').click();

		// open "PDF options JsDialog"
		cy.cGet('.exportpdf-submenu-icon').click();

		// check water marker checkbox to enable water mark entry input
		cy.cGet('#watermark-input').check();
		// after enable eatermark checkbox the input filed beside should also be in enabled state
		cy.cGet('#watermarkentry-input').should('not.be.disabled');

	});
});
