/* global cy  require Cypress expect */

var helper = require('./helper');

// Make the sidebar visible by clicking on the corresponding toolbar item.
// We assume that the sidebar is hidden, when this method is called.

function showSidebar() {
	cy.log('>> showSidebar - start');

	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').should('not.have.class', 'checked');
	cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');
	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').click({force: true});
	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').should('have.class', 'checked');
	cy.cGet('#sidebar-dock-wrapper').should('be.visible');

	cy.log('<< showSidebar - end');
}

// Hide the sidebar by clicking on the corresponding toolbar item.
// We assume that the sidebar is visible, when this method is called.
function hideSidebar() {
	cy.log('>> hideSidebar - start');

	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').should('have.class', 'checked');
	cy.cGet('#sidebar-dock-wrapper').should('be.visible');
	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').click({force: true});
	cy.cGet('#tb_editbar_item_sidebar .w2ui-button').should('not.have.class', 'checked');
	cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');

	cy.log('<< hideSidebar - end');
}

// Make the status bar visible if it's hidden at the moment.
// We use the menu option under 'View' menu to make it visible.
function showStatusBarIfHidden() {
	cy.log('>> showStatusBarIfHidden - start');

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

	cy.log('<< showStatusBarIfHidden - end');
}

// Make the sidebar visible if it's hidden at the moment.
function showSidebarIfHidden() {
	cy.log('>> showSidebarIfHidden - start');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.then(function(sidebarItem) {
			if (!sidebarItem.hasClass('checked')) {
				showSidebar();
			}
		});

	cy.get('#sidebar-dock-wrapper')
		.should('be.visible');

	cy.log('<< showSidebarIfHidden - end');
}

// Hide the sidebar if it's visible at the moment.
function hideSidebarIfVisible() {
	cy.log('>> hideSidebarIfVisible - start');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.then(function(sidebarItem) {
			if (sidebarItem.hasClass('checked')) {
				hideSidebar();
			}
		});

	cy.get('#sidebar-dock-wrapper')
		.should('not.be.visible');

	cy.log('<< hideSidebarIfVisible - end');
}

// Select a color from colour palette widget used on top toolbar.
// Parameters:
// color - a hexadecimal color code without the '#' mark (e.g. 'FF011B')
function selectColorFromPalette(color) {
	cy.log('>> selectColorFromPalette - start');

	cy.cGet('.w2ui-overlay').should('be.visible');
	cy.cGet('.w2ui-color [name="' + color + '"]').click();
	cy.cGet('.w2ui-overlay').should('not.exist');

	cy.log('<< selectColorFromPalette - end');
}

// Select an item from a listbox widget used on top toolbar.
// Parameters:
// item - item string, that we use a selector to find the right list item.
function selectFromListbox(item) {
	cy.log('>> selectFromListbox - start');

	cy.cGet('.select2-dropdown').should('be.visible');
	// We use force because the tooltip sometimes hides the items.
	cy.cGet('body').contains('.select2-results__option', item).click({force: true});
	cy.cGet('.select2-dropdown').should('not.exist');

	cy.log('<< selectFromListbox - end');
}

// Select an item from a JSDialog dropdown widget used on top toolbar.
// Parameters:
// item - item string, that we use a selector to find the right list item.
function selectFromJSDialogListbox(item, isImage) {
	cy.log('>> selectFromJSDialogListbox - start');

	cy.cGet('[id$="-dropdown"].modalpopup').should('be.visible');
	// We use force because the tooltip sometimes hides the items.
	if (isImage) {
		cy.wait(1000); // We need some time to render custom entries
		cy.cGet('[id$="-dropdown"].modalpopup img[alt="' + item + '"]').click({force: true});
	} else
		cy.cGet('[id$="-dropdown"].modalpopup').contains('span', item).click({force: true});

	cy.cGet('[id$="-dropdown"].modalpopup').should('not.exist');

	cy.log('<< selectFromJSDialogListbox - end');
}

