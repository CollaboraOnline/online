/* global cy expect*/

function selectAllMobile() {
	// Remove selection if exist
	cy.get('#document-container').click();
	cy.get('.leaflet-marker-icon')
		.should('not.exist');

	// Enable editing if it's in read-only mode
	cy.get('#mobile-edit-button')
		.then(function(button) {
			if (button.css('display') !== 'none') {
				cy.get('#mobile-edit-button')
					.click();
			}
		});

	// Open hamburger menu
	cy.get('#toolbar-hamburger')
		.click();

	// Open edit menu
	cy.get('.ui-header.level-0 .menu-entry-with-icon')
		.contains('Edit')
		.click();

	cy.get('.ui-header.level-1 .menu-entry-with-icon')
		.should('be.visible')
		.wait(100);

	// Do the selection
	cy.get('.ui-header.level-1 .menu-entry-with-icon')
		.contains('Select All')
		.click();

	cy.get('.leaflet-marker-icon')
		.should('exist');
}

function copyTextToClipboard() {
	// Do a new selection
	selectAllMobile();

	// Open context menu
	cy.get('.leaflet-marker-icon')
		.then(function(marker) {
			expect(marker).to.have.lengthOf(2);
			var XPos =  (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
			var YPos = marker[0].getBoundingClientRect().top - 5;
			longPressOnDocument(XPos, YPos);
		});

	// Execute copy
	cy.get('.ui-header.level-0.mobile-wizard.ui-widget .context-menu-link .menu-entry-with-icon', {timeout : 10000})
		.contains('Copy')
		.click();

	// Close warning about clipboard operations
	cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
		.click();

	// Wait until it's closed
	cy.get('.vex-overlay')
		.should('not.exist');
}

function copyTableToClipboard() {
	// Do a new selection
	selectAllMobile();

	// Open context menu
	cy.get('.leaflet-marker-icon')
		.then(function(markers) {
			expect(markers.length).to.have.greaterThan(1);
			for (var i = 0; i < markers.length; i++) {
				if (markers[i].classList.contains('leaflet-selection-marker-start')) {
					var startPos = markers[i].getBoundingClientRect();
				} else if (markers[i].classList.contains('leaflet-selection-marker-end')) {
					var endPos = markers[i].getBoundingClientRect();
				}
			}

			var XPos = startPos.right + 10;
			var YPos = (startPos.top + endPos.top) / 2;
			longPressOnDocument(XPos, YPos);
		});

	// Execute copy
	cy.get('.ui-header.level-0.mobile-wizard.ui-widget .context-menu-link .menu-entry-with-icon')
		.contains('Copy')
		.click();

	// Close warning about clipboard operations
	cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
		.click();

	// Wait until it's closed
	cy.get('.vex-overlay')
		.should('not.exist');
}

function longPressOnDocument(posX, posY) {
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

			cy.wait(600);

			cy.get('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerup', eventOptions);
		});
}

// Use this method when a test openes the same mobile
// wizard more times during a test.
// Recent issue with this scenario is that the mobile
// wizard is opened first with an old content, then
// when the sidebar's state arrives the wizard is
// rerendered again which might cause a test failure
// because the test finds the old HTML item
// which will be detached from DOM.
function clearMobileWizardState() {
	// Open hamburger menu
	cy.get('#toolbar-hamburger')
		.click();

	cy.get('.ui-header.level-0 .menu-entry-with-icon')
		.contains('About');

	// Close hamburger menu
	cy.get('#toolbar-hamburger')
		.click();
}

module.exports.selectAllMobile = selectAllMobile;
module.exports.copyTextToClipboard = copyTextToClipboard;
module.exports.copyTableToClipboard = copyTableToClipboard;
module.exports.longPressOnDocument = longPressOnDocument;
module.exports.clearMobileWizardState = clearMobileWizardState;
