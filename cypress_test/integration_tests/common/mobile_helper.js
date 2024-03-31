/* global cy expect require Cypress */

var helper = require('./helper');

// Enable editing if we are in read-only mode.
function enableEditingMobile() {
	cy.log('>> enableEditingMobile - start');

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

	cy.log('<< enableEditingMobile - end');
}

function longPressOnDocument(posX, posY) {
	cy.log('>> longPressOnDocument - start');
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

			// Wait for long press
			// This value is set in Map.TouchGesture.js.
			cy.wait(500);

			cy.cGet('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerup', eventOptions);
		});

	cy.log('<< longPressOnDocument - end');
}

function openHamburgerMenu() {
	cy.log('>> openHamburgerMenu - start');

	cy.cGet('#toolbar-hamburger')
		.should('not.have.class', 'menuwizard-opened');

	cy.cGet('#toolbar-hamburger .main-menu-btn-icon')
		.click({force: true});

	cy.cGet('#toolbar-hamburger')
		.should('have.class', 'menuwizard-opened');

	cy.cGet('#mobile-wizard-content-menubar')
		.should('not.be.empty');

	cy.log('<< openHamburgerMenu - end');
}

function closeHamburgerMenu() {
	cy.log('>> closeHamburgerMenu - start');

	cy.cGet('#toolbar-hamburger')
		.should('have.class', 'menuwizard-opened');

	cy.cGet('#toolbar-hamburger .main-menu-btn-icon')
		.click({force: true});

	cy.cGet('#toolbar-hamburger')
		.should('not.have.class', 'menuwizard-opened');

	cy.cGet('#mobile-wizard-content-menubar')
		.should('not.exist');

	cy.log('<< closeHamburgerMenu - end');
}

function openMobileWizard() {
	cy.log('>> openMobileWizard - start');

	helper.waitUntilIdle('#toolbar-up #mobile_wizard');
	// Open mobile wizard
	cy.cGet('#toolbar-up #mobile_wizard')
		.should('not.have.class', 'disabled')
		.click();

	// Mobile wizard is opened and it has content
	cy.cGet('#mobile-wizard-content')
		.should('not.be.empty');
	//cy.cGet('#toolbar-up #mobile_wizard')
	//	.should('have.class', 'checked');

	cy.log('<< openMobileWizard - end');
}

function closeMobileWizard() {
	cy.log('>> closeMobileWizard - start');

	//cy.cGet('#toolbar-up #mobile_wizard')
	//	.should('have.class', 'checked');

	cy.cGet('#toolbar-up #mobile_wizard')
		.click();

	cy.cGet('#mobile-wizard')
		.should('not.be.visible');
	//cy.cGet('#toolbar-up #mobile_wizard')
	//	.should('not.have.class', 'checked');

	cy.log('<< closeMobileWizard - end');
}

function executeCopyFromContextMenu(XPos, YPos) {
	cy.log('>> executeCopyFromContextMenu - start');
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

	cy.log('<< executeCopyFromContextMenu - end');
}

function openInsertionWizard() {
	cy.log('>> openInsertionWizard - start');

	cy.cGet('#toolbar-up #insertion_mobile_wizard')
		.should('not.have.class', 'disabled')
		.click();

	cy.cGet('#mobile-wizard-content')
		.should('not.be.empty');

	//cy.cGet('#toolbar-up #insertion_mobile_wizard')
	//	.should('have.class', 'checked');

	cy.log('<< openInsertionWizard - end');
}

function openCommentWizard() {
	cy.log('>> openCommentWizard - start');

	cy.cGet('#toolbar-up #comment_wizard')
		.should('not.have.class', 'disabled')
		.click();

	//cy.cGet('#toolbar-up #comment_wizard')
	//	.should('have.class', 'checked');

	cy.log('<< openCommentWizard - end');
}

function closeInsertionWizard() {
	cy.log('>> closeInsertionWizard - start');

	//cy.cGet('#toolbar-up #insertion_mobile_wizard')
	//	.should('have.class', 'checked');

	cy.cGet('#toolbar-up #insertion_mobile_wizard')
		.click();

	cy.cGet('#mobile-wizard')
		.should('not.be.visible');

	//cy.cGet('#toolbar-up #insertion_mobile_wizard')
	//	.should('not.have.class', 'checked');

	cy.log('<< closeInsertionWizard - end');
}

