/* global cy  require Cypress expect */

var helper = require('./helper');

// Make the sidebar visible by clicking on the corresponding toolbar item.
// We assume that the sidebar is hidden, when this method is called.

function showSidebar() {
	cy.log('Showing sidebar - start.');

	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').should('not.have.class', 'checked');
	cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');
	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').click({force: true});
	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').should('have.class', 'checked');
	cy.cGet('#sidebar-dock-wrapper').should('be.visible');

	cy.log('Showing sidebar - end.');
}

// Hide the sidebar by clicking on the corresponding toolbar item.
// We assume that the sidebar is visible, when this method is called.
function hideSidebar() {
	cy.log('Hiding sidebar - start.');

	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').should('have.class', 'checked');
	cy.cGet('#sidebar-dock-wrapper').should('be.visible');
	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').click({force: true});
	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').should('not.have.class', 'checked');
	cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');

	cy.log('Hiding sidebar - end.');
}

// Make the status bar visible if it's hidden at the moment.
// We use the menu option under 'View' menu to make it visible.
function showStatusBarIfHidden() {
	cy.cGet('#toolbar-down')
		.then(function(statusbar) {
			if (!Cypress.dom.isVisible(statusbar[0])) {
				cy.get('#menu-view')
					.click();

				cy.get('#menu-showstatusbar')
					.click();
			}
		});

	cy.cGet('#toolbar-down').should('be.visible');
}

// Make the sidebar visible if it's hidden at the moment.
function showSidebarIfHidden() {
	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.then(function(sidebarItem) {
			if (!sidebarItem.hasClass('checked')) {
				showSidebar();
			}
		});

	cy.get('#sidebar-dock-wrapper')
		.should('be.visible');
}

// Hide the sidebar if it's visible at the moment.
function hideSidebarIfVisible() {
	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.then(function(sidebarItem) {
			if (sidebarItem.hasClass('checked')) {
				hideSidebar();
			}
		});

	cy.get('#sidebar-dock-wrapper')
		.should('not.be.visible');
}

// Select a color from colour palette widget used on top toolbar.
// Parameters:
// color - a hexadecimal color code without the '#' mark (e.g. 'FF011B')
function selectColorFromPalette(color) {
	cy.cGet('.w2ui-overlay').should('be.visible');
	cy.cGet('.w2ui-color [name="' + color + '"]').click();
	cy.cGet('.w2ui-overlay').should('not.exist');
}

// Select an item from a listbox widget used on top toolbar.
// Parameters:
// item - item string, that we use a selector to find the right list item.
function selectFromListbox(item) {
	cy.cGet('.select2-dropdown').should('be.visible');
	// We use force because the tooltip sometimes hides the items.
	cy.cGet('body').contains('.select2-results__option', item).click({force: true});
	cy.cGet('.select2-dropdown').should('not.exist');
}

// Select an item from a JSDialog dropdown widget used on top toolbar.
// Parameters:
// item - item string, that we use a selector to find the right list item.
function selectFromJSDialogListbox(item, isImage) {
	cy.cGet('[id$="-dropdown"].modalpopup').should('be.visible');
	// We use force because the tooltip sometimes hides the items.
	if (isImage) {
		cy.wait(1000); // We need some time to render custom entries
		cy.cGet('[id$="-dropdown"].modalpopup img[alt="' + item + '"]').click({force: true});
	} else
		cy.cGet('[id$="-dropdown"].modalpopup').contains('span', item).click({force: true});

	cy.cGet('[id$="-dropdown"].modalpopup').should('not.exist');
}

// Make sure the right dialog is opened and then we close it.
// Used for tunneled dialogs. We don't interact with this dialogs
// now, because they are just images. We mostly just check that
// the dialog is open.
// Parameters:
// dialogTitle - a title string to make sure the right dialog was opened.
function checkDialogAndClose(dialogTitle) {
	// Dialog is opened
	cy.cGet('.lokdialog_canvas').should('be.visible');
	cy.cGet('.ui-dialog-title').should('have.text', dialogTitle);

	// Close the dialog
	cy.cGet('body').type('{esc}');
	cy.cGet('.lokdialog_canvas').should('not.exist');
}

