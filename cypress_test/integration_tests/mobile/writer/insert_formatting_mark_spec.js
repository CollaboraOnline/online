/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../../common/helper');

describe('Insert formatting mark via insertion wizard.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('simple.odt', 'writer');

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();
	});

	afterEach(function() {
		helper.afterAll();
	});

	it('Insert non-breaking space.', function() {
		// Open formatting marks
		cy.get('.sub-menu-title')
			.contains('Formatting Mark')
			.click();

		// Do the insertion
		cy.get('.menu-entry-no-icon')
			.contains('Non-breaking space')
			.click();

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200f');
			});
	});
});