/// deprecated: see selectFromColorPicker function instead
function selectFromColorPalette(paletteNum, groupNum, paletteAfterChangeNum, colorNum) {
	cy.log('>> selectFromColorPalette - start');

	cy.cGet('#color-picker-' + paletteNum.toString() + '-basic-color-' + groupNum.toString()).click();
	if (paletteAfterChangeNum !== undefined && colorNum !== undefined) {
		cy.cGet('#color-picker-' + paletteAfterChangeNum.toString() + '-tint-' + colorNum.toString()).click();
	}
	cy.cGet('#mobile-wizard-back').click();

	cy.log('<< selectFromColorPalette - end');
}

function selectFromColorPicker(pickerId, groupNum, colorNum) {
	cy.log('>> selectFromColorPicker - start');

	cy.cGet(pickerId + ' [id^=color-picker-][id$=-basic-color-' + groupNum.toString() + ']')
		.click();

	if (colorNum !== undefined) {
		cy.cGet(pickerId + ' [id^=color-picker-][id$=-tint-' + colorNum.toString() + ']')
			.click();
	}

	cy.cGet('#mobile-wizard-back')
		.click();

	cy.log('<< selectFromColorPicker - end');
}

function openTextPropertiesPanel() {
	cy.log('>> openTextPropertiesPanel - start');

	openMobileWizard();

	helper.clickOnIdle('#TextPropertyPanel');

	cy.cGet('#Bold').should('be.visible');

	cy.log('<< openTextPropertiesPanel - end');
}

function selectHamburgerMenuItem(menuItems) {
	cy.log('>> selectHamburgerMenuItem - start');
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

	cy.log('<< selectHamburgerMenuItem - end');
}

function selectAnnotationMenuItem(menuItem) {
	cy.log('>> selectAnnotationMenuItem - start');

	cy.cGet('#mobile-wizard .wizard-comment-box .cool-annotation-menu')
		.click({force: true});

	cy.cGet('.context-menu-list')
		.should('exist');

	cy.cGet('body').contains('.context-menu-item', menuItem)
		.click();

	cy.log('<< selectAnnotationMenuItem - end');
}

function selectListBoxItem(listboxSelector, item) {
	cy.log('>> selectListBoxItem - start');

	helper.clickOnIdle(listboxSelector);

	helper.clickOnIdle('.mobile-wizard.ui-combobox-text', item);

	// Combobox entry contains the selected item
	cy.cGet(listboxSelector + ' .ui-header-right .entry-value')
		.should('have.text', item);

	cy.log('<< selectListBoxItem - end');
}

function selectListBoxItem2(listboxSelector, item) {
	cy.log('>> selectListBoxItem2 - start');

	helper.clickOnIdle(listboxSelector);

	var endPos = listboxSelector.indexOf(' ');
	if (endPos < 0)
		endPos = listboxSelector.length;
	var parentId = listboxSelector.substring(0, endPos);

	helper.clickOnIdle(parentId + ' .ui-combobox-text', item);

	cy.cGet(listboxSelector + ' .ui-header-left')
		.should('have.text', item);

	cy.log('<< selectListBoxItem2 - end');
}
function insertComment() {
	cy.log('>> insertComment - start');

	openInsertionWizard();
	cy.cGet('body').contains('.menu-entry-with-icon', 'Comment').click();
	cy.cGet('.cool-annotation-table').should('exist');
	cy.cGet('#input-modal-input').type('some text');
	cy.cGet('#response-ok').click();
	cy.cGet('#comment-container-1').should('exist').wait(300);
	cy.cGet('#annotation-content-area-1').should('have.text', 'some text');

	cy.log('<< insertComment - end');
}

function insertImage() {
	cy.log('>> insertImage - start');

	openInsertionWizard();

	// We can't use the menu item directly, because it would open file picker.
	cy.cGet('body').contains('.menu-entry-with-icon', 'Local Image...')
		.should('be.visible');

	cy.cGet('#insertgraphic[type=file]')
		.attachFile('/mobile/writer/image_to_insert.png');

	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g')
		.should('exist');

	cy.log('<< insertImage - end');
}

function deleteImage() {
	cy.log('>> deleteImage - start');

	insertImage();
	var eventOptions = {
		force: true,
		button: 0,
		pointerType: 'mouse'
	};

	cy.cGet('.leaflet-control-buttons-disabled > .leaflet-interactive')
		.trigger('pointerdown', eventOptions)
		.wait(500) // Wait for long press
		.trigger('pointerup', eventOptions);

	cy.cGet('body').contains('.menu-entry-with-icon', 'Delete')
		.should('be.visible').click();

	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g')
		.should('not.exist');

	cy.log('<< deleteImage - end');
}

function pressPushButtonOfDialog(name) {
	cy.log('>> pressPushButtonOfDialog - start');

	cy.cGet('body').contains('.ui-pushbutton', name).click();

	cy.log('<< pressPushButtonOfDialog - end');
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
