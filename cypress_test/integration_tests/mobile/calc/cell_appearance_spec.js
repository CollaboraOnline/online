/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Change cell appearance.', function() {
	var testFileName = 'cell_appearance.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function openAppearencePanel() {
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScCellAppearancePropertyPanel');

		cy.contains('.menu-entry-with-icon', 'Background Color')
			.should('be.visible');
	}

	function openAppearencePanelOnFirtsCell() {
		calcHelper.clickOnFirstCell();

		openAppearencePanel();
	}

	function openAppearencePanelOnAllCells() {
		calcHelper.selectAllMobile();

		openAppearencePanel();
	}

	it('Apply background color', function() {
		openAppearencePanelOnFirtsCell();

		helper.clickOnIdle('#BackgroundColor');

		mobileHelper.selectFromColorPalette(1, 2);

		// Check that the color is shown as selected
		cy.get('#BackgroundColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 0, 0);');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'bgcolor', '#FF0000');
	});

	it('Apply left border', function() {
		openAppearencePanelOnFirtsCell();

		helper.clickOnIdle('#border-2');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000');
	});

	it('Remove cell border', function() {
		openAppearencePanelOnFirtsCell();

		// First add left border
		helper.clickOnIdle('#border-2');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000');

		// Then remove it
		openAppearencePanelOnFirtsCell();

		helper.clickOnIdle('#border-1');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('not.have.attr', 'style');
	});

	it('Apply right border', function() {
		openAppearencePanelOnFirtsCell();

		helper.clickOnIdle('#border-3');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-right: 1px solid #000000');
	});

	it('Apply left and right border', function() {
		openAppearencePanelOnFirtsCell();

		helper.clickOnIdle('#border-4');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it('Apply top border', function() {
		openAppearencePanelOnFirtsCell();

		helper.clickOnIdle('#border-5');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000');
	});

	it('Apply bottom border', function() {
		openAppearencePanelOnFirtsCell();

		helper.clickOnIdle('#border-6');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-bottom: 1px solid #000000');
	});

	it('Apply top and bottom border', function() {
		openAppearencePanelOnFirtsCell();

		helper.clickOnIdle('#border-7');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
	});

	it('Apply border for all sides', function() {
		openAppearencePanelOnFirtsCell();

		helper.clickOnIdle('#border-8');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it('Apply horizontal borders for multiple cells', function() {
		openAppearencePanelOnAllCells();

		helper.clickOnIdle('#border-9');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
				}
			});
	});

	it('Apply horizontal inner borders and vertical outer borders', function() {
		openAppearencePanelOnAllCells();

		helper.clickOnIdle('#border-10');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					if (i == 0)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000');
					else if (i == 1)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
					else if (i == 2)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000');
					else
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
				}
			});
	});

	it('Apply vertical inner borders and horizontal outer borders', function() {
		openAppearencePanelOnAllCells();

		helper.clickOnIdle('#border-11');

		// TODO
		cy.wait(200);

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					if (i == 0)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
					else if (i == 1)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
					else if (i == 2)
						expect(cells[i]).to.have.attr('style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
					else
						expect(cells[i]).to.have.attr('style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
				}
			});
	});

	it('Apply all inner and outer borders', function() {
		openAppearencePanelOnAllCells();

		helper.clickOnIdle('#border-12');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					if (i == 0)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
					else if (i == 1)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
					else if (i == 2)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
					else
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
				}
			});
	});

	it('Apply border color', function() {
		openAppearencePanelOnFirtsCell();

		// Apply left border first
		helper.clickOnIdle('#border-2');

		// Then apply border color
		helper.clickOnIdle('#FrameLineColor');

		mobileHelper.selectFromColorPalette(2, 3);

		// Check that the color is shown as selected
		cy.get('#FrameLineColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 153, 0);');

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #ff9900');
	});
});
