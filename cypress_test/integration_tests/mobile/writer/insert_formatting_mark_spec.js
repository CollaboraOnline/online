/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('./writer_helper');

describe('Insert formatting mark via insertion wizard.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('insert_formatting_mark.odt', 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Open formatting marks
		helper.selectItemByContent('.menu-entry-with-icon.flex-fullwidth', 'Formatting Mark')
			.click();

		cy.get('.ui-content.level-0.mobile-wizard')
			.should('be.visible');
	});

	afterEach(function() {
		helper.afterAll('insert_formatting_mark.odt');
	});

	it('Insert non-breaking space.', function() {
		helper.selectItemByContent('.menu-entry-with-icon', 'Non-breaking space')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u00a0');
			});
	});

	it('Insert non-breaking hyphen.', function() {
		helper.selectItemByContent('.menu-entry-with-icon', 'Non-breaking hyphen')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u2011');
			});
	});

	it('Insert soft hyphen.', function() {
		helper.selectItemByContent('.menu-entry-with-icon', 'Soft hyphen')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u00ad');
			});
	});

	it('Insert no-width optional break.', function() {
		helper.selectItemByContent('.menu-entry-with-icon', 'No-width optional break')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200b');
			});
	});

	it('Insert no-width no break.', function() {
		helper.selectItemByContent('.menu-entry-with-icon', 'No-width no break')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u2060');
			});
	});

	it('Insert left-to-right mark.', function() {
		helper.selectItemByContent('.menu-entry-with-icon', 'Left-to-right mark')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200e');
			});
	});

	it('Insert right-to-left mark.', function() {
		helper.selectItemByContent('.menu-entry-with-icon', 'Right-to-left mark')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('\u200f');
			});
	});
});
