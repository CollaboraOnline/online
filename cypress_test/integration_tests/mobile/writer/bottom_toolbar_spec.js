/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('./writer_helper');

describe('Pushing bottom toolbar items.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('bottom_toolbar.odt', 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Do a new selection
		writerHelper.selectAllMobile();
	});

	afterEach(function() {
		helper.afterAll('bottom_toolbar.odt');
	});

	it('Apply bold.', function() {
		cy.get('#tb_editbar_item_bold div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_bold')
			.click();

		cy.get('#tb_editbar_item_bold div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p b')
			.should('exist');
	});

	it('Apply italic.', function() {
		cy.get('#tb_editbar_item_italic div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_italic')
			.click();

		cy.get('#tb_editbar_item_italic div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p i')
			.should('exist');
	});
	it('Apply underline.', function() {
		cy.get('#tb_editbar_item_underline div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_underline')
			.click();

		cy.get('#tb_editbar_item_underline div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p u')
			.should('exist');
	});

	it('Apply strikeout.', function() {
		cy.get('#tb_editbar_item_strikeout div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_strikeout')
			.click();

		cy.get('#tb_editbar_item_strikeout div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p strike')
			.should('exist');
	});

	it('Apply text color.', function() {
		cy.get('#tb_editbar_item_fontcolor')
			.click();

		cy.get('#color-picker-0-basic-color-7')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.textcolor')
			.should('have.attr', 'style', 'box-shadow: rgb(255, 255, 255) 0px -2px inset, rgb(0, 0, 255) 0px -6px inset;');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'color', '#0000ff');
	});

	it('Apply highlight color.', function() {
		cy.get('#tb_editbar_item_backcolor')
			.click();

		cy.get('#color-picker-0-basic-color-9')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.backcolor')
			.should('have.attr', 'style', 'box-shadow: rgb(255, 255, 255) 0px -2px inset, rgb(255, 0, 255) 0px -6px inset;');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p font span')
			.should('have.attr', 'style', 'background: #ff00ff');
	});

	it('Apply left / right paragraph alignment.', function() {
		cy.get('#tb_editbar_item_rightpara div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_rightpara')
			.click();

		cy.get('#tb_editbar_item_rightpara div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');

		cy.get('#tb_editbar_item_leftpara div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_leftpara')
			.click();

		cy.get('#tb_editbar_item_leftpara div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Apply center paragraph alignment.', function() {
		cy.get('#tb_editbar_item_centerpara div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_centerpara')
			.click();

		cy.get('#tb_editbar_item_centerpara div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply justify paragraph alignment.', function() {
		cy.get('#tb_editbar_item_justifypara div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_justifypara')
			.click();

		cy.get('#tb_editbar_item_justifypara div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Apply default numbering.', function() {
		cy.get('#tb_editbar_item_defaultnumbering div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_defaultnumbering')
			.click();

		cy.get('#tb_editbar_item_defaultnumbering div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container ol li p')
			.should('exist');
	});

	it('Apply default bulleting.', function() {
		cy.get('#tb_editbar_item_defaultbullet div table')
			.should('not.have.class', 'checked');

		cy.get('#tb_editbar_item_defaultbullet')
			.click();

		cy.get('#tb_editbar_item_defaultbullet div table')
			.should('have.class', 'checked');

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container ul li p')
			.should('exist');
	});

	it('Increase / decrease indent.', function() {
		cy.get('#tb_editbar_item_incrementindent')
			.click().click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-left']).to.be.equal('0.98in');
			});

		cy.get('#tb_editbar_item_decrementindent')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-left']).to.be.equal('0.49in');
			});
	});
});
