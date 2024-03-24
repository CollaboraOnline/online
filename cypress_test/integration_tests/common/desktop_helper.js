/* global cy  require Cypress expect */

var helper = require('./helper');

// Make the sidebar visible by clicking on the corresponding toolbar item.
// We assume that the sidebar is hidden, when this method is called.

function showSidebar() {
	cy.log('>> showSidebar - start');

	cy.cGet('#sidebar').should('not.have.class', 'selected');
	cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');
	cy.cGet('#sidebar').click({force: true});
	cy.cGet('#sidebar').should('have.class', 'selected');
	cy.cGet('#sidebar-dock-wrapper').should('be.visible');

	cy.log('<< showSidebar - end');
}

// Hide the sidebar by clicking on the corresponding toolbar item.
// We assume that the sidebar is visible, when this method is called.
function hideSidebar() {
	cy.log('>> hideSidebar - start');

	cy.cGet('#sidebar').should('have.class', 'selected');
	cy.cGet('#sidebar-dock-wrapper').should('be.visible');
	cy.cGet('#sidebar').click({force: true});
	cy.cGet('#sidebar').should('not.have.class', 'selected');
	cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');

	cy.log('<< hideSidebar - end');
}

function hideSidebarImpress() {
	cy.log('>> hideSidebarImpress - start');

	cy.cGet('#modifypage').should('have.class', 'selected');
	cy.cGet('#sidebar-dock-wrapper').should('be.visible');
	cy.cGet('#modifypage button').click({force: true});
	cy.cGet('#modifypage').should('not.have.class', 'selected');
	cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');

	cy.log('<< hideSidebarImpress - end');
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

	cy.get('#sidebar')
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

	cy.get('#sidebar')
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

	cy.cGet('.ui-color-picker').should('be.visible');
	cy.cGet('.ui-color-picker-entry[name="' + color + '"]').click();
	cy.cGet('.ui-color-picker').should('not.exist');

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

	cy.cGet('#toolbar-down #zoom .unolabel').should('have.text', zoomLevel);

	cy.log('<< shouldHaveZoomLevel - end');
}

// Make the zoom related status bar items visible if they are hidden.
// The status bar can be long to not fit on the screen. We have a scroll
// item for navigation in this case.
function makeZoomItemsVisible() {
	cy.log('>> makeZoomItemsVisible - start');

	cy.cGet('#toolbar-down #zoomin')
		.then(function(zoomInItem) {
			if (!Cypress.dom.isVisible(zoomInItem)) {
				cy.cGet('#toolbar-down .w2ui-scroll-right').click();
			}
		});

	cy.cGet('#toolbar-down #zoomin').should('be.visible');

	cy.log('<< makeZoomItemsVisible - end');
}

// Increase / decrease the zoom level using the status bar related items.
// Parameters:
// zoomIn - do a zoom in (e.g. increase zoom level) or zoom out.
function doZoom(zoomIn) {
	cy.log('>> doZoom - start');

	var prevZoom = '';
	cy.cGet('#toolbar-down #zoom .unolabel')
		.should(function(zoomLevel) {
			prevZoom = zoomLevel.text();
			expect(prevZoom).to.not.equal('');
		});

	// Force because sometimes the icons are scrolled off the screen to the right
	if (zoomIn) {
		cy.cGet('#toolbar-down #zoomin').click({force: true});
	} else {
		cy.cGet('#toolbar-down #zoomout').click({force: true});
	}

	// Wait for animation to complete
	cy.wait(500);

	cy.cGet('#toolbar-down #zoom .unolabel')
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
	makeZoomItemsVisible();
	cy.cGet('#toolbar-down #zoom .arrowbackground').click({force: true});
	cy.cGet('#zoom-dropdown').contains('.ui-combobox-entry', zoomLevel).click({force: true});
	shouldHaveZoomLevel(zoomLevel);

	cy.log('<< selectZoomLevel - end');
}

// Reset zoom level to 100%.
function resetZoomLevel() {
	cy.log('>> resetZoomLevel - start');

	// Force because sometimes the icons are scrolled off the screen to the right
	cy.cGet('#toolbar-down #zoomreset').click({force: true});
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

function insertComment(text = 'some text0', save = true) {
	cy.log('>> insertComment - start');

	var mode = Cypress.env('USER_INTERFACE');
	if (mode === 'notebookbar') {
		cy.cGet('#Insert-tab-label').click();
		cy.cGet('#insert-insert-annotation').click({force: true});
	} else {
		cy.cGet('#menu-insert').click();
		cy.cGet('#menu-insertcomment').click();
	}

	// Use .last() because there might be multiple comments
	cy.cGet('.cool-annotation').last({log: false}).find('#annotation-modify-textarea-new').type(text);
	// Click outside modify area to trigger update
	cy.cGet('.cool-annotation').last({log: false}).find('.cool-annotation-table').click();
	// In case of small window to expand the comments
	cy.cGet('.cool-annotation').last({log: false}).find('.cool-annotation-img').click();
	// Check that comment exists
	cy.cGet('.cool-annotation').last({log: false}).find('.cool-annotation-textarea').should('contain',text);

	if (save) {
		cy.cGet('.cool-annotation').last({log: false}).find('[value="Save"]').click();
		cy.cGet('.cool-annotation').last({log: false}).find('.modify-annotation').should('not.be.visible');
		cy.cGet('.cool-annotation').last({log: false}).find('.cool-annotation-content').should('contain',text);
		// Comments can be automatically hidden after save in some cases,
		// so we can't check that the final content is visible
		// cy.cGet('.cool-annotation').last({log: false}).find('.cool-annotation-content').should('be.visible');

		// Wait for the animation to stop
		cy.cGet('.cool-annotation').last({log: false}).invoke('attr','style').should('not.contain','transition');
		// Need to wait even longer so that modify and reply work
		// TODO: Find out why newly typed text gets overwritten, find
		// a way to query for it, and wait only in relevant tests
		cy.wait(500);
	} else {
		cy.cGet('.cool-annotation').last({log: false}).find('.cool-annotation-content').should('not.be.visible');
		cy.cGet('.cool-annotation').last({log: false}).find('.modify-annotation').should('be.visible');
	}

	cy.log('<< insertComment - end');
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
module.exports.hideSidebarImpress = hideSidebarImpress;
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
module.exports.insertComment = insertComment;
module.exports.actionOnSelector = actionOnSelector;
module.exports.assertScrollbarPosition = assertScrollbarPosition;
module.exports.pressKey = pressKey;
module.exports.assertImageSize = assertImageSize;
module.exports.openReadOnlyFile = openReadOnlyFile;
module.exports.switchUIToNotebookbar = switchUIToNotebookbar;
module.exports.switchUIToCompact = switchUIToCompact;
module.exports.checkAccessibilityEnabledToBe = checkAccessibilityEnabledToBe;
module.exports.setAccessibilityState = setAccessibilityState;