// Make sure the right dialog is opened and then we close it.
// Used for tunneled dialogs. We don't interact with this dialogs
// now, because they are just images. We mostly just check that
// the dialog is open.
// Parameters:
// dialogTitle - a title string to make sure the right dialog was opened.
function checkDialogAndClose(dialogTitle) {
	cy.log('>> checkDialogAndClose - start');

	// Dialog is opened
	cy.cGet('.lokdialog_canvas').should('be.visible');
	cy.cGet('.ui-dialog-title').should('have.text', dialogTitle);

	// Close the dialog
	cy.cGet('body').type('{esc}');
	cy.cGet('.lokdialog_canvas').should('not.exist');

	cy.log('<< checkDialogAndClose - end');
}

// Checks wether the document has the given zoom level according to the status bar.
// Parameters:
// zoomLevel        the expected zoom level (e.g. '100' means 100%).
function shouldHaveZoomLevel(zoomLevel) {
	cy.log('>> shouldHaveZoomLevel - start');

	cy.cGet('#tb_actionbar_item_zoom .w2ui-tb-caption').should('have.text', zoomLevel);

	cy.log('<< shouldHaveZoomLevel - end');
}

// Make the zoom related status bar items visible if they are hidden.
// The status bar can be long to not fit on the screen. We have a scroll
// item for navigation in this case.
function makeZoomItemsVisible() {
	cy.log('>> makeZoomItemsVisible - start');

	cy.cGet('.w2ui-tb-image.w2ui-icon.zoomin')
		.then(function(zoomInItem) {
			if (!Cypress.dom.isVisible(zoomInItem)) {
				cy.cGet('#toolbar-down .w2ui-scroll-right').click();
			}
		});

	cy.cGet('.w2ui-tb-image.w2ui-icon.zoomin').should('be.visible');

	cy.log('<< makeZoomItemsVisible - end');
}

// Increase / decrease the zoom level using the status bar related items.
// Parameters:
// zoomIn - do a zoom in (e.g. increase zoom level) or zoom out.
function doZoom(zoomIn) {
	cy.log('>> doZoom - start');

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

	cy.log('<< doZoom - end');
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
	cy.log('>> selectZoomLevel - start');

	// Force because sometimes the icons are scrolled off the screen to the right
	cy.cGet('#tb_actionbar_item_zoom .w2ui-button').click({force: true});
	cy.cGet('#w2ui-overlay-actionbar').contains('.menu-text', zoomLevel).click({force: true});
	shouldHaveZoomLevel(zoomLevel);

	cy.log('<< selectZoomLevel - end');
}

// Reset zoom level to 100%.
function resetZoomLevel() {
	cy.log('>> resetZoomLevel - start');

	// Force because sometimes the icons are scrolled off the screen to the right
	cy.cGet('#tb_actionbar_item_zoomreset .w2ui-button').click({force: true});
	shouldHaveZoomLevel('100');

	cy.log('<< resetZoomLevel - end');
}

function insertImage(docType) {
	cy.log('>> insertImage - start');

	selectZoomLevel('50');

	cy.cGet('#toolbar-up .w2ui-scroll-right').click();

	const mode = Cypress.env('USER_INTERFACE');

	if (mode === 'notebookbar')
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();

	if (docType === 'calc' &&  mode === 'notebookbar') {
		cy.cGet('#Insert-tab-label').click();
		cy.cGet('#Insert-container .unoInsertGraphic').click({force: true});
	}
	else {
		cy.cGet('#Home-container .unoInsertGraphic').click({force: true});
	}

	cy.cGet('#insertgraphic[type=file]').attachFile('/desktop/writer/image_to_insert.png');
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');

	cy.log('<< insertImage - end');
}

function deleteImage() {
	cy.log('>> deleteImage - start');

	helper.typeIntoDocument('{del}');
	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('not.exist');

	cy.log('<< deleteImage - end');
}

