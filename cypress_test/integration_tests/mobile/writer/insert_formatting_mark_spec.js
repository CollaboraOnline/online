/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../../common/helper');
var writerHelper = require('./writer_helper');

describe('Insert formatting mark via insertion wizard.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('insert_formatting_mark.odt', 'writer');

		// Click on edit button
		helper.enableEditingMobile();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Open formatting marks
		cy.get('.menu-entry-with-icon.flex-fullwidth')
			.contains('Formatting Mark')
			.click();

		cy.get('.ui-content.level-0.mobile-wizard')
			.should('be.visible');
	});

	afterEach(function() {
		helper.afterAll('insert_formatting_mark.odt');
	});

	it('Insert non-breaking space.', function() {
		cy.get('.menu-entry-with-icon')
			.contains('Non-breaking space')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u00a0');
			});
	});

	it('Insert non-breaking hyphen.', function() {
		cy.get('.menu-entry-with-icon')
			.contains('Non-breaking hyphen')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u2011');
			});
	});

	it('Insert soft hyphen.', function() {
		cy.get('.menu-entry-with-icon')
			.contains('Soft hyphen')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u00ad');
			});
	});

	it('Insert no-width optional break.', function() {
		cy.get('.menu-entry-with-icon')
			.contains('No-width optional break')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200b');
			});
	});

	it('Insert no-width no break.', function() {
		cy.get('.menu-entry-with-icon')
			.contains('No-width no break')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u2060');
			});
	});

	it('Insert left-to-right mark.', function() {
		cy.get('.menu-entry-with-icon')
			.contains('Left-to-right mark')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200e');
			});
	});

	it('Insert right-to-left mark.', function() {
		cy.get('.menu-entry-with-icon')
			.contains('Right-to-left mark')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200f');
			});
	});
});