// Checks wether the document has the given zoom level according to the status bar.
// Parameters:
// zoomLevel        the expected zoom level (e.g. '100' means 100%).
function shouldHaveZoomLevel(zoomLevel) {
	cy.cGet('#tb_actionbar_item_zoom .w2ui-tb-caption').should('have.text', zoomLevel);
}

// Make the zoom related status bar items visible if they are hidden.
// The status bar can be long to not fit on the screen. We have a scroll
// item for navigation in this case.
function makeZoomItemsVisible() {
	cy.cGet('.w2ui-tb-image.w2ui-icon.zoomin')
		.then(function(zoomInItem) {
			if (!Cypress.dom.isVisible(zoomInItem)) {
				cy.cGet('#toolbar-down .w2ui-scroll-right').click();
			}
		});

	cy.cGet('.w2ui-tb-image.w2ui-icon.zoomin').should('be.visible');
}

// Increase / decrease the zoom level using the status bar related items.
// Parameters:
// zoomIn - do a zoom in (e.g. increase zoom level) or zoom out.
function doZoom(zoomIn) {
	var prevZoom = '';
	cy.cGet('#tb_actionbar_item_zoom .w2ui-tb-caption')
		.should(function(zoomLevel) {
			prevZoom = zoomLevel.text();
			expect(prevZoom).to.not.equal('');
		});

	// Force because sometimes the icons are scrolled off the screen to the right
	if (zoomIn) {
		cy.cGet('#tb_actionbar_item_zoomin .w2ui-button').click({force: true});
	} else {
		cy.cGet('#tb_actionbar_item_zoomout .w2ui-button').click({force: true});
	}

	// Wait for animation to complete
	cy.wait(500);

	cy.cGet('#tb_actionbar_item_zoom .w2ui-tb-caption')
		.should(function(zoomLevel) {
			expect(zoomLevel.text()).to.not.equal(prevZoom);
		});
}

// Zoom in the document.
function zoomIn() {
	doZoom(true);
}

// Zoom out of the document.
function zoomOut() {
	doZoom(false);
}

// Similarly to zoomIn() and zoomOut() we can change the zoom level.
// However, in this case we can specify the exact zoom level.
// Parameters:
// zoomLevel - a number specifing the zoom level  (e.g. '100' means 100%).
//             See also the status bar's zoom level list for possible values.
function selectZoomLevel(zoomLevel) {
	// Force because sometimes the icons are scrolled off the screen to the right
	cy.cGet('#tb_actionbar_item_zoom .w2ui-button').click({force: true});
	cy.cGet('#w2ui-overlay-actionbar').contains('.menu-text', zoomLevel).click({force: true});
	shouldHaveZoomLevel(zoomLevel);
}

// Reset zoom level to 100%.
function resetZoomLevel() {
	// Force because sometimes the icons are scrolled off the screen to the right
	cy.cGet('#tb_actionbar_item_zoomreset .w2ui-button').click({force: true});
	shouldHaveZoomLevel('100');
}

function insertImage(docType) {
	selectZoomLevel('50');

	cy.cGet('#toolbar-up .w2ui-scroll-right').click();

	const mode = Cypress.env('USER_INTERFACE');

	if (mode === 'notebookbar')
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();

	if (docType === 'calc' &&  mode === 'notebookbar') {
		cy.cGet('#Insert-tab-label').click();
		cy.cGet('#Insert-container .unoInsertGraphic').click();
	}
	else {
		cy.cGet('#Home-container .unoInsertGraphic').click();
	}

	cy.cGet('#insertgraphic[type=file]').attachFile('/desktop/writer/image_to_insert.png');
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');
}

function deleteImage() {
	helper.typeIntoDocument('{del}');
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('not.exist');
}

function assertImageSize(expectedWidth, expectedHeight) {
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg svg')
		.should('exist')
		.then($ele => {
			const actualWidth = parseInt($ele.attr('width'));
			const actualHeight = parseInt($ele.attr('height'));

			expect(actualWidth).to.be.closeTo(expectedWidth, 10);
			expect(actualHeight).to.be.closeTo(expectedHeight, 10);
		});
}

