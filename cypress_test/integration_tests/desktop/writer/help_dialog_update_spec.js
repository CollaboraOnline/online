// This spec file doesnot test anything and it is use to update
// help dialog screenshots. You can run this spec using:
// make UPDATE_SCREENSHOT=true check-desktop spec=writer/help_dialog_update_spec.js
// UPDATE_SCREENSHOT needs to be true otherwise cypress will not run the spec file and
// update the screenshot

/* global describe it cy require afterEach beforeEach Cypress*/

const { hideSidebar } = require('../../common/desktop_helper');
var helper = require('../../common/helper');
describe(['tagscreenshot'], 'Help dialog screenshot updation', function() {
	var testFileName = 'help_dialog.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function copyScreenshot(fileName) {
		cy.task('copyFile', {
			sourceDir: Cypress.env('SCREENSHOT_FOLDER')+ '/writer/help_dialog_update_spec.js/',
			destDir: Cypress.env('IMAGES_FOLDER'),
			fileName: fileName,
		});
	}

	it('Statusbar', function() {
		var w1, w2;
		cy.cGet('#toolbar-down').should('exist').then(el => {
			w1 = el[0].getBoundingClientRect().left;
			cy.cGet('#tb_actionbar_item_break8').should('exist').then(el => {
				w2 = el[0].getBoundingClientRect().left;
				var width = w2 - w1;
				cy.log('w1 w2 ' + w1 + ' ' + w2);
				cy.cGet('#toolbar-down').screenshot('status-bar', { clip: { x: 0, y: 0, height: 300, width: width } });
				cy.log(Cypress.env('SCREENSHOT_FOLDER'), Cypress.env('IMAGES_FOLDER'));
				copyScreenshot('status-bar.png');
			});
		});
	});

	it('Infobar', function() {
		var w1, w2;
		cy.cGet('#toolbar-down').should('exist').then(el => {
			w1 = el[0].getBoundingClientRect().right;
			cy.cGet('#tb_actionbar_item_break8').should('exist').then(el => {
				w2 = el[0].getBoundingClientRect().right;
				var width = w1 - w2 + 10;
				cy.cGet('#toolbar-down').screenshot('information-bar', { clip: { x: w2, y: 0, height: 300, width: width} });
				copyScreenshot('information-bar.png');
			});
		});
	});

	it('Document repair', function() {
		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		//insert
		cy.cGet('#tb_editbar_item_insertshapes').click();
		cy.cGet('.col.w2ui-icon.symbolshapes').click();
		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive').should('exist');
		cy.cGet('#menu-editmenu').click();
		cy.cGet('#menu-repair').click();
		cy.cGet('.jsdialog-container.lokdialog_container').should('exist');
		cy.cGet('.jsdialog-container.lokdialog_container').screenshot('repair-document');
		copyScreenshot('repair-document.png');
	});

	it.skip('Comment', function() {
		hideSidebar();

		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		cy.cGet('#tb_editbar_item_insertannotation').click();
		cy.cGet('#input-modal-input').type('comment added');
		cy.cGet('.vex-dialog-buttons .button-primary').click(); // save button
		cy.wait(1000);
		cy.cGet('.jsdialog-container.cool-annotation-collapsed').click();
		cy.wait(1000);
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#comment .cool-annotation').screenshot('comment');

		copyScreenshot('comment.png');
	});

	it('Style formatting', function() {
		cy.cGet('#menu-editmenu').click();
		cy.cGet('body').contains('#menu-editmenu li a', 'Edit Style...').click();
		cy.cGet('#TemplateDialog2').should('exist');
		cy.cGet('#TemplateDialog2').screenshot('paragraph-dialog');
		copyScreenshot('paragraph-dialog.png');
	});

	it('Table', function() {
		hideSidebar();

		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		cy.cGet('#tb_editbar_item_inserttable').click();
		cy.cGet('.inserttable-grid > :nth-child(4) > :nth-child(4)').trigger('mouseover');

		helper.waitUntilIdle('#inserttable-popup');
		cy.cGet('#inserttable-popup').screenshot('insert-table', {padding: 30});

		copyScreenshot('insert-table.png');
	});

	it('Word count', function() {
		cy.cGet('#menu-tools').click();
		cy.cGet('body').contains('#menu-tools li a', 'Word Count...').click();
		helper.waitUntilIdle('.lokdialog_container');
		cy.cGet('.lokdialog_container').screenshot('word-count');
		copyScreenshot('word-count.png');
	});

	it('Insert special', function() {
		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		cy.cGet('#tb_editbar_item_insertsymbol').click();
		cy.cGet('#SpecialCharactersDialog').should('exist');
		cy.cGet('#SpecialCharactersDialog').screenshot('special-character');
		copyScreenshot('special-character.png');
	});

	it('Manage changes', function() {
		cy.cGet('#menu-editmenu').click();
		cy.cGet('#menu-changesmenu').click();
		cy.cGet('#menu-changesmenu').contains('Record').click();

		helper.typeIntoDocument('Hello World');

		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		//insert
		cy.cGet('#tb_editbar_item_insertshapes').click();
		cy.cGet('.col.w2ui-icon.symbolshapes').click();

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive').should('exist');

		cy.cGet('#menu-editmenu').click();
		cy.cGet('#menu-changesmenu').click();
		cy.cGet('#menu-changesmenu').contains('Manage...').click();
		cy.cGet('.lokdialog_canvas').should('exist');
		cy.wait(1000); // For dialog's height to be calculated.
		cy.cGet('.lokdialog_container').should('exist').screenshot('manage-changes');
		copyScreenshot('manage-changes.png');
	});

	it('Page styles', function() {
		cy.cGet('#menu-format').click();
		cy.cGet('body').contains('#menu-format li a', 'Page Style...').click();
		cy.cGet('#TemplateDialog8').should('exist');
		cy.cGet('#TemplateDialog8').screenshot('page-style');
		copyScreenshot('page-style.png');
	});

	it('Insert chart', function() {
		hideSidebar();

		cy.cGet('#menu-insert').click();
		cy.cGet('#menu-insert').contains('Chart...').click();
		cy.wait(1000);
		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist').screenshot('chart', {padding: 10});

		copyScreenshot('chart.png');
	});
});
