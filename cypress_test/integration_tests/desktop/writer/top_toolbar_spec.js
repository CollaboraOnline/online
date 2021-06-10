/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var writerHelper = require('../../common/writer_helper');

describe('Top toolbar tests.', function() {
	var testFileName = 'top_toolbar.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showSidebarIfHidden();
		}

		writerHelper.selectAllTextOfDoc();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Apply highlight color.', function() {
		cy.get('#tb_editbar_item_backcolor')
			.click();

		desktopHelper.selectColorFromPalette('FFF2CC');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #fff2cc');
	});

	it('Apply font color.', function() {
		cy.get('#tb_editbar_item_fontcolor')
			.click();

		desktopHelper.selectColorFromPalette('8E7CC3');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#8e7cc3');
	});

	it('Apply style.', function() {
		cy.get('#tb_editbar_item_styles')
			.click();

		desktopHelper.selectFromListbox('Title');

		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');
	});

	it('Apply font name.', function() {
		cy.get('#tb_editbar_item_fonts')
			.click();

		desktopHelper.selectFromListbox('Alef');

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Alef, sans-serif');
	});

	it('Apply bold font.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		cy.get('#tb_editbar_item_italic')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Apply underline.', function() {
		cy.get('#tb_editbar_item_underline')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikethrough.', function() {
		cy.get('#tb_editbar_item_strikeout')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply font size', function() {
		cy.get('#tb_editbar_item_fontsizes')
			.click();

		desktopHelper.selectFromListbox('72');

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 72pt');
	});

	it('Clear direct formatting', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p b')
			.should('exist');

		cy.get('#tb_editbar_item_reset')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p b')
			.should('not.exist');
	});

	it('Apply left/right alignment.', function() {
		cy.get('#tb_editbar_item_rightpara')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');

		cy.get('#tb_editbar_item_leftpara')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Apply center alignment.', function() {
		cy.get('#tb_editbar_item_centerpara')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply justified.', function() {
		cy.get('#tb_editbar_item_justifypara')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Apply Line spacing: 1 and 1.5', function() {
		cy.get('#tb_editbar_item_linespacing')
			.click();

		cy.contains('.menu-text', 'Line Spacing: 1.5')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'line-height: 150%');

		cy.get('#tb_editbar_item_linespacing')
			.click();

		cy.contains('.menu-text', 'Line Spacing: 1')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'line-height: 100%');
	});

	it('Apply Line spacing: 2', function() {
		cy.get('#tb_editbar_item_linespacing')
			.click();

		cy.contains('.menu-text', 'Line Spacing: 2')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'line-height: 200%');
	});

	it('Increase/Decrease Paragraph spacing', function() {
		cy.get('#tb_editbar_item_linespacing')
			.click();

		cy.contains('.menu-text', 'Increase Paragraph Spacing')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-top: 0.04in');

		writerHelper.selectAllTextOfDoc();

		//Decrease Paragraph Spacing
		cy.get('#tb_editbar_item_linespacing')
			.click();

		cy.contains('.menu-text', 'Decrease Paragraph Spacing')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('not.contain', 'margin-top: 0.04in');
	});

	it('Toggle numbered list.', function() {
		cy.get('#tb_editbar_item_defaultnumbering')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container ol')
			.should('exist');
	});

	it('Toggle bulleted list.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		cy.get('#tb_editbar_item_defaultbullet')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container ul')
			.should('exist');
	});

	it('Increase/Decrease Indent.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		//Increase indent
		cy.get('#tb_editbar_item_incrementindent')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.49in');

		//Decrease indent
		cy.get('#tb_editbar_item_decrementindent')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('not.contain', 'margin-left: 0.49in');
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
		cy.get('#annotation-modify-textarea-new').type('some text');

		cy.get('#annotation-save-new').click();

		cy.get('#comment-container-1').should('exist');

		cy.get('#annotation-content-area-1').should('have.text', 'some text');
	});

	it('Insert table.', function() {
		cy.get('#tb_editbar_item_inserttable')
			.click();

		cy.get('.inserttable-grid > .row > .col').eq(3)
		   .click();

		// Move cursor outside of the table to make selection work.
		helper.moveCursor('down');
		writerHelper.selectAllTextOfDoc();

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

		writerHelper.selectAllTextOfDoc();

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

		cy.get('.col.w2ui-icon.basicshapes_octagon')
			.click();

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

		writerHelper.selectAllTextOfDoc();

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

	it('Apply Undo/Redo.', function() {
		cy.get('#tb_editbar_item_italic')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('exist');

		//Undo
		cy.get('#tb_editbar_item_undo')
			.should('not.have.class', 'disabled')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('not.exist');

		//Redo
		cy.get('#tb_editbar_item_redo')
			.should('not.have.class', 'disabled')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Show/Hide sidebar.', function() {
		//hide sidebar
		desktopHelper.hideSidebar();

		//show sidebar
		desktopHelper.showSidebar();
	});

	it('Insert Special Character.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		cy.get('#tb_editbar_item_insertsymbol')
			.click();

		desktopHelper.checkDialogAndClose('Special Characters');
	});

	it('Hide/show menu bar.', function() {
		cy.get('#main-menu')
			.should('be.visible');

		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		// Hide the menu first.
		cy.get('#tb_editbar_item_fold')
			.click();

		cy.get('#main-menu')
			.should('not.be.visible');

		// Show it again.
		cy.get('#tb_editbar_item_fold')
			.click();

		cy.get('#main-menu')
			.should('be.visible');
	});

	it('Clone Formatting.', function() {
		// Select one character at the beginning of the text.
		helper.typeIntoDocument('{home}');

		helper.textSelectionShouldNotExist();

		helper.typeIntoDocument('{shift}{rightArrow}');

		helper.textSelectionShouldExist();

		// Apply bold and try to clone it to the whole word.
		cy.get('#tb_editbar_item_bold')
			.click();

		cy.get('#tb_editbar_item_formatpaintbrush')
			.click();

		// Click at the blinking cursor position.
		cy.get('.leaflet-cursor.blinking-cursor')
			.then(function(cursor) {
				var boundRect = cursor[0].getBoundingClientRect();
				var XPos = boundRect.left;
				var YPos = (boundRect.top + boundRect.bottom) / 2;

				cy.get('body')
					.click(XPos, YPos);
			});

		writerHelper.selectAllTextOfDoc();

		// Full word should have bold font.
		cy.get('#copy-paste-container p b')
			.should('contain', 'text');
	});
});