function createComment(docType, text, isMobile, selector) {
	if (docType === 'draw') {
		cy.cGet('#menu-insert').click();
		cy.cGet('#menu-insertcomment').click();
	}
	else if (!selector) {
		actionOnSelector('insertAnnotation', (selector) => {
			cy.cGet(selector).click();
		});
	}
	else
		cy.cGet(selector).click();

	// Without this wait, the save button click sometimes fails.
	cy.wait(500);

	cy.cGet('.cool-annotation-table').should('exist');

	cy.cGet('#annotation-modify-textarea-new').type(text);
	// Cannot have any action between type and subsequent save button click
}

function saveComment(isMobile) {
	if (isMobile) {
		cy.cGet('#response-ok').click();
	} else {
		// The button id is usually called #annotation-save-new,
		// but sometimes it is #annotation-save-1
		cy.cGet('[id^=annotation-save-]').last().click();
		// Wait for animation
		cy.wait(100);
	}
}

function setupUIforCommentInsert(docType) {
	var mode = Cypress.env('USER_INTERFACE');

	if (docType !== 'draw') {
		cy.cGet('#toolbar-up .w2ui-scroll-right').then($button => {
			if ($button.is(':visible'))	{
				$button.click();
			}
		});
	}

	if (mode === 'notebookbar') {
		cy.cGet('#Insert-tab-label').then($button => {
			if (!$button.hasClass('selected')) {
				$button.click();
			}
		});
	}

	if (docType === 'writer' && mode !== 'notebookbar') {
		cy.cGet('#toolbar-up .w2ui-scroll-right').then($button => {
			if ($button.is(':visible'))	{
				$button.click();
			}
		});
	}
}

function insertMultipleComment(docType, numberOfComments = 1, isMobile = false, selector) {
	setupUIforCommentInsert(docType);

	for (var n = 0; n < numberOfComments; n++) {
		createComment(docType, 'some text' + n, isMobile, selector);
		saveComment(isMobile);
	}
}

function switchUIToNotebookbar() {
	cy.window().then(win => {
		var userInterfaceMode = win['0'].userInterfaceMode;
		if (userInterfaceMode !== 'notebookbar') {
			cy.log('switchUIToNotebookbar start');
			cy.cGet('#menu-view').click();
			cy.cGet('#menu-toggleuimode').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
			cy.log('switchUIToNotebookbar end');
		} else {
			cy.log('switchUIToNotebookbar: already notebookbar UI');
		}
		Cypress.env('USER_INTERFACE', 'notebookbar');
	});
}

function switchUIToCompact() {
	cy.window().then(win => {
		var userInterfaceMode = win['0'].userInterfaceMode;
		if (userInterfaceMode === 'notebookbar') {
			cy.log('switchUIToCompact start');
			cy.cGet('#View-tab-label').click();
			cy.cGet('#toggleuimode').click();
			cy.log('switchUIToCompact end');
		} else {
			cy.log('switchUIToCompact: already compact UI');
		}
	});
}

function actionOnSelector(name, func) {
	cy.task('getSelectors', {
		mode: Cypress.env('USER_INTERFACE'),
		name: name,
	}).then((selector) => {
		func(selector);
	});
}

//type represent horizontal/vertical scrollbar
//arr : In both cypress GUI and CLI the scrollposition are slightly different
//so we are passing both in array and assert using oneOf
function assertScrollbarPosition(type, lowerBound, upperBound) {
	cy.cGet('#test-div-' + type + '-scrollbar')
		.should(function($item) {
			const x = parseInt($item.text());
			expect(x).to.be.within(lowerBound, upperBound);
		});
}

function pressKey(n, key) {
	for (let i=0; i<n; i++) {
		helper.typeIntoDocument('{' + key + '}');
	}
}

