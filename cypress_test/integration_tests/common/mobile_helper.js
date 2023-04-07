/* global cy expect require Cypress */

var helper = require('./helper');

// Enable editing if we are in read-only mode.
function enableEditingMobile() {

	//https://stackoverflow.com/a/63519375/1592055
	const resizeObserverLoopErrRe = /^[^(ResizeObserver loop limit exceeded)]/;
	Cypress.on('uncaught:exception', (err) => {
		/* returning false here prevents Cypress from failing the test */
		if (resizeObserverLoopErrRe.test(err.message)) {
			return false;
		}
	});

	cy.log('Enabling editing mode - start.');

	cy.cGet('#mobile-edit-button').click();

	cy.cGet('#toolbar-mobile-back').should('have.class', 'editmode-on');
	cy.cGet('#toolbar-mobile-back').should('not.have.class', 'editmode-off');

	cy.log('Enabling editing mode - now editable.');

	// Wait until all UI update is finished.
	cy.cGet('#toolbar-down').should('be.visible');

	cy.log('Enabling editing mode - toolbar update done.');

	helper.doIfInCalc(function() {
		cy.cGet('#formulabar')
			.should('be.visible');
	});

	// In writer, we should have the blinking cursor visible
	// after stepping into editing mode.
	helper.doIfInWriter(function() {
		cy.cGet('.blinking-cursor')
			.should('be.visible');
	});

	// wait editable area for receiving paragraph content
	cy.wait(500);

	cy.log('Enabling editing mode - end.');
}

function longPressOnDocument(posX, posY) {
	cy.log('Emulating a long press - start.');
	cy.log('Param - posX: ' + posX);
	cy.log('Param - posY: ' + posY);

	cy.cGet('.leaflet-pane.leaflet-map-pane')
		.then(function(items) {
			expect(items).have.length(1);

			var eventOptions = {
				force: true,
				button: 0,
				pointerType: 'mouse',
				x: posX - items[0].getBoundingClientRect().left,
				y: posY - items[0].getBoundingClientRect().top
			};

			cy.cGet('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerdown', eventOptions)
				.trigger('pointermove', eventOptions);

			// This value is set in Map.TouchGesture.js.
			cy.wait(500);

			cy.cGet('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerup', eventOptions);
		});

	cy.log('Emulating a long press - end.');
}

function openHamburgerMenu() {
	cy.log('Opening hamburger menu - start.');

	cy.cGet('#toolbar-hamburger')
		.should('not.have.class', 'menuwizard-opened');

	cy.cGet('#toolbar-hamburger .main-menu-btn-icon')
		.click({force: true});

	cy.cGet('#toolbar-hamburger')
		.should('have.class', 'menuwizard-opened');

	cy.cGet('#mobile-wizard-content-menubar')
		.should('not.be.empty');

	cy.log('Opening hamburger menu - end.');
}

function closeHamburgerMenu() {
	cy.log('Closing hamburger menu - start.');

	cy.cGet('#toolbar-hamburger')
		.should('have.class', 'menuwizard-opened');

	cy.cGet('#toolbar-hamburger .main-menu-btn-icon')
		.click({force: true});

	cy.cGet('#toolbar-hamburger')
		.should('not.have.class', 'menuwizard-opened');

	cy.cGet('#mobile-wizard-content-menubar')
		.should('not.exist');

	cy.log('Closing hamburger menu - end.');
}

function openMobileWizard() {
	cy.log('Opening mobile wizard - start.');

	helper.waitUntilIdle('#tb_actionbar_item_mobile_wizard');
	// Open mobile wizard
	cy.cGet('#tb_actionbar_item_mobile_wizard')
		.should('not.have.class', 'disabled')
		.click();

	cy.wait(1000);

	// Mobile wizard is opened and it has content
	cy.cGet('#mobile-wizard-content')
		.should('not.be.empty');
	cy.cGet('#tb_actionbar_item_mobile_wizard table')
		.should('have.class', 'checked');

	cy.log('Opening mobile wizard - end.');
}

