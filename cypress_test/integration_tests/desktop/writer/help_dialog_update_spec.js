// This spec file doesnot test anything and it is use to update
// help dialog screenshots. You can run this spec using:
// make UPDATE_SCREENSHOT=true check-desktop spec=writer/help_dialog_update_spec.js
// UPDATE_SCREENSHOT needs to be true otherwise cypress will not run the spec file and
// update the screenshot

/* global describe it cy require afterEach beforeEach Cypress*/

const { hideSidebar } = require('../../common/desktop_helper');
var helper = require('../../common/helper');
describe('Help dialog screenshot updation', function() {
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
		helper.waitUntilIdle('#toolbar-down');

		cy.document().then((doc) => {
			const ele1 = doc.getElementById('toolbar-down');
			const ele2 = doc.getElementById('tb_actionbar_item_break8');
			const width =  ele2.getBoundingClientRect().left - ele1.getBoundingClientRect().left;
			cy.get('#toolbar-down').screenshot('status-bar', {clip: {x:0, y:0, height:300 , width: width}});
			cy.log(Cypress.env('SCREENSHOT_FOLDER'), Cypress.env('IMAGES_FOLDER'));
			copyScreenshot('status-bar.png');
		});
	});

	it('Infobar', function() {
		helper.waitUntilIdle('#toolbar-down');

		cy.document().then((doc) => {
			const ele1 = doc.getElementById('toolbar-down');
			const ele2 = doc.getElementById('tb_actionbar_item_break8');
			const width = ele1.getBoundingClientRect().right - ele2.getBoundingClientRect().right + 10;
			cy.get('#toolbar-down').screenshot('information-bar', {clip: {x:ele2.getBoundingClientRect().right, y:0, height:300, width:width}});
			copyScreenshot('information-bar.png');
		});
	});

	it('Document repair', function() {
		cy.get('#toolbar-up > .w2ui-scroll-right').click();
		//insert
		cy.get('#tb_editbar_item_insertshapes')
			.click()
			.get('.col.w2ui-icon.symbolshapes')
			.click();

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		cy.wait(1000);

		cy.get('#menu-editmenu').click()
			.get('#menu-repair').click();

		cy.get('.jsdialog-container.lokdialog_container') 
			.should('exist');

		helper.waitUntilIdle('.jsdialog-container.lokdialog_container');

		cy.get('.jsdialog-container.lokdialog_container')
			.screenshot('repair-document');

		copyScreenshot('repair-document.png');
	});

	it('Comment', function() {
		hideSidebar();

		cy.get('#toolbar-up > .w2ui-scroll-right').click();

		cy.get('#tb_editbar_item_insertannotation')
			.click();

		cy.get('#new-mobile-comment-input-area').type('comment added');

		cy.get('.vex-dialog-buttons .button-primary').click(); // save button

		cy.wait(1000);

		cy.get('.jsdialog-container.cool-annotation-collapsed').click();

		cy.wait(1000);

		cy.get('.cool-annotation-content-wrapper').should('exist');

		cy.get('#comment .cool-annotation').screenshot('comment');

		copyScreenshot('comment.png');
	});

	it('Style formatting', function() {
		cy.get('#menu-editmenu')
			.click();

		cy.contains('#menu-editmenu li a', 'Edit Style...')
			.click();

		cy.wait(1000)
			.get('.lokdialog_canvas')
			.should('exist');

		helper.waitUntilIdle('.lokdialog_canvas');

		cy.get('.lokdialog_canvas').then(items => {
			var Xpos = items[0].getBoundingClientRect().left + 80;
			var Ypos = items[0].getBoundingClientRect().top + 10;

			cy.wrap(items[0])
				.click(Xpos, Ypos);
		});

		helper.waitUntilIdle('.lokdialog_container');

		cy.get('.lokdialog_container')
			.screenshot('paragraph-dialog');

		copyScreenshot('paragraph-dialog.png');
	});

	it('Table', function() {
		hideSidebar();

		cy.get('#toolbar-up > .w2ui-scroll-right')
			.click();

		cy.get('#tb_editbar_item_inserttable')
			.click();

		cy.get('.inserttable-grid > :nth-child(4) > :nth-child(4)')
			.trigger('mouseover');

		helper.waitUntilIdle('#inserttable-popup');

		cy.get('#inserttable-popup')
			.screenshot('insert-table', {padding: 30});

		copyScreenshot('insert-table.png');
	});

	it('Word count', function() {
		cy.get('#menu-tools')
			.click();

		cy.contains('#menu-tools li a', 'Word Count...')
			.click();

		helper.waitUntilIdle('.lokdialog_container');

		cy.get('.lokdialog_container')
			.screenshot('word-count');

		copyScreenshot('word-count.png');
	});

	it('Insert special', function() {
		cy.get('#toolbar-up > .w2ui-scroll-right')
			.click();

		cy.get('#tb_editbar_item_insertsymbol')
			.click();

		cy.wait(1000);

		cy.get('.lokdialog_canvas')
			.should('exist');

		helper.waitUntilIdle('.lokdialog_container');

		cy.get('.lokdialog_container')
			.screenshot('special-character');

		copyScreenshot('special-character.png');
	});

	it('Manage changes', function() {
		cy.get('#menu-editmenu')
			.click()
			.get('#menu-changesmenu')
			.click()
			.contains('Record')
			.click();

		helper.typeIntoDocument('Hello World');

		cy.get('#toolbar-up > .w2ui-scroll-right').click();
		//insert
		cy.get('#tb_editbar_item_insertshapes')
			.click()
			.get('.col.w2ui-icon.symbolshapes')
			.click();

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		cy.wait(1000);

		cy.get('#menu-editmenu')
			.click()
			.get('#menu-changesmenu')
			.click()
			.contains('Manage...')
			.click();

		cy.get('.lokdialog_canvas')
			.should('exist');

		helper.waitUntilIdle('.lokdialog_container');

		cy.get('.lokdialog_container')
			.screenshot('manage-changes');

		copyScreenshot('manage-changes.png');
	});

	it('Page styles', function() {
		cy.get('#menu-format')
			.click();

		cy.contains('#menu-format li a', 'Page Style...')
			.click();

		cy.wait(1000);

		cy.get('.lokdialog_canvas')
			.should('exist');

		helper.waitUntilIdle('.lokdialog_container');

		cy.get('.lokdialog_container')
			.screenshot('page-style');

		copyScreenshot('page-style.png');
	});

	it('Insert chart', function() {
		hideSidebar();

		cy.get('#menu-insert')
			.click()
			.contains('Chart...')
			.click();

		cy.wait(1000);

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist').screenshot('chart', {padding: 10});

		copyScreenshot('chart.png');
	});
});
