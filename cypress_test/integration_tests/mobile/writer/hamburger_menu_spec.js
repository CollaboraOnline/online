/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerMobileHelper = require('./writer_mobile_helper');

describe('Trigger hamburger menu options.', function() {
	var testFileName = 'hamburger_menu.odt';

	beforeEach(function() {
		mobileHelper.beforeAllMobile(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Enable track changes recording.', function() {
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// Insert some text and check whether it's tracked.
		cy.get('textarea.clipboard')
			.type('{q}');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Previous')
			.click();

		cy.get('.leaflet-marker-icon')
			.should('exist');

		// We should have 'q' selected.
		cy.get('#copy-paste-container p')
			.should('have.text', '\nq');

		// Then disable recording.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		cy.get('textarea.clipboard')
			.type('{rightArrow}w');

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Previous')
			.click();

		cy.get('.leaflet-marker-icon')
			.should('exist');

		// We should have 'q' selected.
		cy.get('#copy-paste-container p')
			.should('have.text', '\nq');
	});

	it('Show track changes.', function() {
		mobileHelper.openHamburgerMenu();

		// First start recording.
		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		// By default track changed are shown.
		writerMobileHelper.selectAllMobile();

		// We have selection markers.
		cy.get('.leaflet-marker-icon')
			.should('exist');

		// No actual text sent from core because of the removal.
		cy.get('#copy-paste-container p')
			.should('have.text', '\n\n\n');

		// We have a multiline selection
		cy.get('.leaflet-marker-icon:nth-of-type(1)')
			.then(function(firstMarker) {
				cy.get('.leaflet-marker-icon:nth-of-type(2)')
					.then(function(secondMarker) {
						expect(firstMarker.offset().top).to.be.lessThan(secondMarker.offset().top);
						expect(firstMarker.offset().left).to.be.lessThan(secondMarker.offset().left);
					});
			});

		// Remove text selection.
		cy.get('textarea.clipboard')
			.type('{leftArrow}');

		// Hide track changes.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Show')
			.click();

		// Trigger select all
		cy.get('textarea.clipboard')
			.type('{ctrl}a');

		// Both selection markers should be in the same line
		cy.get('.leaflet-marker-icon:nth-of-type(1)')
			.then(function(firstMarker) {
				cy.get('.leaflet-marker-icon:nth-of-type(2)')
					.then(function(secondMarker) {
						expect(firstMarker.offset().top).to.be.equal(secondMarker.offset().top);
						expect(firstMarker.offset().left).to.be.lessThan(secondMarker.offset().left);
					});
			});
	});

	it('Accept all changes.', function() {
		mobileHelper.openHamburgerMenu();

		// First start recording.
		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		// Accept removal.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Accept All')
			.click();

		// Check that we dont have the removed content
		cy.get('textarea.clipboard')
			.type('{ctrl}a');

		cy.wait(1000);

		// No selection
		cy.get('.leaflet-marker-icon')
			.should('not.exist');
	});

	it('Reject all changes.', function() {
		mobileHelper.openHamburgerMenu();

		// First start recording.
		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// Remove text content.
		cy.get('#document-container')
			.click();

		helper.clearAllText();

		writerMobileHelper.selectAllMobile();

		// We dont have actual text content.
		cy.get('#copy-paste-container p')
			.should('have.text', '\n\n\n');

		// Reject removal.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Reject All')
			.click();

		writerMobileHelper.selectAllMobile();

		// We get back the content.
		cy.contains('#copy-paste-container p', 'xxxxxxx')
			.should('exist');
	});

	it('Go to next/prev change.', function() {
		mobileHelper.openHamburgerMenu();

		// First start recording.
		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Record')
			.click();

		// First change
		cy.get('textarea.clipboard')
			.type('q');

		// Second change
		cy.get('textarea.clipboard')
			.type('{rightArrow}w');

		// Find second change using prev.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Previous')
			.click();

		cy.get('#copy-paste-container p')
			.should('have.text', '\nw');

		// Find first change using prev.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Previous')
			.click();

		cy.get('#copy-paste-container p')
			.should('have.text', '\nq');

		// Find second change using next.
		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'Track Changes')
			.click();

		cy.contains('.menu-entry-with-icon', 'Next')
			.click();

		cy.get('#copy-paste-container p')
			.should('have.text', '\nw');
	});

	it('Search some word.', function() {
		mobileHelper.openHamburgerMenu();

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
		mobileHelper.openHamburgerMenu();

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