function closeMobileWizard() {
	cy.log('Closing mobile wizard - start.');

	cy.cGet('#tb_actionbar_item_mobile_wizard table')
		.should('have.class', 'checked');

	cy.cGet('#tb_actionbar_item_mobile_wizard')
		.click();

	cy.cGet('#mobile-wizard')
		.should('not.be.visible');
	cy.cGet('#tb_actionbar_item_mobile_wizard table')
		.should('not.have.class', 'checked');

	cy.log('Closing mobile wizard - end.');
}

function executeCopyFromContextMenu(XPos, YPos) {
	cy.log('Executing copy from context menu - start.');
	cy.log('Param - XPos: ' + XPos);
	cy.log('Param - YPos: ' + YPos);

	longPressOnDocument(XPos, YPos);

	// Execute copy
	cy.cGet('body').contains('.menu-entry-with-icon', 'Copy')
		.click();

	// Close warning about clipboard operations
	cy.cGet('.vex-dialog-buttons .button-primary')
		.click();

	// Wait until it's closed
	cy.cGet('.vex-overlay')
		.should('not.exist');

	cy.log('Executing copy from context menu - end.');
}

function openInsertionWizard() {
	cy.log('Opening insertion wizard - start.');

	cy.cGet('#tb_actionbar_item_insertion_mobile_wizard')
		.should('not.have.class', 'disabled')
		.click();

	cy.cGet('#mobile-wizard-content')
		.should('not.be.empty');

	cy.cGet('#tb_actionbar_item_insertion_mobile_wizard table')
		.should('have.class', 'checked');

	cy.log('Opening insertion wizard - end.');
}

function openCommentWizard() {
	cy.log('Opening Comment wizard - start.');

	cy.cGet('#tb_actionbar_item_comment_wizard')
		.should('not.have.class', 'disabled')
		.click();

	cy.cGet('#tb_actionbar_item_comment_wizard table')
		.should('have.class', 'checked');

	cy.log('Opening Comment wizard - end.');
}

function closeInsertionWizard() {
	cy.log('Closing insertion wizard - start.');

	cy.cGet('#tb_actionbar_item_insertion_mobile_wizard table')
		.should('have.class', 'checked');

	cy.cGet('#tb_actionbar_item_insertion_mobile_wizard')
		.click();

	cy.cGet('#mobile-wizard')
		.should('not.be.visible');

	cy.cGet('#tb_actionbar_item_insertion_mobile_wizard table')
		.should('not.have.class', 'checked');

	cy.log('Closing insertion wizard - end.');
}

/// deprecated: see selectFromColorPicker function instead
function selectFromColorPalette(paletteNum, groupNum, paletteAfterChangeNum, colorNum) {
	cy.log('Selecting a color from the color palette - start.');
	cy.cGet('#color-picker-' + paletteNum.toString() + '-basic-color-' + groupNum.toString()).click();
	cy.wait(1000);
	if (paletteAfterChangeNum !== undefined && colorNum !== undefined) {
		cy.cGet('#color-picker-' + paletteAfterChangeNum.toString() + '-tint-' + colorNum.toString()).click();
	}
	cy.wait(1000);
	cy.cGet('#mobile-wizard-back').click();
	cy.log('Selecting a color from the color palette - end.');
}

function selectFromColorPicker(pickerId, groupNum, colorNum) {
	cy.log('Selecting a color from the color palette - start.');

	cy.cGet(pickerId + ' [id^=color-picker-][id$=-basic-color-' + groupNum.toString() + ']')
		.click();

	cy.wait(1000);

	if (colorNum !== undefined) {
		cy.cGet(pickerId + ' [id^=color-picker-][id$=-tint-' + colorNum.toString() + ']')
			.click();
	}

	cy.wait(1000);

	cy.cGet('#mobile-wizard-back')
		.click();

	cy.log('Selecting a color from the color palette - end.');
}

function openTextPropertiesPanel() {
	openMobileWizard();

	helper.clickOnIdle('#TextPropertyPanel');

	cy.cGet('#Bold').should('be.visible');
}

