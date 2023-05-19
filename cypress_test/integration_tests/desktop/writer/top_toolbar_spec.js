/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagdesktop'], 'Top toolbar tests.', function() {
	var origTestFileName = 'top_toolbar.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		desktopHelper.switchUIToNotebookbar();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showSidebarIfHidden();
		}

		writerHelper.selectAllTextOfDoc();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function refreshCopyPasteContainer() {
		helper.typeIntoDocument('{rightArrow}');
		writerHelper.selectAllTextOfDoc();
	}

	it('Apply highlight color.', function() {
		desktopHelper.actionOnSelector('backColor', (selector) => { cy.cGet(selector).click(); });
		desktopHelper.selectColorFromPalette('FFF2CC');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #fff2cc');
	});

	it('Apply font color.', function() {
		desktopHelper.actionOnSelector('fontColor', (selector) => { cy.cGet(selector).click(); });
		desktopHelper.selectColorFromPalette('8E7CC3');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p font').should('have.attr', 'color', '#8e7cc3');
	});

	it('Apply style.', function() {
		cy.cGet('.notebookbar.ui-iconview-entry img[title=Title]').click({force: true});
		refreshCopyPasteContainer();
		cy.cGet('#copy-paste-container p font font').should('have.attr', 'style', 'font-size: 28pt');
	});

	it('Apply font name.', function() {
		desktopHelper.actionOnSelector('fontName', (selector) => { cy.cGet(selector).click(); });
		desktopHelper.selectFromListbox('Alef');
		refreshCopyPasteContainer();
		cy.cGet('#copy-paste-container p font').should('have.attr', 'face', 'Alef, sans-serif');
	});

	it('Apply bold font.', function() {
		cy.cGet('.cell.notebookbar > .unoBold > button').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p b').should('exist');
	});

	it('Apply italic font.', function() {
		cy.cGet('.cell.notebookbar > .unoItalic > button').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p i').should('exist');
	});

	it('Apply underline.', function() {
		cy.cGet('.cell.notebookbar > .unoUnderline > button').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p u').should('exist');
	});

	it('Apply strikethrough.', function() {
		cy.cGet('.cell.notebookbar > .unoStrikeout > button').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p strike').should('exist');
	});

	it('Apply font size', function() {
		desktopHelper.actionOnSelector('fontSize', (selector) => { cy.cGet(selector).click(); });
		desktopHelper.selectFromListbox('72');
		refreshCopyPasteContainer();
		cy.cGet('#copy-paste-container p font').should('have.attr', 'style', 'font-size: 72pt');
	});

	it('Clear direct formatting', function() {
		cy.cGet('.cell.notebookbar > .unoBold > button').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p b').should('exist');
		cy.cGet('.cell.notebookbar > .unoResetAttributes').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p b').should('not.exist');
	});

	it('Apply left/right alignment.', function() {
		cy.cGet('#Home .cell.notebookbar > .unoBold > button').click();
		writerHelper.selectAllTextOfDoc();
		//cy.cGet('#copy-paste-container p').should('have.attr', 'align', 'right');
		cy.cGet('#Home .cell.notebookbar > .unoRightPara').click();
		writerHelper.selectAllTextOfDoc();
		//cy.cGet('#copy-paste-container p').should('have.attr', 'align', 'left');
	});

	it('Apply center alignment.', function() {
		cy.cGet('#Home .cell.notebookbar > .unoCenterPara').click();
		writerHelper.selectAllTextOfDoc();
		//cy.cGet('#copy-paste-container p').should('have.attr', 'align', 'center');
	});

	it('Apply justified.', function() {
		cy.cGet('#Home .cell.notebookbar > div.unoJustifyPara > button.unobutton').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p').should('have.attr', 'align', 'justify');
	});

	it('Apply Line spacing: 1 and 1.5', function() {
		cy.cGet('#Home .cell.notebookbar .unoLineSpacing button').click();
		cy.cGet('[id$=line-spacing-menu]').contains('.menu-text', 'Line Spacing: 1.5').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'line-height: 150%');
		cy.cGet('#Home .cell.notebookbar .unoLineSpacing button').click();
		cy.cGet('[id$=line-spacing-menu]').contains('.menu-text', 'Line Spacing: 1').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'line-height: 100%');
	});

	it('Apply Line spacing: 2', function() {
		cy.cGet('#Home .cell.notebookbar .unoLineSpacing button').click();
		cy.cGet('[id$=line-spacing-menu]').contains('.menu-text', 'Line Spacing: 2').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p').should('have.attr', 'style').should('contain', 'line-height: 200%');
	});

	it('Increase/Decrease Paragraph spacing', function() {
		cy.cGet('.cell.notebookbar .unoLineSpacing button').click();
		cy.cGet('[id$=line-spacing-menu]').contains('.menu-text', 'Increase Paragraph Spacing').click();

		writerHelper.selectAllTextOfDoc();

		cy.cGet('#copy-paste-container p').should('have.attr', 'style')
			.should('contain', 'margin-top: 0.04in');

		writerHelper.selectAllTextOfDoc();

		cy.cGet('.cell.notebookbar .unoLineSpacing button').click();
		cy.cGet('[id$=line-spacing-menu]').contains('.menu-text', 'Decrease Paragraph Spacing').click();

		writerHelper.selectAllTextOfDoc();

		cy.cGet('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('not.contain', 'margin-top: 0.04in');
	});

	it('Toggle numbered list.', function() {
		desktopHelper.actionOnSelector('numberedList', (selector) => { cy.cGet(selector).click(); });
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container ol').should('exist');
	});

	it('Toggle bulleted list.', function() {
		desktopHelper.actionOnSelector('bulletList', (selector) => { cy.cGet(selector).click(); });
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container ul').should('exist');
	});

	it('Increase/Decrease Indent.', function() {
		//Increase indent
		desktopHelper.actionOnSelector('incrementIndent', (selector) => { cy.cGet(selector).click(); });
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('contain', 'margin-left: 0.49in');

		//Decrease indent
		desktopHelper.actionOnSelector('decrementIndent', (selector) => { cy.cGet(selector).click(); });
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p')
			.should('have.attr', 'style')
			.should('not.contain', 'margin-left: 0.49in');
	});

	it('Insert/delete table.', function() {
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.wait(500);
		desktopHelper.actionOnSelector('insertTable', (selector) => { cy.cGet(selector).click(); });
		cy.cGet('.inserttable-grid > .row > .col').eq(3).click();
		helper.typeIntoDocument('{ctrl}a');
		cy.cGet('#copy-paste-container table').should('exist');
		helper.typeIntoDocument('{ctrl}a');
		helper.typeIntoDocument('{shift}{del}');
		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('not.exist');
	});

	it('Insert image.', function() {
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		desktopHelper.actionOnSelector('insertGraphic', (selector) => { cy.cGet(selector).click(); });
		cy.cGet('#insertgraphic[type=file]').attachFile('/desktop/writer/image_to_insert.png');
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g.Graphic').should('exist');
	});

	it('Insert hyperlink.', function() {
		helper.expectTextForClipboard('text text1');
		cy.cGet('#Insert-tab-label').click();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		desktopHelper.actionOnSelector('hyperLink', (selector) => { cy.cGet(selector).click(); });
		cy.cGet('#hyperlink-link-box').should('exist');
		cy.cGet('#hyperlink-text-box').type('link');
		cy.cGet('#hyperlink-link-box').type('www.something.com');
		cy.cGet('#response-ok').click();
		writerHelper.selectAllTextOfDoc();
		helper.expectTextForClipboard('text text1link');
		cy.cGet('#copy-paste-container p a').should('have.attr', 'href', 'http://www.something.com/');
	});

	it('Insert/delete shape.', function() {
		cy.cGet('#Insert-tab-label').click();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();

		desktopHelper.actionOnSelector('insertShape', (selector) => { cy.cGet(selector).click(); });

		cy.cGet('.col.w2ui-icon.basicshapes_octagon').click();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});

	it('Insert/delete chart.', function() {
		cy.cGet('#Insert-tab-label').click();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		desktopHelper.actionOnSelector('insertChart', (selector) => { cy.cGet(selector).click(); });
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');

		//delete
		helper.typeIntoDocument('{del}');
		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});

	it('Save.', { defaultCommandTimeout: 60000 }, function() {
		cy.cGet('.cell.notebookbar > .unoBold > button').click();
		desktopHelper.actionOnSelector('save', (selector) => { cy.cGet(selector).click(); });
		helper.reload(testFileName, 'writer', true);
		cy.wait(2000);
		writerHelper.selectAllTextOfDoc();
		cy.wait(2000);
		cy.cGet('#copy-paste-container p b').should('exist');
	});

	it('Print', function() {
		// A new window should be opened with the PDF.
		helper.getCoolFrameWindow()
			.then(function(win) {
				cy.stub(win, 'open');
			});

		cy.cGet('#File-tab-label').click();
		desktopHelper.actionOnSelector('print', (selector) => { cy.cGet(selector).click(); });
		helper.getCoolFrameWindow()
			.then(function(win) {
				cy.wrap(win).its('open').should('be.called');
			});
	});

	it('Apply Undo/Redo.', function() {
		cy.cGet('.cell.notebookbar > .unoItalic > button').click();
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p i').should('exist');

		//Undo
		desktopHelper.actionOnSelector('undo', (selector) => {
			cy.cGet(selector).should('not.have.class', 'disabled').click();
		});

		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p i').should('not.exist');

		//Redo
		desktopHelper.actionOnSelector('redo', (selector) => {
			cy.cGet(selector).should('not.have.class', 'disabled').click();
		});

		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p i').should('exist');
	});

	it('Show/Hide sidebar.', function() {
		cy.cGet('#View-tab-label').click();
		cy.cGet('#sidebar-dock-wrapper').should('be.visible');
		// Hide.
		cy.cGet('[id="SidebarDeck.PropertyDeck"]').click();
		cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');
		// Show.
		cy.cGet('[id="SidebarDeck.PropertyDeck"]').click();
		cy.cGet('#sidebar-dock-wrapper').should('be.visible');
	});

	it('Insert Special Character.', function() {
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.wait(500);
		desktopHelper.actionOnSelector('insertSymbol', (selector) => { cy.cGet(selector).click(); });
		cy.cGet('.jsdialog-container.ui-dialog.ui-widget-content.lokdialog_container').should('be.visible');
		cy.cGet('.ui-dialog-title').should('have.text', 'Special Characters');
		helper.clickOnIdle('#favchar1');
		helper.clickOnIdle('.ui-pushbutton.jsdialog.button-primary');
		//helper.expectTextForClipboard('€');
	});

	it('Clone Formatting.', function() {
		// Select one character at the beginning of the text.
		helper.typeIntoDocument('{home}');
		helper.textSelectionShouldNotExist();
		helper.typeIntoDocument('{shift}{rightArrow}');
		helper.textSelectionShouldExist();

		// Apply bold and try to clone it to the whole word.
		cy.cGet('.cell.notebookbar > .unoBold > button').click();
		cy.cGet('.cell.notebookbar > .unoFormatPaintbrush').click();

		// Click at the blinking cursor position.
		cy.cGet('.leaflet-cursor.blinking-cursor')
			.then(function(cursor) {
				var boundRect = cursor[0].getBoundingClientRect();
				var XPos = boundRect.left;
				var YPos = (boundRect.top + boundRect.bottom) / 2;
				cy.cGet('body').click(XPos, YPos);
			});

		writerHelper.selectAllTextOfDoc();

		// Full word should have bold font.
		cy.cGet('#copy-paste-container p b').should('contain', 'text');
	});

	it.skip('Insert Page Break', function() {
		cy.cGet('#StatePageNumber').should('have.text', 'Page 1 of 1');
		helper.selectAllText();
		helper.expectTextForClipboard('text text1');
		helper.typeIntoDocument('{end}');
		helper.typeIntoDocument('{ctrl}{leftarrow}');
		cy.cGet('#Insert-tab-label').click();
		cy.cGet('#Insert-container-row .unoInsertPagebreak').click();
		cy.cGet('#StatePageNumber').should('have.text', 'Pages 1 and 2 of 2');
		helper.selectAllText();

		//var data = [];
		//var expectedData = ['text ', 'text1'];

		//helper.waitUntilIdle('#copy-paste-container');

		//cy.cGet('#copy-paste-container').find('p').each($el => {
		//	cy.wrap($el)
		//		.invoke('text')
		//		.then(text => {
		//			data.push(text);
		//		});
		//	cy.log(data);
		//}).then(() => {
		//	expect(data.length).eq(expectedData.length);
		//	var isEqual = true;
		//	for (var i = 0; i < data.length; i++) {
		//		isEqual = isEqual && ((data[i] == expectedData[i]) ||
		//			(data[i] == '\n' + expectedData[i]) ||
		//			(data[i] == '\n' + expectedData[i] + '\n'));
		//	}
		//	expect(isEqual).to.be.true;
		//});
	});

	it('Apply superscript.', function() {
		writerHelper.selectAllTextOfDoc();
		cy.cGet('.cell.notebookbar .unoSuperScript').click();
		cy.cGet('.leaflet-layer').click('center');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p sup').should('exist');
	});

	it('Apply subscript.', function() {
		writerHelper.selectAllTextOfDoc();
		cy.cGet('.cell.notebookbar .unoSubScript').click();
		cy.cGet('.leaflet-layer').click('center');
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#copy-paste-container p sub').should('exist');
	});

	it('Delete Text', function() {
		helper.selectAllText();
		helper.expectTextForClipboard('text text1');
		helper.typeIntoDocument('{del}');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();
	});

	it('Insert/delete Fontwork', function() {
		writerHelper.selectAllTextOfDoc();
		cy.cGet('#Insert-tab-label').click();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#FontworkGalleryFloater').click();
		cy.cGet('#ok').click();
		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive').should('exist');

		//delete
		helper.typeIntoDocument('{del}');
		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive').should('not.exist');
	});
});
