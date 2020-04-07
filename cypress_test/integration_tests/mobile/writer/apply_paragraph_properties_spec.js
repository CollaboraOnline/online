/* global describe it cy beforeEach require expect afterEach Cypress*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('./writer_helper');

describe('Apply paragraph properties.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('apply_paragraph_properties.odt', 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Do a selection
		writerHelper.selectAllMobile();

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		cy.get('#Paragraph')
			.should('have.class', 'selected');
	});

	afterEach(function() {
		helper.afterAll('apply_paragraph_properties.odt');
	});

	it('Apply left alignment.', function() {
		// Change alignment
		cy.get('#CenterPara')
			.click();

		cy.get('#CenterParaimg')
			.should('have.class', 'selected');

		cy.get('#LeftPara')
			.click();

		cy.get('#LeftParaimg')
			.should('have.class', 'selected');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Apply center alignment.', function() {
		// Change alignment
		cy.get('#CenterPara')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply right alignment.', function() {
		// Change alignment
		cy.get('#RightPara')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');
	});

	it('Apply justify alignment.', function() {
		// Change alignment
		cy.get('#JustifyPara')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Change writing direction.', function() {
		// Change writing mode
		cy.get('#ParaRightToLeft')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'dir', 'rtl');

		// Select text
		writerHelper.selectAllMobile();

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		// Change writing mode
		cy.get('#ParaLeftToRight')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.should('not.have.attr', 'dir');
	});

	it('Apply default bulleting.', function() {
		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		cy.get('#DefaultBullet')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container ul li p')
			.should('exist');
	});

	it('Apply default numbering.', function() {
		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		cy.get('#DefaultNumbering')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container ol li p')
			.should('exist');
	});

	it('Apply background color.', function() {
		// TODO: Why this item is missing with core/master
		// In desktop LO, sidebar contains this item.
		if (Cypress.env('LO_CORE_VERSION') === 'master')
			return;

		// Change background color
		cy.get('#BackgroundColor')
			.click();

		cy.get('#color-picker-2-basic-color-5')
			.click();

		cy.get('#color-picker-2-tint-2')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['background']).to.be.equal('rgb(106, 168, 79)');
			});
	});

	it('Increase / decrease para spacing.', function() {
		// Increase para spacing
		cy.get('#ParaspaceIncrease')
			.click();
		cy.get('#ParaspaceIncrease')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-top']).to.be.equal('0.08in');
				expect(item[0].style['margin-bottom']).to.be.equal('0.08in');
			});

		// Select text
		writerHelper.selectAllMobile();

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		// Decrease para spacing
		cy.get('#ParaspaceDecrease')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-top']).to.be.equal('0.04in');
				expect(item[0].style['margin-bottom']).to.be.equal('0.04in');
			});
	});

	it('Change para spacing via combobox.', function() {
		// Check para spacing current value
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.0');
		cy.get('#belowparaspacing .spinfield')
			.should('have.attr', 'value', '0.0');

		// Change spacing
		cy.get('#aboveparaspacing .spinfieldcontrols .plus')
			.click();
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#aboveparaspacing .spinfieldcontrols .plus')
			.click();
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.04');
		cy.get('#aboveparaspacing .spinfieldcontrols .plus')
			.click();
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.06');

		cy.get('#belowparaspacing .spinfieldcontrols .plus')
			.click();
		cy.get('#belowparaspacing .spinfield')
			.should('have.attr', 'value', '0.02');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-top']).to.be.equal('0.06in');
				expect(item[0].style['margin-bottom']).to.be.equal('0.02in');
			});
	});

	it('Increase / decrease indent.', function() {
		// Increase indent
		cy.get('#IncrementIndent')
			.click();
		cy.get('#IncrementIndent')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-left']).to.be.equal('0.98in');
			});

		// Select text
		writerHelper.selectAllMobile();

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		// Decrease indent
		cy.get('#DecrementIndent')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-left']).to.be.equal('0.49in');
			});
	});

	it('Apply before text indent.', function() {
		// Change indent
		cy.get('#beforetextindent .spinfieldcontrols .plus')
			.click();
		cy.get('#beforetextindent .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#beforetextindent .spinfieldcontrols .plus')
			.click();
		cy.get('#beforetextindent .spinfield')
			.should('have.attr', 'value', '0.04');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-left']).to.be.equal('0.04in');
			});
	});

	it('Apply after text indent.', function() {
		// Change indent
		cy.get('#aftertextindent .spinfieldcontrols .plus')
			.click();
		cy.get('#aftertextindent .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#aftertextindent .spinfieldcontrols .plus')
			.click();
		cy.get('#aftertextindent .spinfield')
			.should('have.attr', 'value', '0.04');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-right']).to.be.equal('0.04in');
			});
	});

	it('Apply first line indent.', function() {
		// Increase firstline indent
		cy.get('#firstlineindent .spinfieldcontrols .plus')
			.click();
		cy.get('#firstlineindent .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#firstlineindent .spinfieldcontrols .plus')
			.click();
		cy.get('#firstlineindent .spinfield')
			.should('have.attr', 'value', '0.04');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['text-indent']).to.be.equal('0.04in');
			});
	});

	it('Linespacing item is hidden.', function() {
		// Linespacing item triggers a drop down menu in core
		// which is not implemented in online yet.
		cy.get('#LineSpacing')
			.should('not.exist');
	});
});