function openReadOnlyFile(type, filename) {
	var testFileName = helper.loadTestDocNoIntegration(filename, type, false, false, false);

	//check doc is loaded
	cy.cGet('.leaflet-canvas-container canvas', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

	helper.isCanvasWhite(false);

	cy.cGet('#PermissionMode').should('be.visible').should('have.text', ' Read-only ');

	return testFileName;
}

function checkAccessibilityEnabledToBe(state) {
	cy.window().then(win => {
		cy.log('check accessibility enabled to be: ' + state);
		var isAccessibilityEnabledAtServerLevel = win['0'].enableAccessibility;
		// expect(isAccessibilityEnabledAtServerLevel).to.eq(true);
		if (isAccessibilityEnabledAtServerLevel) {
			var userInterfaceMode = win['0'].userInterfaceMode;
			if (userInterfaceMode === 'notebookbar') {
				if (state) {
					cy.cGet('#togglea11ystate').should('have.class', 'selected');
				} else {
					cy.cGet('#togglea11ystate').should('not.have.class', 'selected');
				}
			} else {
				cy.cGet('#menu-tools').click();
				if (state) {
					cy.cGet('#menu-togglea11ystate a').should('have.class', 'lo-menu-item-checked');
				} else {
					cy.cGet('#menu-togglea11ystate a').should('not.have.class', 'lo-menu-item-checked');
				}
				cy.cGet('div.clipboard').type('{esc}', {force: true});
			}
			cy.cGet('div.clipboard').then((clipboard) => {
				expect(clipboard.get(0)._hasAccessibilitySupport()).to.eq(state);
			});
		} else {
			cy.log('accessibility disabled at server level');
		}
	});
}

function setAccessibilityState(enable) {
	cy.window().then(win => {
		cy.log('set accessibility state to: ' + enable);
		var a11yEnabled = win['0'].enableAccessibility;
		if (a11yEnabled) {
			var userInterfaceMode = win['0'].userInterfaceMode;
			if (userInterfaceMode === 'notebookbar') {
				cy.cGet('#Help-tab-label').click();
				cy.cGet('#togglea11ystate').then((button) => {
					//var currentState = button.get(0).classList.contains('selected');
					var currentState = button.hasClass('selected');
					if (currentState !== enable) {
						button.click();
						cy.log('accessibility state changed: ' + enable);
					} else {
						cy.log('accessibility already in requested state: ' + enable);
					}
				});
			} else  {
				cy.cGet('#menu-tools').click();
				cy.cGet('#menu-togglea11ystate a').then((item) => {
					var currentState = item.hasClass('lo-menu-item-checked');
					if (currentState !== enable) {
						cy.cGet('#menu-togglea11ystate').click();
						cy.log('accessibility state changed: ' + enable);
					} else {
						cy.log('accessibility already in requested state: ' + enable);
					}
				});
			}
			cy.cGet('div.clipboard').then((clipboard) => {
				expect(clipboard.get(0)._hasAccessibilitySupport()).to.eq(enable);
			});
		} else {
			cy.log('accessibility disabled at server level');
		}
	});
}

module.exports.showSidebar = showSidebar;
module.exports.hideSidebar = hideSidebar;
module.exports.showStatusBarIfHidden = showStatusBarIfHidden;
module.exports.showSidebarIfHidden = showSidebarIfHidden;
module.exports.hideSidebarIfVisible = hideSidebarIfVisible;
module.exports.selectColorFromPalette = selectColorFromPalette;
module.exports.selectFromListbox = selectFromListbox;
module.exports.selectFromJSDialogListbox = selectFromJSDialogListbox;
module.exports.checkDialogAndClose = checkDialogAndClose;
module.exports.makeZoomItemsVisible = makeZoomItemsVisible;
module.exports.zoomIn = zoomIn;
module.exports.zoomOut = zoomOut;
module.exports.shouldHaveZoomLevel = shouldHaveZoomLevel;
module.exports.selectZoomLevel = selectZoomLevel;
module.exports.resetZoomLevel = resetZoomLevel;
module.exports.insertImage = insertImage;
module.exports.deleteImage = deleteImage;
module.exports.insertMultipleComment = insertMultipleComment;
module.exports.actionOnSelector = actionOnSelector;
module.exports.assertScrollbarPosition = assertScrollbarPosition;
module.exports.pressKey = pressKey;
module.exports.assertImageSize = assertImageSize;
module.exports.openReadOnlyFile = openReadOnlyFile;
module.exports.switchUIToNotebookbar = switchUIToNotebookbar;
module.exports.switchUIToCompact = switchUIToCompact;
module.exports.checkAccessibilityEnabledToBe = checkAccessibilityEnabledToBe;
module.exports.setAccessibilityState = setAccessibilityState;
module.exports.setupUIforCommentInsert = setupUIforCommentInsert;
module.exports.createComment = createComment;
module.exports.saveComment = saveComment;
