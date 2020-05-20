/* global describe it cy require afterEach expect */

var helper = require('../../common/helper');
var calc = require('../../common/calc');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('./calc_helper');

describe('Interact with bottom toolbar.', function() {
	function before(fileName, subPath) {
		mobileHelper.beforeAllMobile(fileName, subPath);

		// Click on edit button
		mobileHelper.enableEditingMobile();

		calc.clickOnFirstCell();
	}

	afterEach(function() {
		helper.afterAll('apply_font.ods');
	});

	function getTextPosForFirstCell() {
		calc.dblClickOnFirstCell();

		// Select text content
		cy.get('textarea.clipboard')
			.type('{ctrl}a', {force: true});

		helper.initAliasToNegative('currentTextPos');

		cy.get('.leaflet-selection-marker-end')
			.invoke('offset')
			.its('left')
			.as('currentTextPos');

		cy.get('@currentTextPos')
			.should('be.greaterThan', 0);

		calcHelper.removeTextSelection();
	}

	it('Apply bold.', function() {
		before('bottom_toolbar.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.bold')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td b')
			.should('exist');
	});

	it('Apply italic.', function() {
		before('bottom_toolbar.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.italic')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td i')
			.should('exist');
	});

	it('Apply underline.', function() {
		before('bottom_toolbar.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.underline')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td u')
			.should('exist');
	});

	it('Apply strikeout.', function() {
		before('bottom_toolbar.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.strikeout')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td s')
			.should('exist');
	});

	it('Apply font color.', function() {
		before('bottom_toolbar.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.textcolor')
			.click();

		cy.get('#color-picker-0-basic-color-5')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td font')
			.should('have.attr', 'color', '#00FF00');
	});

	it('Apply highlight color.', function() {
		before('bottom_toolbar.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.backcolor')
			.click();

		cy.get('#color-picker-0-basic-color-5')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'bgcolor', '#00FF00');
	});

	it('Merge cells', function() {
		before('bottom_toolbar.ods', 'calc');

		// Select the full row
		calcHelper.selectFirstRow();

		cy.get('.w2ui-tb-image.w2ui-icon.togglemergecells')
			.click();

		calcHelper.selectAllMobile(false);

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'colspan', '1024');
	});

	it('Apply left/right alignment', function() {
		before('bottom_toolbar.ods', 'calc');

		// Set right aligment first
		cy.get('.w2ui-tb-image.w2ui-icon.alignright')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'right');

		// Change alignment back
		calc.clickOnFirstCell();

		cy.get('.w2ui-tb-image.w2ui-icon.alignleft')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'left');
	});

	it('Align to center.', function() {
		before('bottom_toolbar.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.alignhorizontal')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'center');
	});

	it('Change to block alignment.', function() {
		before('bottom_toolbar.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.alignblock')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'justify');
	});

	it('Enable text wrapping.', function() {
		before('bottom_toolbar.ods', 'calc');

		helper.initAliasToNegative('originalTextPos');

		getTextPosForFirstCell();
		cy.get('@currentTextPos')
			.as('originalTextPos');

		cy.get('@currentTextPos')
			.should('be.greaterThan', 0);

		calc.clickOnFirstCell();

		cy.get('.w2ui-tb-image.w2ui-icon.wraptext')
			.click();

		// We use the text position as indicator
		cy.get('body')
			.should(function() {
				getTextPosForFirstCell();

				cy.get('@currentTextPos')
					.then(function(currentTextPos) {
						cy.get('@originalTextPos')
							.then(function(originalTextPos) {
								expect(originalTextPos).to.be.greaterThan(currentTextPos);
							});
					});
			});
	});

	it('Insert row after.', function() {
		before('bottom_toolbar2.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.insertrowsafter')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table tr')
			.should('have.length', 3);

		cy.get('#copy-paste-container table tr:nth-of-type(1)')
			.should('contain.text', 'long line long line long line');

		cy.get('#copy-paste-container table tr:nth-of-type(2)')
			.should('not.contain.text', 'long line long line long line');

		cy.get('#copy-paste-container table tr:nth-of-type(2)')
			.should('not.contain.text', '2');

		cy.get('#copy-paste-container table tr:nth-of-type(3)')
			.should('contain.text', '2');
	});

	it('Insert column after.', function() {
		before('bottom_toolbar2.ods', 'calc');

		cy.get('.w2ui-tb-image.w2ui-icon.insertcolumnsafter')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table tr')
			.should('have.length', 2);

		cy.get('#copy-paste-container table tr:nth-of-type(1) td')
			.should('have.length', 3);

		cy.get('#copy-paste-container table tr:nth-of-type(1) td:nth-of-type(1)')
			.should('contain.text', 'long line long line long line');

		cy.get('#copy-paste-container table tr:nth-of-type(1) td:nth-of-type(2)')
			.should('not.contain.text', 'long line long line long line');

		cy.get('#copy-paste-container table tr:nth-of-type(1) td:nth-of-type(2)')
			.should('not.contain.text', '1');

		cy.get('#copy-paste-container table tr:nth-of-type(1) td:nth-of-type(3)')
			.should('contain.text', '1');
	});
});