function assertImageSize(expectedWidth, expectedHeight) {
	cy.log('>> assertImageSize - start');

	cy.cGet('.leaflet-pane.leaflet-overlay-pane svg svg')
		.should('exist')
		.then($ele => {
			const actualWidth = parseInt($ele.attr('width'));
			const actualHeight = parseInt($ele.attr('height'));

			expect(actualWidth).to.be.closeTo(expectedWidth, 10);
			expect(actualHeight).to.be.closeTo(expectedHeight, 10);
		});

	cy.log('<< assertImageSize - end');
}

function createComment(docType, text, isMobile, selector) {
	cy.log('>> createComment - start');

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

	cy.log('<< createComment - end');
}

function saveComment(isMobile) {
	cy.log('>> saveComment - start');

	if (isMobile) {
		cy.cGet('#response-ok').click();
	} else {
		// The button id is usually called #annotation-save-new,
		// but sometimes it is #annotation-save-1
		cy.cGet('[id^=annotation-save-]').last().click();
		// Wait for animation
		cy.wait(100);
	}

	cy.log('<< saveComment - end');
}

function setupUIforCommentInsert(docType) {
	cy.log('>> setupUIforCommentInsert - start');

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

	cy.log('<< setupUIforCommentInsert - end');
}

function insertMultipleComment(docType, numberOfComments = 1, isMobile = false, selector) {
	cy.log('>> insertMultipleComment - start');

	setupUIforCommentInsert(docType);

	for (var n = 0; n < numberOfComments; n++) {
		createComment(docType, 'some text' + n, isMobile, selector);
		saveComment(isMobile);
	}

	cy.log('<< insertMultipleComment - end');
}

function switchUIToNotebookbar() {
	cy.log('>> switchUIToNotebookbar - start');

	cy.window().then(win => {
		var userInterfaceMode = win['0'].userInterfaceMode;
		if (userInterfaceMode !== 'notebookbar') {
			cy.cGet('#menu-view').click();
			cy.cGet('#menu-toggleuimode').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		}
		Cypress.env('USER_INTERFACE', 'notebookbar');
	});

	cy.log('<< switchUIToNotebookbar - end');
}

function switchUIToCompact() {
	cy.log('>> switchUIToCompact - start');

	cy.window().then(win => {
		var userInterfaceMode = win['0'].userInterfaceMode;
		if (userInterfaceMode === 'notebookbar') {
			cy.cGet('#View-tab-label').click();
			cy.cGet('#toggleuimode').click();
		}
	});

	cy.log('<< switchUIToCompact - end');
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
	cy.log('>> assertScrollbarPosition - start');

	cy.cGet('#test-div-' + type + '-scrollbar')
		.should(function($item) {
			const x = parseInt($item.text());
			expect(x).to.be.within(lowerBound, upperBound);
		});

	cy.log('<< assertScrollbarPosition - end');
}

function pressKey(n, key) {
	cy.log('>> pressKey - start');

	for (let i=0; i<n; i++) {
		helper.typeIntoDocument('{' + key + '}');
	}

	cy.log('<< pressKey - end');
}

function openReadOnlyFile(type, filename) {
	cy.log('>> openReadOnlyFile - start');

	var testFileName = helper.loadTestDocNoIntegration(filename, type, false, false, false);

	//check doc is loaded
	cy.cGet('.leaflet-canvas-container canvas', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

	helper.isCanvasWhite(false);

	cy.cGet('#PermissionMode').should('be.visible').should('have.text', ' Read-only ');

	cy.log('<< openReadOnlyFile - end');
	return testFileName;
}

function checkAccessibilityEnabledToBe(state) {
	cy.log('>> checkAccessibilityEnabledToBe - start');

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

	cy.log('<< checkAccessibilityEnabledToBe - end');
}

function setAccessibilityState(enable) {
	cy.log('>> setAccessibilityState - start');

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

	cy.log('<< setAccessibilityState - end');
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
