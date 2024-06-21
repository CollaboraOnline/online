/* global describe it cy beforeEach require expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagproxy'], 'Focus tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/focus.odt');
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
		cy.cGet('#Paragraph').click();
		cy.cGet('#aboveparaspacing .spinfield').should('have.value', '0');
		// Need to wait before clicking on spinfield
		cy.wait(500);
		cy.cGet('#aboveparaspacing .spinfield').click();
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
		cy.cGet('#canvas-container > svg').should('exist');
		// One tap on the shape
		cy.cGet('#canvas-container > svg > svg')
			.then(function(svg) {
				expect(parseInt(svg[0].style.width.replace('px', ''))).to.be.greaterThan(0);
				expect(parseInt(svg[0].style.height.replace('px', ''))).to.be.greaterThan(0);
				var posX = parseInt(svg[0].style.width.replace('px', '')) + parseInt(svg[0].style.left.replace('px', '')) / 2;
				var posY = parseInt(svg[0].style.height.replace('px', '')) + parseInt(svg[0].style.top.replace('px', '')) / 2;
				cy.cGet('.leaflet-layer').click(posX, posY);
			});

		// No focus on the document
		helper.assertFocus('tagName', 'BODY');

		// Double tap on the shape
		cy.cGet('#canvas-container > svg > svg')
			.then(function(svg) {
				expect(parseInt(svg[0].style.width.replace('px', ''))).to.be.greaterThan(0);
				expect(parseInt(svg[0].style.height.replace('px', ''))).to.be.greaterThan(0);
				var posX = parseInt(svg[0].style.width.replace('px', '')) + parseInt(svg[0].style.left.replace('px', '')) / 2;
				var posY = parseInt(svg[0].style.height.replace('px', '')) + parseInt(svg[0].style.top.replace('px', '')) / 2;

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
		cy.cGet('#mobile-wizard .unoBold').click();
		cy.cGet('#mobile-wizard .unoBold').should('have.class', 'selected');
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
		cy.cGet('#toolbar-down .unoBold').should('not.have.class', 'selected');
		helper.assertHaveKeyboardInput();
		cy.cGet('#toolbar-down .unoBold').click();
		cy.cGet('#toolbar-down .unoBold').should('have.class', 'selected');
		helper.assertHaveKeyboardInput();
	});

	it('Apply italic, check keyboard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Grab focus to the document
		helper.typeIntoDocument('x');
		helper.selectAllText();
		cy.cGet('#toolbar-down .unoItalic').should('not.have.class', 'selected');
		helper.assertHaveKeyboardInput();
		cy.cGet('#toolbar-down .unoItalic').click();
		cy.cGet('#toolbar-down .unoItalic').should('have.class', 'selected');
		helper.assertHaveKeyboardInput();
	});

	it('Apply underline, check keyboard.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Grab focus to the document
		helper.typeIntoDocument('x');
		helper.selectAllText();
		cy.cGet('#toolbar-down .unoUnderline').should('not.have.class', 'selected');
		helper.assertHaveKeyboardInput();
		cy.cGet('#toolbar-down .unoUnderline').click();
		cy.cGet('#toolbar-down .unoUnderline').should('have.class', 'selected');
		helper.assertHaveKeyboardInput();
	});
});
