/* global cy Cypress expect require*/

var helper = require('./helper');

// Enable editing if we are in read-only mode.
function enableEditingMobile() {
	cy.get('#mobile-edit-button')
		.then(function(button) {
			if (button.css('display') !== 'none') {
				cy.get('#mobile-edit-button')
					.click();
			}
		});

	cy.get('#tb_actionbar_item_mobile_wizard')
		.should('not.have.class', 'disabled');
}

function beforeAllMobile(fileName, subFolder) {
	helper.loadTestDoc(fileName, subFolder, true);

	detectLOCoreVersion();
}

function detectLOCoreVersion() {
	if (Cypress.env('LO_CORE_VERSION') === undefined) {
		// Open hamburger menu
		openHamburgerMenu();

		// Open about dialog
		cy.get('.ui-header.level-0 .menu-entry-with-icon')
			.contains('About')
			.click();

		cy.get('.vex-content')
			.should('exist');

		// Get the version
		cy.get('#lokit-version')
			.then(function(items) {
				expect(items).have.lengthOf(1);
				if (items[0].textContent.includes('Collabora') &&
				    items[0].textContent.includes('6.2')) {
					Cypress.env('LO_CORE_VERSION', 'cp-6-2');}
				else {
					Cypress.env('LO_CORE_VERSION', 'master');
				}
			});

		// Close about dialog
		cy.get('.vex-close')
			.click({force : true});

		cy.get('.vex-content')
			.should('not.exist');
	}
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

			// This value is set in Map.TouchGesture.js.
			cy.wait(500);

			cy.get('.leaflet-pane.leaflet-map-pane')
				.trigger('pointerup', eventOptions);
		});
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

module.exports.enableEditingMobile = enableEditingMobile;
module.exports.beforeAllMobile = beforeAllMobile;
module.exports.longPressOnDocument = longPressOnDocument;
module.exports.openHamburgerMenu = openHamburgerMenu;
module.exports.closeHamburgerMenu = closeHamburgerMenu;
module.exports.openMobileWizard = openMobileWizard;
module.exports.closeMobileWizard = closeMobileWizard;
