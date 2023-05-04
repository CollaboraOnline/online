/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagproxy'], 'Focus tests', function() {
	var origTestFileName = 'focus.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Basic document focus.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Click in the document
		cy.cGet('#document-container').click();
		helper.assertFocus('className', 'clipboard');
	});

	it('Focus with opened mobile wizard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Click in the document
		cy.cGet('#document-container').click();
		// Clipboard has the focus -> can type in the document
		helper.assertFocus('className', 'clipboard');
		mobileHelper.openMobileWizard();
		// Body should have the focus (no focus on document)
		helper.assertFocus('tagName', 'BODY');
		mobileHelper.closeMobileWizard();
	});

	it('Focus inside mobile wizard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		mobileHelper.openMobileWizard();
		// Open paragraph properties
		helper.clickOnIdle('#Paragraph');
		cy.cGet('#aboveparaspacing .spinfield').should('have.value', '0');
		helper.clickOnIdle('#aboveparaspacing .spinfield');
		// The spinfield should have the focus now.
		helper.assertFocus('className', 'spinfield');
		mobileHelper.closeMobileWizard();
	});

	it('Focus after insertion.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		mobileHelper.openInsertionWizard();
		// Select More Fields
		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard.ui-widget', 'More Fields...').click();
		// Insert a field
		cy.cGet('body').contains('.menu-entry-with-icon', 'Page Number').click();
		cy.cGet('#mobile-wizard').should('not.be.visible');
		// After insertion the document gets the focus
		helper.assertFocus('className', 'clipboard');
	});

	it('Shape related focus.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		mobileHelper.openInsertionWizard();
		// Do insertion
		cy.cGet('body').contains('.menu-entry-with-icon', 'Shape').click();
		cy.cGet('.col.w2ui-icon.basicshapes_rectangle').click();
		// Check that the shape is there
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');
		// One tap on the shape
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg')
			.then(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
				var posX = svg[0].getBBox().x + svg[0].getBBox().width / 2;
				var posY = svg[0].getBBox().y + svg[0].getBBox().height / 2;
				cy.cGet('#document-container').click(posX, posY);
			});

		// No focus on the document
		helper.assertFocus('tagName', 'BODY');

		// Double tap on the shape
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg')
			.then(function(svg) {
				expect(svg[0].getBBox().width).to.be.greaterThan(0);
				expect(svg[0].getBBox().height).to.be.greaterThan(0);
				var posX = svg[0].getBBox().x + svg[0].getBBox().width / 2;
				var posY = svg[0].getBBox().y + svg[0].getBBox().height / 2;

				cy.cGet('#document-container').dblclick(posX, posY);
			});

		cy.cGet('.blinking-cursor').should('be.visible');
		// Document still has the focus
		helper.assertFocus('className', 'clipboard');
		helper.assertHaveKeyboardInput();
	});

	it('Focus with hamburger menu.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Click in the document
		cy.cGet('#document-container').click();
		// Clipboard has the focus -> can type in the document
		helper.assertFocus('className', 'clipboard');
		// Open hamburger menu
		mobileHelper.openHamburgerMenu();
		// Close hamburger menu
		mobileHelper.closeHamburgerMenu();
	});

	it('Focus after applying font change.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Click in the document
		cy.cGet('#document-container').click();
		// Clipboard has the focus -> can type in the document
		helper.assertFocus('className', 'clipboard');
		mobileHelper.openMobileWizard();
		// No focus
		helper.assertFocus('tagName', 'BODY');
		// Apply bold
		helper.clickOnIdle('.unoBold');
		cy.cGet('.unoBold').should('have.class', 'selected');
		// No focus
		helper.assertFocus('tagName', 'BODY');
		mobileHelper.closeMobileWizard();
	});

	it('Apply bold, check keyboard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Grab focus to the document
		helper.typeIntoDocument('x');
		helper.selectAllText();
		cy.cGet('#tb_editbar_item_bold div table').should('not.have.class', 'checked');
		helper.assertHaveKeyboardInput();
		cy.cGet('#tb_editbar_item_bold').click();
		cy.cGet('#tb_editbar_item_bold div table').should('have.class', 'checked');
		helper.assertHaveKeyboardInput();
	});

	it('Apply italic, check keyboard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Grab focus to the document
		helper.typeIntoDocument('x');
		helper.selectAllText();
		cy.cGet('#tb_editbar_item_italic div table').should('not.have.class', 'checked');
		helper.assertHaveKeyboardInput();
		cy.cGet('#tb_editbar_item_italic').click();
		cy.cGet('#tb_editbar_item_italic div table').should('have.class', 'checked');
		helper.assertHaveKeyboardInput();
	});

	it('Apply underline, check keyboard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Grab focus to the document
		helper.typeIntoDocument('x');
		helper.selectAllText();
		cy.cGet('#tb_editbar_item_underline div table').should('not.have.class', 'checked');
		helper.assertHaveKeyboardInput();
		cy.cGet('#tb_editbar_item_underline').click();
		cy.cGet('#tb_editbar_item_underline div table').should('have.class', 'checked');
		helper.assertHaveKeyboardInput();
	});
});
