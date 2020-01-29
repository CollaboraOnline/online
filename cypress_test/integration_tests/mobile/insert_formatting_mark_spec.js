/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../common/helper');

describe('Insert formatting mark via insertion wizard.', function() {
	beforeEach(function() {
		helper.loadTestDoc('simple.odt', true);

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();
	});

	afterEach(function() {
		cy.get('.closemobile').click();
		cy.wait(200); // wait some time to actually release the document
	});

	function generateTextHTML() {
		// Do a new selection
		cy.get('#document-container').click();
		cy.get('.leaflet-marker-icon')
			.should('not.exist');

		cy.wait(200);

		cy.get('body').type('{shift}{home}');
		cy.get('.leaflet-marker-icon');

		cy.wait(200);

		// Open context menu
		cy.get('.leaflet-marker-icon')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(2);
				var XPos = (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
				var YPos = marker[0].getBoundingClientRect().top;
				cy.get('body').rightclick(XPos, YPos);
			});

		// Execute copy
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon .context-menu-link')
			.contains('Copy')
			.click();

		// Close warning about clipboard operations
		cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
			.click();
	}

	it('Insert non-breaking space.', function() {
		// Open formatting marks
		cy.get('.sub-menu-title')
			.contains('Formatting Mark')
			.click();

		// Do the insertion
		cy.get('.menu-entry-no-icon')
			.contains('Non-breaking space')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u00a0');
			});
	});

	it('Insert non-breaking hyphen.', function() {
		// Open formatting marks
		cy.get('.sub-menu-title')
			.contains('Formatting Mark')
			.click();

		// Do the insertion
		cy.get('.menu-entry-no-icon')
			.contains('Non-breaking hyphen')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u2011');
			});
	});

	it('Insert soft hyphen.', function() {
		// Open formatting marks
		cy.get('.sub-menu-title')
			.contains('Formatting Mark')
			.click();

		// Do the insertion
		cy.get('.menu-entry-no-icon')
			.contains('Soft hyphen')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u00ad');
			});
	});

	it('Insert no-width optional break.', function() {
		// Open formatting marks
		cy.get('.sub-menu-title')
			.contains('Formatting Mark')
			.click();

		// Do the insertion
		cy.get('.menu-entry-no-icon')
			.contains('No-width optional break')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200b');
			});
	});

	it('Insert no-width no break.', function() {
		// Open formatting marks
		cy.get('.sub-menu-title')
			.contains('Formatting Mark')
			.click();

		// Do the insertion
		cy.get('.menu-entry-no-icon')
			.contains('No-width no break')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u2060');
			});
	});

	it('Insert left-to-right mark.', function() {
		// Open formatting marks
		cy.get('.sub-menu-title')
			.contains('Formatting Mark')
			.click();

		// Do the insertion
		cy.get('.menu-entry-no-icon')
			.contains('Left-to-right mark')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200e');
			});
	});

	it('Insert right-to-left mark.', function() {
		// Open formatting marks
		cy.get('.sub-menu-title')
			.contains('Formatting Mark')
			.click();

		// Do the insertion
		cy.get('.menu-entry-no-icon')
			.contains('Right-to-left mark')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200f');
			});
	});
});
