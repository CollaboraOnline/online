/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerMobileHelper = require('./writer_mobile_helper');

describe('Trigger hamburger menu options.', function() {
	var testFileName = 'hamburger_menu.odt';

	beforeEach(function() {
		mobileHelper.beforeAllMobile(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		mobileHelper.openHamburgerMenu();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Search some word.', function() {
		cy.contains('.menu-entry-with-icon', 'Search')
			.click();

		// Search bar become visible
		cy.get('#toolbar-search')
			.should('be.visible');

		// Search for some word
		cy.get('#search-input')
			.type('a');

		// Part of the text should be selected
		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		// Go for the second match
		cy.get('.w2ui-tb-image.w2ui-icon.next')
			.click();

		cy.get('#copy-paste-container p b')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Go back to the first match
		cy.get('.w2ui-tb-image.w2ui-icon.prev')
			.click();

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Remove search word
		cy.get('#search-input')
			.should('have.prop', 'value', 'a');

		cy.get('.w2ui-tb-image.w2ui-icon.cancel')
			.click();

		cy.get('#search-input')
			.should('have.prop', 'value', '');

		// Close search toolbar
		cy.get('.w2ui-tb-image.w2ui-icon.unfold')
			.click();

		cy.get('#toolbar-search')
			.should('not.be.visible');
	});

	it('Check word counts.', function() {
		mobileHelper.closeHamburgerMenu();

		writerMobileHelper.selectAllMobile();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Word Count...')
			.click();

		// Selected counts
		cy.get('#selectwords')
			.should('have.text', '61');

		cy.get('#selectchars')
			.should('have.text', '689');

		cy.get('#selectcharsnospaces')
			.should('have.text', '629');

		cy.get('#selectcjkchars')
			.should('have.text', '0');

		// General counts
		cy.get('#docwords')
			.should('have.text', '61');

		cy.get('#docchars')
			.should('have.text', '689');

		cy.get('#doccharsnospaces')
			.should('have.text', '629');

		cy.get('#doccjkchars')
			.should('have.text', '0');
	});

	it('Check version information.', function() {
		// Open about dialog
		cy.contains('.menu-entry-with-icon', 'About')
			.click();

		cy.get('.vex-content')
			.should('exist');

		// Check the version
		if (helper.getLOVersion() === 'master') {
			cy.contains('#lokit-version', 'LibreOffice')
				.should('exist');
		} else if (helper.getLOVersion() === 'cp-6-2' ||
				   helper.getLOVersion() === 'cp-6-4')
		{
			cy.contains('#lokit-version', 'Collabora Office')
				.should('exist');
		}

		// Close about dialog
		cy.get('.vex-close')
			.click({force : true});

		cy.get('.vex-content')
			.should('not.exist');
	});
});

