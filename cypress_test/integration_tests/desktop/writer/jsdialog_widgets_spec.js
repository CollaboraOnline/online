/* global describe it cy require beforeEach */

var helper = require('../../common/helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'JSDialog widgets visual tests', function() {
	beforeEach(function() {
		helper.setupAndLoadDocument('writer/help_dialog.odt');
		cy.cGet('#Help-tab-label').click();
		cy.cGet('#about-button').click();
		cy.cGet('#js-dialog a').click({multiple: true, force: true});
	});

	it('Checkbox', function() {
		cy.cGet('#check_btn_1').compareSnapshot('checkbox_checked', 0.1);
		cy.cGet('#check_btn_2').compareSnapshot('checkbox', 0.1);
		cy.cGet('#check_btn_3').compareSnapshot('checkbox_disabled_checked', 0.1);
		cy.cGet('#check_btn_4').compareSnapshot('checkbox_disabled', 0.1);
	});

	it('Radio button', function() {
		cy.cGet('#radio_btn_1').compareSnapshot('radio_checked', 0.1);
		cy.cGet('#radio_btn_2').compareSnapshot('radio', 0.1);
		cy.cGet('#radio_btn_3').compareSnapshot('radio_disabled_checked', 0.1);
		cy.cGet('#radio_btn_4').compareSnapshot('radio_disabled', 0.1);
	});

	it('Treelistbox no-headers', function() {
		cy.cGet('#contenttree').compareSnapshot('treeview_no_headers', 0.05);
	});

	it('Treelistbox with-headers', function() {
		cy.cGet('#contenttree2').compareSnapshot('treeview_headers', 0.1);
	});
});
