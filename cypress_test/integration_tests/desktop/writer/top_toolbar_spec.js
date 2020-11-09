/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Top toolbar tests.', function() {
	var testFileName = 'top_toolbar.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showSidebarIfHidden();
		}

		helper.selectAllText(false);
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});
	
	it('Apply highlight color.', function() {
		cy.get('#tb_editbar_item_backcolor')
			.click();

		cy.get('.w2ui-color [name="FFF2CC"]')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #fff2cc');
	});

	it('Apply font color.', function() {
		cy.get('#tb_editbar_item_fontcolor')
			.click();

		cy.get('.w2ui-color [name="8E7CC3"]')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#8e7cc3');
	});

	it('Apply style.', function() {
		cy.get('#tb_editbar_item_styles')
			.click();

		cy.contains('.select2-results__option','Title')
			 .click({force: true});

		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');
	});

	it('Apply font name.', function() {
		cy.get('#tb_editbar_item_fonts')
			.click();

		cy.contains('.select2-results__option','Alef')
			 .click({force: true});

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Alef, sans-serif');
	});

	it('Apply bold font.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		cy.get('#tb_editbar_item_italic')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Apply underline.', function() {
		cy.get('#tb_editbar_item_underline')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikethrough.', function() {
		cy.get('#tb_editbar_item_strikeout')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply font size', function() {
		cy.get('#tb_editbar_item_fontsizes')
			.click();

		cy.contains('.select2-results__option','72')
			 .click();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 72pt');
	});

	it('Clear direct formatting', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p b')
			.should('exist');
		
		cy.get('#tb_editbar_item_reset')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p b')
			.should('not.exist');
	});

	it('Apply left alignment.', function() {
		cy.get('#tb_editbar_item_centerpara')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');

		cy.get('#tb_editbar_item_leftpara')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Apply center alignment.', function() {
		cy.get('#tb_editbar_item_centerpara')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply right alignment.', function() {
		cy.get('#tb_editbar_item_rightpara')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');
	});

	it('Apply justified.', function() {
		cy.get('#tb_editbar_item_justifypara')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Toggle numbered list.', function() {
		cy.get('#tb_editbar_item_defaultnumbering')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container ol')
			.should('exist');
	});

	it('Toggle bulleted list.', function() {
		cy.get('#tb_editbar_item_defaultbullet')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container ul')
			.should('exist');
	});
	it('Increase/Decrease Indent.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		//Increase indent
		cy.get('#tb_editbar_item_incrementindent')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style', 'margin-left: 0.49in; margin-bottom: 0in; font-style: normal; font-weight: normal; line-height: 100%');

		//Decrease indent
		cy.get('#tb_editbar_item_decrementindent')
			.click();

		helper.reselectAllText();

		
		cy.get('#copy-paste-container p')
			.should('have.attr', 'style', 'margin-bottom: 0in; font-style: normal; font-weight: normal; line-height: 100%');
	});

	it('Insert comment.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		cy.get('#tb_editbar_item_insertannotation')
			.click();

		// Comment insertion dialog is opened
		cy.get('.loleaflet-annotation-table')
			.should('exist');

		// Add some comment
		cy.get('.loleaflet-annotation-edit:nth-of-type(2) .loleaflet-annotation-textarea')
			.type('some text');

		cy.get('#annotation-save')
			.click();

		cy.get('.loleaflet-annotation')
			.should('exist');

		cy.get('.loleaflet-annotation-content.loleaflet-dont-break')
			.should('have.text', 'some text');
	});

	it('Insert table.', function() {
		cy.get('#tb_editbar_item_inserttable')
			.click();

		cy.get('.inserttable-grid > .row > .col').eq(3)
		   .click();

		helper.reselectAllText();
		
		cy.get('#copy-paste-container table')
			.should('exist');
	});

	it('Insert image.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
		   .click();
		cy.get('#tb_editbar_item_insertgraphic')
			.should('be.visible');

		cy.get('#insertgraphic[type=file]')
			.attachFile('/desktop/writer/image_to_insert.png');
		
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g.Graphic')
			.should('exist');
	});

	it('Insert hyperlink.', function() {
		cy.get('#copy-paste-container p')
			.should('have.text', '\ntext');

		cy.get('#toolbar-up .w2ui-scroll-right')
		   .click();
		
		cy.get('#tb_editbar_item_link')
			.click();

		cy.get('.vex-content.hyperlink-dialog')
			.should('exist');

		cy.get('#hyperlink-text-box')
			.type('link');
			
		cy.get('#hyperlink-link-box')
			.type('www.something.com');

		cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p')
			.should('have.text', '\ntextlink');

		cy.get('#copy-paste-container p a')
			.should('have.attr', 'href', 'http://www.something.com/');
	});

	it('Insert shape.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
		    .click();

		cy.get('#tb_editbar_item_insertshapes')
		    .click();

		cy.get('.col.w2ui-icon.basicshapes_octagon').
			click();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');
	});

	it('Insert chart.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
		    .click();

		cy.get('#tb_editbar_item_insertobjectchart')
		    .click();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');
	});

	it('Save.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		cy.get('#tb_editbar_item_save')
			.click();

		helper.beforeAll(testFileName, 'writer', true);

		helper.reselectAllText();

		cy.get('#copy-paste-container p b')
			.should('exist');

	});

	it('Print', function() {
		// A new window should be opened with the PDF.
		cy.window()
			.then(function(win) {
				cy.stub(win, 'open');
			});

		cy.get('#tb_editbar_item_print')
		    .click();

		cy.window().its('open').should('be.called');
	});
	
	it.skip('Apply Undo/Redo.', function() {
		cy.get('#tb_editbar_item_italic')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p i')
			.should('exist');

		//Undo
		cy.get('#tb_editbar_item_undo')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p i')
			.should('not.exist');

		//Redo
		cy.get('#tb_editbar_item_redo')
			.click();

		helper.reselectAllText();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Show/Hide sidebar.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
		   .click();
		cy.get('#tb_editbar_item_sidebar')
			.click();

		//show sidebar
		desktopHelper.showSidebar();
		
		//hide sidebar
		desktopHelper.hideSidebar();
	});

});
