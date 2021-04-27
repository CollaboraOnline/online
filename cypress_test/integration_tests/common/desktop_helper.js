/* global cy Cypress expect */

// Make the sidebar visible by clicking on the corresponding toolbar item.
// We assume that the sidebar is hidden, when this method is called.
function showSidebar() {
	cy.log('Showing sidebar - start.');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.should('not.have.class', 'checked');

	cy.get('#sidebar-panel')
		.should('not.be.visible');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.click({force: true});

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.should('have.class', 'checked');

	cy.get('#sidebar-panel')
		.should('be.visible');

	cy.log('Showing sidebar - end.');
}

// Hide the sidebar by clicking on the corresponding toolbar item.
// We assume that the sidebar is visible, when this method is called.
function hideSidebar() {
	cy.log('Hiding sidebar - start.');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.should('have.class', 'checked');

	cy.get('#sidebar-panel')
		.should('be.visible');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.click({force: true});

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.should('not.have.class', 'checked');

	cy.get('#sidebar-panel')
		.should('not.be.visible');

	cy.log('Hiding sidebar - end.');
}

// Make the status bar visible if it's hidden at the moment.
// We use the menu option under 'View' menu to make it visible.
function showStatusBarIfHidden() {
	cy.get('#toolbar-down')
		.then(function(statusbar) {
			if (!Cypress.dom.isVisible(statusbar[0])) {
				cy.get('#menu-view')
					.click();

				cy.get('#menu-showstatusbar')
					.click();
			}
		});

	cy.get('#toolbar-down')
		.should('be.visible');
}

// Make the sidebar visible if it's hidden at the moment.
function showSidebarIfHidden() {
	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.then(function(sidebarItem) {
			if (!sidebarItem.hasClass('checked')) {
				showSidebar();
			}
		});

	cy.get('#sidebar-panel')
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

	cy.get('#sidebar-panel')
		.should('not.be.visible');
}

// Select a color from colour palette widget used on top toolbar.
// Parameters:
// color - a hexadecimal color code without the '#' mark (e.g. 'FF011B')
function selectColorFromPalette(color) {
	cy.get('.w2ui-overlay')
		.should('be.visible');

	cy.get('.w2ui-color [name="' + color + '"]')
		.click();

	cy.get('.w2ui-overlay')
		.should('not.exist');
}

// Select an item from a listbox widget used on top toolbar.
// Parameters:
// item - item string, that we use a selector to find the right list item.
function selectFromListbox(item) {
	cy.get('.select2-dropdown')
		.should('be.visible');

	// We use force because the tooltip sometimes hides the items.
	cy.contains('.select2-results__option', item)
		.click({force: true});

	cy.get('.select2-dropdown')
		.should('not.exist');
}

// Make sure the right dialog is opened and then we close it.
// Used for tunneled dialogs. We don't interact with this dialogs
// now, because they are just images. We mostly just check that
// the dialog is open.
// Parameters:
// dialogTitle - a title string to make sure the right dialog was opened.
function checkDialogAndClose(dialogTitle) {
	// Dialog is opened
	cy.get('.lokdialog_canvas')
		.should('be.visible');

	cy.get('.ui-dialog-title')
		.should('have.text', dialogTitle);

	// Close the dialog
	cy.get('body')
		.type('{esc}');

	cy.get('.lokdialog_canvas')
		.should('not.exist');
}

// Checks wether the document has the given zoom level according to the status bar.
// Parameters:
// zoomLevel        the expected zoom level (e.g. '100' means 100%).
function shouldHaveZoomLevel(zoomLevel) {
	cy.get('#tb_actionbar_item_zoom .w2ui-tb-caption')
		.should('have.text', zoomLevel);
}

// Make the zoom related status bar items visible if they are hidden.
// The status bar van be long to not fit on the screen. We have a scroll
// item for navigation in this case.
function makeZoomItemsVisible() {
	cy.get('.w2ui-tb-image.w2ui-icon.zoomin')
		.then(function(zoomInItem) {
			if (!Cypress.dom.isVisible(zoomInItem)) {
				cy.get('#toolbar-down .w2ui-scroll-right')
					.click();
			}
		});

	cy.get('.w2ui-tb-image.w2ui-icon.zoomin')
		.should('be.visible');
}

// Increase / decrease the zoom level using the status bar related items.
// Parameters:
// zoomIn - do a zoom in (e.g. increase zoom level) or zoom out.
function doZoom(zoomIn) {
	makeZoomItemsVisible();

	var prevZoom = '';
	cy.get('#tb_actionbar_item_zoom .w2ui-tb-caption')
		.should(function(zoomLevel) {
			prevZoom = zoomLevel.text();
			expect(prevZoom).to.not.equal('');
		});

	if (zoomIn) {
		cy.get('.w2ui-tb-image.w2ui-icon.zoomin')
			.click();
	} else {
		cy.get('.w2ui-tb-image.w2ui-icon.zoomout')
			.click();
	}

	cy.get('#tb_actionbar_item_zoom .w2ui-tb-caption')
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
	makeZoomItemsVisible();

	cy.get('#tb_actionbar_item_zoom')
		.click();

	cy.contains('.w2ui-drop-menu .menu-text', zoomLevel)
		.click();

	shouldHaveZoomLevel(zoomLevel);
}

// Reser zoom level to 100%.
function resetZoomLevel() {
	makeZoomItemsVisible();

	cy.get('#tb_actionbar_item_zoomreset')
		.click();

	shouldHaveZoomLevel('100');
}

function insertImage() {
	cy.get('#menu-insert').click();

	cy.contains('#menu-insertgraphic', 'Local Image...')
		.should('be.visible');

	cy.get('#insertgraphic[type=file]')
		.attachFile('/desktop/writer/image_to_insert.png');

	cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
		.should('exist');
}

function deleteImage() {
	insertImage();

	cy.get('.leaflet-pane.leaflet-overlay-pane svg g path.leaflet-interactive')
		.rightclick();

	cy.contains('.context-menu-item','Delete')
		.click();

	cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
		.should('not.exist');
}

module.exports.showSidebar = showSidebar;
module.exports.hideSidebar = hideSidebar;
module.exports.showStatusBarIfHidden = showStatusBarIfHidden;
module.exports.showSidebarIfHidden = showSidebarIfHidden;
module.exports.hideSidebarIfVisible = hideSidebarIfVisible;
module.exports.selectColorFromPalette = selectColorFromPalette;
module.exports.selectFromListbox = selectFromListbox;
module.exports.checkDialogAndClose = checkDialogAndClose;
module.exports.zoomIn = zoomIn;
module.exports.zoomOut = zoomOut;
module.exports.shouldHaveZoomLevel = shouldHaveZoomLevel;
module.exports.selectZoomLevel = selectZoomLevel;
module.exports.resetZoomLevel = resetZoomLevel;
module.exports.insertImage = insertImage;
module.exports.deleteImage = deleteImage;
