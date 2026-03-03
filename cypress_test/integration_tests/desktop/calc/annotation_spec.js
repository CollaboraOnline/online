/* global describe it require cy beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop'], 'Annotation Tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/annotation.ods');
		desktopHelper.switchUIToNotebookbar();
		cy.getFrameWindow().then((win) => {
			this.win = win;
			helper.processToIdle(win);
		});
	});

	it('Insert',function() {
		// Make sure we know the cell adress.
		calcHelper.enterCellAddressAndConfirm(this.win, 'B2');

		desktopHelper.insertComment();

		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});

		// Move the mouse over commented cell without using trigger. "realMouseMove" function seems safer.
		cy.cGet('#test-div-OwnCellCursor').should('exist');
		cy.cGet('#test-div-OwnCellCursor').then((items) => {
			const cursor = items[0];
			const clientRectangle = cursor.getBoundingClientRect();
			const x = Math.round(clientRectangle.left + clientRectangle.width * 0.7);
			const y = Math.round(clientRectangle.top + clientRectangle.height * 0.5);
			const width = clientRectangle.width;
			const height = clientRectangle.height;

			cy.cGet('body').realMouseMove(x, y);

			// Comment should be visible now.
			cy.cGet('#annotation-content-area-1').should('be.visible');
			cy.cGet('#annotation-content-area-1').should('contain','some text');

			// Move the mouse to A1.
			cy.cGet('body').realMouseMove(x - width, y - height, { position: "topLeft" });
			// Comment shouldn't be visible now.
			cy.cGet('#annotation-content-area-1').should('not.be.visible');

			// Click on A1 while we are here.
			cy.cGet('body').realClick({ x: x - width, y: y - height });
			cy.cGet(helper.addressInputSelector).should('have.value', 'A1');

			// Now click again to cell B2. There was an issue with commented cells. We should be able to click on the commented cell.
			cy.cGet('body').realClick({ x: x, y: y });
			cy.cGet(helper.addressInputSelector).should('have.value', 'B2');
		});
	});

	it('Modify',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type(', some other text');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#annotation-content-area-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('contain','some text0, some other text');
		cy.cGet('#comment-container-1').should('exist');
	});

	it('Reply should not be possible', function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('.context-menu-list:visible .context-menu-item').should('not.have.text', 'Reply');
	});

	it('Remove',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('#comment-container-1').should('not.exist');
	});

	it('Delete then Create Sheet should not retain comment',function() {
		calcHelper.assertNumberofSheets(1);

		cy.cGet('#spreadsheet-toolbar #insertsheet').click();
		calcHelper.assertNumberofSheets(2);

		desktopHelper.insertComment();
		cy.cGet('.cool-annotation').should('exist');

		calcHelper.selectOptionFromContextMenu('Delete Sheet...');
		cy.cGet('#delete-sheet-modal-response').click();
		calcHelper.assertNumberofSheets(1);

		cy.cGet('#spreadsheet-toolbar #insertsheet').click();
		calcHelper.assertNumberofSheets(2);
		cy.cGet('#comment-container-1').should('not.exist');
	});

	it('Tab Navigation', function() {
		desktopHelper.insertComment(undefined, false);

		cy.cGet('.annotation-button-autosaved').should('not.exist');
		cy.cGet('.annotation-button-delete').should('not.exist');
		cy.realPress('Tab');
		cy.cGet('.annotation-button-autosaved').should('not.exist');
		cy.cGet('.annotation-button-delete').should('not.exist');
		cy.cGet('#annotation-cancel-new:focus-visible');

		cy.realPress('Tab');
		cy.cGet('#annotation-save-new:focus-visible');
		cy.cGet('.annotation-button-autosaved').should('not.exist');
		cy.cGet('.annotation-button-delete').should('not.exist');

		cy.realPress('Tab');
		cy.cGet('.annotation-button-autosaved').should('be.visible');
		cy.cGet('.annotation-button-delete').should('be.visible');
	});

	it('View Jump', function() {
		calcHelper.enterCellAddressAndConfirm(this.win, 'A100');
		desktopHelper.insertComment();
		/* comments are hidden in calc by default, so no visibility assert */
		cy.cGet('#comment-container-1').should('exist')
		cy.cGet('#Home-tab-label').click();

		calcHelper.enterCellAddressAndConfirm(this.win, 'A150');
		calcHelper.enterCellAddressAndConfirm(this.win, 'A135');

		/*
			NOTE: this scrollbar position might change in future. one can
			get the new scrollbar position by printing `x` to the console
			in `assertScrollbarPosition` function.
		*/
		desktopHelper.assertScrollbarPosition('vertical', 249, 252);
		desktopHelper.insertComment('second comment', false);
		desktopHelper.assertScrollbarPosition('vertical', 249, 252);
	});

});

describe(['tagdesktop'], 'Annotation Autosave Tests', function() {
	var newFilePath;

	beforeEach(function() {
		newFilePath = helper.setupAndLoadDocument('calc/annotation.ods');
		desktopHelper.switchUIToNotebookbar();
	});

	it('Insert autosave',function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.annotation-button-autosaved').should('be.visible');
		cy.cGet('.annotation-button-delete').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});

	it('Insert autosave save',function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.annotation-button-autosaved').should('be.visible');
		cy.cGet('.annotation-button-delete').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('.annotation-button-autosaved').should('be.not.visible');
		cy.cGet('.annotation-button-delete').should('be.not.visible');
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});

	it('Insert autosave cancel',function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.annotation-button-autosaved').should('be.visible');
		cy.cGet('.annotation-button-delete').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('.cool-annotation').should('not.exist');
		cy.cGet('.annotation-button-autosaved').should('not.exist');
		cy.cGet('.annotation-button-delete').should('not.exist');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('not.exist');
	});

	it('Modify autosave',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type(', some other text');
		cy.cGet('#map').focus();
		cy.cGet('.annotation-button-autosaved').should('be.visible');
		cy.cGet('.annotation-button-delete').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0, some other text');
	});

	it('Modify autosave save',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type(', some other text');
		cy.cGet('#map').focus();
		cy.cGet('.annotation-button-autosaved').should('be.visible');
		cy.cGet('.annotation-button-delete').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#annotation-content-area-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0, some other text');
		cy.cGet('#comment-container-1').should('exist');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0, some other text');
	});

	it('Modify autosave cancel',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.annotation-button-autosaved').should('be.visible');
		cy.cGet('.annotation-button-delete').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#annotation-content-area-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-container-1').should('exist');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover', {force: true});
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});
});
