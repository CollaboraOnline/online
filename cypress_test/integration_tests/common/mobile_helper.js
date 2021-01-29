/* global cy expect require Cypress */

var helper = require('./helper');

// Enable editing if we are in read-only mode.
function enableEditingMobile() {
	cy.log('Enabling editing mode - start.');

	cy.get('#mobile-edit-button')
		.then(function(button) {
			if (button.css('display') !== 'none') {

				cy.get('#tb_actionbar_item_closemobile .editmode')
					.should('not.exist');

				cy.get('#tb_actionbar_item_closemobile .closemobile')
					.should('be.visible');

				cy.get('#mobile-edit-button')
					.click();
			}
		});


	cy.get('#tb_actionbar_item_closemobile .editmode')
		.should('be.visible');

	cy.get('#tb_actionbar_item_closemobile .closemobile')
		.should('not.exist');

	// Wait until all UI update is finished.
	cy.get('#toolbar-down')
		.should('be.visible');

	helper.doIfInCalc(function() {
		cy.get('#formulabar')
			.should('be.visible');

		// we should have a cell selected here
		cy.get('.spreadsheet-cell-resize-marker')
			.should('be.visible');
	});

	// In writer, we should have the blinking cursor visible
	// after stepping into editing mode.
	helper.doIfInWriter(function() {
		cy.get('.blinking-cursor')
			.should('be.visible');
	});

	cy.log('Enabling editing mode - end.');
}

function longPressOnDocument(posX, posY) {
	cy.log('Emulating a long press - start.');
	cy.log('Param - posX: ' + posX);
	cy.log('Param - posY: ' + posY);

	cy.get('.leaflet-pane.leaflet-map-pane')
		.then(function(items) {
			expect(items).have.length(1);

			var eventOptions = {
				force: true,
				button: 0,
				pointerType: 'mouse',
				x: posX - items[0].getBoundingClientRect().left,
				y: posY - items[0].getBoundingClientRect().top
			};

			cy.get('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerdown', eventOptions)
				.trigger('pointermove', eventOptions);

			// This value is set in Map.TouchGesture.js.
			cy.wait(500);

			cy.get('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerup', eventOptions);
		});

	cy.log('Emulating a long press - end.');
}

function openHamburgerMenu() {
	cy.log('Opening hamburger menu - start.');

	cy.get('#toolbar-hamburger')
		.should('not.have.class', 'menuwizard-opened');

	cy.get('#toolbar-hamburger .main-menu-btn-icon')
		.click({force: true});

	cy.get('#toolbar-hamburger')
		.should('have.class', 'menuwizard-opened');

	cy.get('#mobile-wizard-content')
		.should('not.be.empty');

	cy.log('Opening hamburger menu - end.');
}

function closeHamburgerMenu() {
	cy.log('Closing hamburger menu - start.');

	cy.get('#toolbar-hamburger')
		.should('have.class', 'menuwizard-opened');

	cy.get('#toolbar-hamburger .main-menu-btn-icon')
		.click({force: true});

	cy.get('#toolbar-hamburger')
		.should('not.have.class', 'menuwizard-opened');

	cy.get('#mobile-wizard-content')
		.should('be.empty');

	cy.log('Closing hamburger menu - end.');
}

function openMobileWizard() {
	cy.log('Opening mobile wizard - start.');

	// Open mobile wizard
	cy.get('#tb_actionbar_item_mobile_wizard')
		.should('not.have.class', 'disabled')
		.click();

	// Mobile wizard is opened and it has content
	cy.get('#mobile-wizard-content')
		.should('not.be.empty');
	cy.get('#tb_actionbar_item_mobile_wizard table')
		.should('have.class', 'checked');

	cy.log('Opening mobile wizard - end.');
}

function closeMobileWizard() {
	cy.log('Closing mobile wizard - start.');

	cy.get('#tb_actionbar_item_mobile_wizard table')
		.should('have.class', 'checked');

	cy.get('#tb_actionbar_item_mobile_wizard')
		.click();

	cy.get('#mobile-wizard')
		.should('not.be.visible');
	cy.get('#tb_actionbar_item_mobile_wizard table')
		.should('not.have.class', 'checked');

	cy.log('Closing mobile wizard - end.');
}

function executeCopyFromContextMenu(XPos, YPos) {
	cy.log('Executing copy from context menu - start.');
	cy.log('Param - XPos: ' + XPos);
	cy.log('Param - YPos: ' + YPos);

	longPressOnDocument(XPos, YPos);

	// Execute copy
	cy.contains('.menu-entry-with-icon', 'Copy')
		.click();

	// Close warning about clipboard operations
	cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
		.click();

	// Wait until it's closed
	cy.get('.vex-overlay')
		.should('not.exist');

	cy.log('Executing copy from context menu - end.');
}

