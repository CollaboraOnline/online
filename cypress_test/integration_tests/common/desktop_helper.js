/* global cy Cypress expect */

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

function showSidebarIfHidden() {
	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.then(function(sidebarItem) {
			if (!sidebarItem.hasClass('checked')) {
				showSidebar();
			}
		});
}

function hideSidebarIfVisible() {
	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.then(function(sidebarItem) {
			if (sidebarItem.hasClass('checked')) {
				hideSidebar();
			}
		});
}

function selectColorFromPalette(color) {
	cy.get('.w2ui-overlay')
		.should('be.visible');

	cy.get('.w2ui-color [name="' + color + '"]')
		.click();

	cy.get('.w2ui-overlay')
		.should('not.exist');
}

function selectFromListbox(item) {
	cy.get('.select2-dropdown')
		.should('be.visible');

	// We use force because of the tooltip hiding the items.
	cy.contains('.select2-results__option', item)
		.click({force: true});

	cy.get('.select2-dropdown')
		.should('not.exist');
}

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

function shouldHaveZoomLevel(zoomLevel) {
	cy.get('#tb_actionbar_item_zoom .w2ui-tb-caption')
		.should('have.text', zoomLevel);
}

function doZoom(zoomIn) {
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

function zoomIn() {
	doZoom(true);
}

function zoomOut() {
	doZoom(false);
}

function selectZoomLevel(zoomLevel) {
	cy.get('#tb_actionbar_item_zoom')
		.click();

	cy.contains('.w2ui-drop-menu .menu-text', zoomLevel)
		.click();

	shouldHaveZoomLevel(zoomLevel);
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
