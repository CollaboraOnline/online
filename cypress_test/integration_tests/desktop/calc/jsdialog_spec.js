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

	it('JSDialog child focus', function() {
		cy.getFrameWindow().then(function(win) {
			var smile = win.document.querySelector('meta[name="previewSmile"]').content;
			var jsonDialog = {
				id: 'testfocus',
				type: 'dialog',
				text: 'Focus test',
				children: [{
					id: 'tabcontrol',
					type: 'tabcontrol',
					selected: 1,
					tabs: [{
						text: 'Test Focus',
						id: 1,
						name: 'testfocus'}],
					children: [{
						id: 'tabpage',
						type: 'tabpage',
						enabled: true,
						text: 'Focus',
						children: [{
							id: 'container',
							type: 'container',
							children: [{
								id: 'colorsetwin',
								type: 'scrollwindow',
								children: [{
									id: 'colorset',
									type: 'drawingarea',
									imagewidth: 216,
									imageheight: 180,
									image: smile }]}, {
								id: 'testcheck',
								type: 'checkbox',
								text: 'checkbox' }]
						}]
					}]
				}]};

			var dialog = win.L.control.jsDialog();
			dialog.onJSDialog({data: jsonDialog, callback: function() {}});
			expect(Object.keys(dialog.dialogs)).to.have.length(1);

			var current = win.document.activeElement;
			expect(current.id).to.equal('tabcontrol-1');

			cy.realPress('Tab').then(function() {
				var next = win.document.activeElement;
				expect(next.id).to.equal('colorset-img');
				dialog.closeAll(false);
			});
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

		// check watermark checkbox to enable watermark entry input
		cy.cGet('#watermark-input').check();
		// after enable watermark checkbox the input field beside should also be in enabled state
		cy.cGet('#watermarkentry-input').should('not.be.disabled');

	});

	it('JSDialog check data validity options', function() {
		cy.cGet('#Data-tab-label').click();
		cy.cGet('#data-validation').click();

		// On changing options other fields should toggle enable and disable
		cy.cGet('#data-input').should('be.disabled');
		cy.cGet('#allow-input').select("1");

		cy.cGet('#data-input').should('not.be.disabled');
	});
});