function openInsertionWizard() {
	cy.log('Opening insertion wizard - start.');

	cy.get('#tb_actionbar_item_insertion_mobile_wizard')
		.should('not.have.class', 'disabled')
		.click();

	cy.get('#mobile-wizard-content')
		.should('not.be.empty');

	cy.get('#tb_actionbar_item_insertion_mobile_wizard table')
		.should('have.class', 'checked');

	cy.log('Opening insertion wizard - end.');
}

function openCommentWizard() {
	cy.log('Opening Comment wizard - start.');

	cy.get('#tb_actionbar_item_comment_wizard')
		.should('not.have.class', 'disabled')
		.click();

	cy.get('#tb_actionbar_item_comment_wizard table')
		.should('have.class', 'checked');

	cy.log('Opening Comment wizard - end.');
}

function closeInsertionWizard() {
	cy.log('Closing insertion wizard - start.');

	cy.get('#tb_actionbar_item_insertion_mobile_wizard table')
		.should('have.class', 'checked');

	cy.get('#tb_actionbar_item_insertion_mobile_wizard')
		.click();

	cy.get('#mobile-wizard')
		.should('not.be.visible');

	cy.get('#tb_actionbar_item_insertion_mobile_wizard table')
		.should('not.have.class', 'checked');

	cy.log('Closing insertion wizard - end.');
}

function selectFromColorPalette(paletteNum, groupNum, colorNum) {
	cy.log('Selecting a color from the color palette - start.');

	cy.get('#color-picker-' + paletteNum.toString() + '-basic-color-' + groupNum.toString())
		.click();

	if (colorNum !== undefined) {
		cy.get('#color-picker-' + paletteNum.toString() + '-tint-' + colorNum.toString())
			.click();
	}

	cy.get('#mobile-wizard-back')
		.click();

	cy.log('Selecting a color from the color palette - end.');
}

function openTextPropertiesPanel() {
	openMobileWizard();

	helper.clickOnIdle('#TextPropertyPanel');

	cy.get('#Bold')
		.should('be.visible');
}

function selectHamburgerMenuItem(menuItems) {
	cy.log('Selecting hamburger menu item - start.');
	cy.log('Param - menuItems: ' + menuItems);

	openHamburgerMenu();

	for (var i = 0; i < menuItems.length; i++) {
		cy.contains('.menu-entry-with-icon', menuItems[i])
			.click();

		if (Cypress.env('INTEGRATION') !== 'nextcloud') {
			if (i === menuItems.length - 1) {
				cy.contains('.menu-entry-with-icon', menuItems[i])
					.should('not.exist');
			} else {
				cy.contains('.menu-entry-with-icon', menuItems[i])
					.should('not.be.visible');
			}
		}
	}

	cy.log('Selecting hamburger menu item - end.');
}

function selectAnnotationMenuItem(menuItem) {
	cy.log('Selecting annotation menu item - start.');

	cy.get('.wizard-comment-box .loleaflet-annotation-menu')
		.click({force: true});

	cy.get('.context-menu-list')
		.should('exist');

	cy.contains('.context-menu-item', menuItem)
		.click();

	cy.log('Selecting annotation menu item - end.');
}

function selectListBoxItem(listboxSelector, item) {
	cy.log('Selecting an item from listbox - start.');

	helper.clickOnIdle(listboxSelector);

	helper.clickOnIdle('.mobile-wizard.ui-combobox-text', item);

	helper.clickOnIdle('#mobile-wizard-back');

	// Combobox entry contains the selected item
	cy.get(listboxSelector + ' .ui-header-right .entry-value')
		.should('have.text', item);

	cy.log('Selecting an item from listbox - end.');
}

function selectListBoxItem2(listboxSelector, item) {
	cy.log('Selecting an item from listbox 2 - start.');

	helper.clickOnIdle(listboxSelector);

	helper.clickOnIdle('.ui-combobox-text', item);

	cy.get(listboxSelector + ' .ui-header-left')
		.should('have.text', item);

	cy.log('Selecting an item from listbox 2 - end.');
}

module.exports.enableEditingMobile = enableEditingMobile;
module.exports.longPressOnDocument = longPressOnDocument;
module.exports.openHamburgerMenu = openHamburgerMenu;
module.exports.selectHamburgerMenuItem = selectHamburgerMenuItem;
module.exports.selectAnnotationMenuItem = selectAnnotationMenuItem;
module.exports.closeHamburgerMenu = closeHamburgerMenu;
module.exports.openMobileWizard = openMobileWizard;
module.exports.closeMobileWizard = closeMobileWizard;
module.exports.executeCopyFromContextMenu = executeCopyFromContextMenu;
module.exports.openInsertionWizard = openInsertionWizard;
module.exports.closeInsertionWizard = closeInsertionWizard;
module.exports.selectFromColorPalette = selectFromColorPalette;
module.exports.openTextPropertiesPanel = openTextPropertiesPanel;
module.exports.selectListBoxItem = selectListBoxItem;
module.exports.selectListBoxItem2 = selectListBoxItem2;
module.exports.openCommentWizard = openCommentWizard;
