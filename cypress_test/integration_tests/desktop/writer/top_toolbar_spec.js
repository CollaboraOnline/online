/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var writerHelper = require('../../common/writer_helper');
var mode = Cypress.env('USER_INTERFACE');

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
		desktopHelper.actionOnSelector('backColor', (selector) => { cy.get(selector).click(); });

		desktopHelper.selectColorFromPalette('FFF2CC');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #fff2cc');
	});

	it('Apply font color.', function() {
		desktopHelper.actionOnSelector('fontColor', (selector) => { cy.get(selector).click(); });

		desktopHelper.selectColorFromPalette('8E7CC3');

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#8e7cc3');
	});

	it('Apply style.', function() {
		if (mode === 'notebookbar') {
			cy.contains('.notebookbar.ui-iconview-entry','Title')
				.click({force: true});
		} else {
			cy.get('#tb_editbar_item_styles')
				.click();

			desktopHelper.selectFromListbox('Title');
		}

		cy.get('#copy-paste-container p font font')
			.should('have.attr', 'style', 'font-size: 28pt');
	});


	it('Apply font name.', function() {
		desktopHelper.actionOnSelector('fontName', (selector) => { cy.get(selector).click(); });

		desktopHelper.selectFromListbox('Alef');

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Alef, sans-serif');
	});


	it('Apply bold font.', function() {
		desktopHelper.actionOnSelector('bold', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic font.', function() {
		desktopHelper.actionOnSelector('italic', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Apply underline.', function() {
		desktopHelper.actionOnSelector('underline', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikethrough.', function() {
		desktopHelper.actionOnSelector('strikeout', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply font size', function() {
		desktopHelper.actionOnSelector('fontSize', (selector) => { cy.get(selector).click(); });

		desktopHelper.selectFromListbox('72');

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'style', 'font-size: 72pt');
	});

	it('Clear direct formatting', function() {
		desktopHelper.actionOnSelector('bold', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p b')
			.should('exist');

		desktopHelper.actionOnSelector('clearFormat', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p b')
			.should('not.exist');
	});

	it('Apply left/right alignment.', function() {
		desktopHelper.actionOnSelector('rightPara', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');

		desktopHelper.actionOnSelector('leftPara', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Apply center alignment.', function() {
		desktopHelper.actionOnSelector('centerPara', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply justified.', function() {
		desktopHelper.actionOnSelector('justifyPara', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Apply Line spacing: 1 and 1.5', function() {
		desktopHelper.actionOnSelector('lineSpacing', (selector) => { cy.get(selector).click(); });

		cy.contains('.menu-text', 'Line Spacing: 1.5')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'line-height: 150%');

		desktopHelper.actionOnSelector('lineSpacing', (selector) => { cy.get(selector).click(); });

		cy.contains('.menu-text', 'Line Spacing: 1')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'line-height: 100%');
	});

	it('Apply Line spacing: 2', function() {
		desktopHelper.actionOnSelector('lineSpacing', (selector) => { cy.get(selector).click(); });

		cy.contains('.menu-text', 'Line Spacing: 2')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'line-height: 200%');
	});

	it('Increase/Decrease Paragraph spacing', function() {
		desktopHelper.actionOnSelector('lineSpacing', (selector) => { cy.get(selector).click(); });

		cy.contains('.menu-text', 'Increase Paragraph Spacing')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-top: 0.04in');

		writerHelper.selectAllTextOfDoc();

		//Decrease Paragraph Spacing
		desktopHelper.actionOnSelector('lineSpacing', (selector) => { cy.get(selector).click(); });

		cy.contains('.menu-text', 'Decrease Paragraph Spacing')
			.click();

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('not.contain', 'margin-top: 0.04in');
	});

	it('Toggle numbered list.', function() {
		desktopHelper.actionOnSelector('numberedList', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container ol')
			.should('exist');
	});

	it('Toggle bulleted list.', function() {
		mode !== 'notebookbar' ? cy.get('#toolbar-up .w2ui-scroll-right').click() : '';

		desktopHelper.actionOnSelector('bulletList', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container ul')
			.should('exist');
	});

	it('Increase/Decrease Indent.', function() {
		mode !== 'notebookbar' ? cy.get('#toolbar-up .w2ui-scroll-right').click() : '';

		//Increase indent
		desktopHelper.actionOnSelector('incrementIndent', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.49in');

		//Decrease indent
		desktopHelper.actionOnSelector('decrementIndent', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('not.contain', 'margin-left: 0.49in');
	});

	it('Insert comment.', function() {
		desktopHelper.insertMultipleComment('writer', 1, true);

		cy.get('.loleaflet-annotation-content-wrapper').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some text0');
	});

	it('Insert table.', function() {
		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		mode === 'notebookbar' ? cy.get('#toolbar-up .w2ui-scroll-right').click() : '';

		cy.wait(500);

		desktopHelper.actionOnSelector('insertTable', (selector) => { cy.get(selector).click(); });

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

		desktopHelper.actionOnSelector('insertGraphic', (selector) => { cy.get(selector).click(); });

		cy.get('#insertgraphic[type=file]')
			.attachFile('/desktop/writer/image_to_insert.png');

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g.Graphic')
			.should('exist');
	});

	it('Insert hyperlink.', function() {
		cy.get('#copy-paste-container p')
			.should('have.text', '\ntext');

		mode === 'notebookbar' ? cy.get('#Insert-tab-label').click() : '';

		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		desktopHelper.actionOnSelector('hyperLink', (selector) => { cy.get(selector).click(); });

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

		mode === 'notebookbar' ? cy.get('#Insert-tab-label').click() : '';

		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		desktopHelper.actionOnSelector('insertShape', (selector) => { cy.get(selector).click(); });

		cy.get('.col.w2ui-icon.basicshapes_octagon')
			.click();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');
	});

	it('Insert chart.', function() {
		mode === 'notebookbar' ? cy.get('#Insert-tab-label').click() : '';

		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		desktopHelper.actionOnSelector('insertChart', (selector) => { cy.get(selector).click(); });

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');
	});

	it.skip('Save.', function() {
		desktopHelper.actionOnSelector('bold', (selector) => { cy.get(selector).click(); });

		desktopHelper.actionOnSelector('save', (selector) => { cy.get(selector).click(); });

		helper.beforeAll(testFileName, 'writer', true);

		cy.wait(2000);

		writerHelper.selectAllTextOfDoc();

		cy.wait(2000);

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Print', function() {
		// A new window should be opened with the PDF.
		cy.window()
			.then(function(win) {
				cy.stub(win, 'open');
			});

		mode === 'notebookbar' ? cy.get('#File-tab-label').click() : '';

		desktopHelper.actionOnSelector('print', (selector) => { cy.get(selector).click(); });

		cy.window().its('open').should('be.called');
	});

	it('Apply Undo/Redo.', function() {
		desktopHelper.actionOnSelector('italic', (selector) => { cy.get(selector).click(); });

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('exist');

		//Undo
		desktopHelper.actionOnSelector('undo', (selector) => {
			cy.get(selector)
				.should('not.have.class', 'disabled')
				.click();
		});

		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('not.exist');

		//Redo
		desktopHelper.actionOnSelector('redo', (selector) => {
			cy.get(selector)
				.should('not.have.class', 'disabled')
				.click();
		});


		writerHelper.selectAllTextOfDoc();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});

	it('Show/Hide sidebar.', function() {
		//hide sidebar
		mode !== 'notebookbar' ? cy.get('#toolbar-up .w2ui-scroll-right').click() : '';

		cy.get('#sidebar-dock-wrapper')
			.should('be.visible');

		desktopHelper.actionOnSelector('sidebar', (selector) => { cy.get(selector).click(); });

		cy.get('#sidebar-dock-wrapper')
			.should('not.be.visible');

		mode !== 'notebookbar' ? cy.get('#toolbar-up .w2ui-scroll-left').click() : '';

		//show sidebar

		mode !== 'notebookbar' ? cy.get('#toolbar-up .w2ui-scroll-right').click() : '';

		cy.get('#sidebar-dock-wrapper')
			.should('not.be.visible');

		desktopHelper.actionOnSelector('sidebar', (selector) => { cy.get(selector).click(); });

		cy.get('#sidebar-dock-wrapper')
			.should('be.visible');

	});

	it('Insert Special Character.', function() {

		cy.get('#toolbar-up .w2ui-scroll-right')
			.click();

		mode === 'notebookbar' ? cy.get('#toolbar-up .w2ui-scroll-right').click() : '';

		cy.wait(500);

		desktopHelper.actionOnSelector('insertSymbol', (selector) => { cy.get(selector).click(); });

		desktopHelper.checkDialogAndClose('Special Characters');
	});

	it('Hide/show menu bar.', function() {
		if (mode !== 'notebookbar') {
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
		}
	});

	it('Clone Formatting.', function() {
		// Select one character at the beginning of the text.
		helper.typeIntoDocument('{home}');

		helper.textSelectionShouldNotExist();

		helper.typeIntoDocument('{shift}{rightArrow}');

		helper.textSelectionShouldExist();

		// Apply bold and try to clone it to the whole word.
		desktopHelper.actionOnSelector('bold', (selector) => { cy.get(selector).click(); });

		desktopHelper.actionOnSelector('formatBrush', (selector) => { cy.get(selector).click(); });

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
