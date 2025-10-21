/* global describe it cy beforeEach require expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Spell checking menu.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/spellchecking.odp');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	function openContextMenu() {
		// Click on the center of the slide to step into text edit mode
		cy.cGet('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.cGet('body').dblclick(XPos, YPos);
			});

		helper.typeIntoDocument('{leftArrow}');

		helper.textSelectionShouldNotExist();

		// Open context menu
		cy.cGet('#canvas-container svg')
			.then(function(shape) {
				expect(shape.length).to.be.equal(2);
				var x = parseInt(shape[0].style.left.replace('px', '')) + parseInt(shape[0].style.width.replace('px', '')) / 2;
				var y = parseInt(shape[0].style.top.replace('px', '')) + parseInt(shape[0].style.height.replace('px', '')) / 2;

				cy.cGet('#document-container')
				.trigger('pointerdown', x, y, { force: true, button: 0, pointerType: 'mouse' })
				.wait(2000)
				.trigger('pointerup', x, y, { force: true, button: 0, pointerType: 'mouse' });
			});

		cy.cGet('#mobile-wizard-content').should('be.visible');
	}

	it('Apply suggestion.', function() {
		helper.setDummyClipboardForCopy();
		openContextMenu();

		cy.cGet('body').contains('.context-menu-link', 'hello').click();
		impressHelper.selectTextOfShape();
		helper.copy();

		helper.expectTextForClipboard('hello');
	});

	it('Ignore all.', function() {
		openContextMenu();

		cy.cGet('body').contains('.context-menu-link', 'Ignore All').click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.cGet('body').contains('.context-menu-link', 'Paste').should('be.visible');
	});
});