function selectHamburgerMenuItem(menuItems) {
	cy.log('Selecting hamburger menu item - start.');
	cy.log('Param - menuItems: ' + menuItems);

	openHamburgerMenu();

	for (var i = 0; i < menuItems.length; i++) {
		cy.cGet('body').contains('.menu-entry-with-icon', menuItems[i])
			.click();

		if (Cypress.env('INTEGRATION') !== 'nextcloud') {
			if (Cypress.$('.menu-entry-with-icon').length) {
				cy.cGet('.menu-entry-with-icon')
					.should('not.have.text', menuItems[i]);
			}
		}
	}
	cy.log('Selecting hamburger menu item - end.');
}

function selectAnnotationMenuItem(menuItem) {
	cy.log('Selecting annotation menu item - start.');

	cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-menu')
		.click({force: true});

	cy.cGet('.context-menu-list')
		.should('exist');

	cy.cGet('body').contains('.context-menu-item', menuItem)
		.click();

	cy.log('Selecting annotation menu item - end.');
}

function selectListBoxItem(listboxSelector, item) {
	cy.log('Selecting an item from listbox - start.');

	helper.clickOnIdle(listboxSelector);

	helper.clickOnIdle('.mobile-wizard.ui-combobox-text', item);

	// Combobox entry contains the selected item
	cy.cGet(listboxSelector + ' .ui-header-right .entry-value')
		.should('have.text', item);

	cy.log('Selecting an item from listbox - end.');
}

function selectListBoxItem2(listboxSelector, item) {
	cy.log('Selecting an item from listbox 2 - start.');

	helper.clickOnIdle(listboxSelector);

	var endPos = listboxSelector.indexOf(' ');
	if (endPos < 0)
		endPos = listboxSelector.length;
	var parentId = listboxSelector.substring(0, endPos);

	helper.clickOnIdle(parentId + ' .ui-combobox-text', item);

	cy.wait(1000);

	cy.cGet(listboxSelector + ' .ui-header-left')
		.should('have.text', item);

	cy.log('Selecting an item from listbox 2 - end.');
}
function insertComment() {
	openInsertionWizard();
	cy.cGet('body').contains('.menu-entry-with-icon', 'Comment').click();
	cy.cGet('.cool-annotation-table').should('exist');
	cy.cGet('#input-modal-input').type('some text');
	cy.cGet('#response-ok').click();
	cy.cGet('#comment-container-1').should('exist').wait(300);
	cy.cGet('#annotation-content-area-1').should('have.text', 'some text');
}

function insertImage() {
	openInsertionWizard();

	// We can't use the menu item directly, because it would open file picker.
	cy.cGet('body').contains('.menu-entry-with-icon', 'Local Image...')
		.should('be.visible');

	cy.cGet('#insertgraphic[type=file]')
		.attachFile('/mobile/writer/image_to_insert.png');

	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g')
		.should('exist');
}

function deleteImage() {
	insertImage();
	var eventOptions = {
		force: true,
		button: 0,
		pointerType: 'mouse'
	};

	cy.cGet('.leaflet-control-buttons-disabled > .leaflet-interactive')
		.trigger('pointerdown', eventOptions)
		.wait(1000)
		.trigger('pointerup', eventOptions);

	cy.cGet('body').contains('.menu-entry-with-icon', 'Delete')
		.should('be.visible').click();

	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g')
		.should('not.exist');
}

function pressPushButtonOfDialog(name) {
	cy.cGet('body').contains('.ui-pushbutton', name).click();
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
module.exports.selectFromColorPicker = selectFromColorPicker;
module.exports.openTextPropertiesPanel = openTextPropertiesPanel;
module.exports.selectListBoxItem = selectListBoxItem;
module.exports.selectListBoxItem2 = selectListBoxItem2;
module.exports.openCommentWizard = openCommentWizard;
module.exports.insertImage = insertImage;
module.exports.deleteImage = deleteImage;
module.exports.insertComment = insertComment;
module.exports.pressPushButtonOfDialog = pressPushButtonOfDialog;
