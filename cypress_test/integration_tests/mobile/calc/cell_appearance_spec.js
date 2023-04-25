/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Change cell appearance.', function() {
	var origTestFileName = 'cell_appearance.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function openAppearencePanel() {
		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScCellAppearancePropertyPanel');

		cy.cGet('body').contains('.menu-entry-with-icon', 'Background Color')
			.should('be.visible');
	}

	function openAppearencePanelOnFirstCell() {
		calcHelper.clickOnFirstCell();

		openAppearencePanel();
	}

	function openAppearencePanelOnAllCells() {
		calcHelper.selectEntireSheet();

		openAppearencePanel();
	}

	it('Apply background color', function() {
		openAppearencePanelOnFirstCell();

		helper.clickOnIdle('#BackgroundColor');

		mobileHelper.selectFromColorPicker('#BackgroundColor', 2);

		// Check that the color is shown as selected
		cy.cGet('#BackgroundColor .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 0, 0);');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'bgcolor', '#FF0000');
	});

	it('Apply left border', function() {
		openAppearencePanelOnFirstCell();

		helper.clickOnIdle('#border-2');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000');
	});

	it('Remove cell border', function() {
		openAppearencePanelOnFirstCell();

		// First add left border
		helper.clickOnIdle('#border-2');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000');

		// Then remove it
		openAppearencePanelOnFirstCell();

		helper.clickOnIdle('#border-1');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('not.have.attr', 'style');
	});

	it('Apply right border', function() {
		openAppearencePanelOnFirstCell();

		helper.clickOnIdle('#border-3');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-right: 1px solid #000000');
	});

	it('Apply left and right border', function() {
		openAppearencePanelOnFirstCell();

		helper.clickOnIdle('#border-4');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it('Apply top border', function() {
		openAppearencePanelOnFirstCell();

		helper.clickOnIdle('#border-5');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000');
	});

	it('Apply bottom border', function() {
		openAppearencePanelOnFirstCell();

		helper.clickOnIdle('#border-6');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-bottom: 1px solid #000000');
	});

	it('Apply top and bottom border', function() {
		openAppearencePanelOnFirstCell();

		helper.clickOnIdle('#border-7');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
	});

	it('Apply border for all sides', function() {
		openAppearencePanelOnFirstCell();

		helper.clickOnIdle('#border-8');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
	});

	it.skip('Apply horizontal borders for multiple cells', function() {
		openAppearencePanelOnAllCells();

		helper.clickOnIdle('#border-9');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
				}
			});
	});

	it.skip('Apply horizontal inner borders and vertical outer borders', function() {
		openAppearencePanelOnAllCells();

		helper.clickOnIdle('#border-10');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					if (i == 0 || i == 2)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000');
					else
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000');
				}
			});
	});

	it.skip('Apply vertical inner borders and horizontal outer borders', function() {
		openAppearencePanelOnAllCells();

		helper.clickOnIdle('#border-11');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					if (i == 0 || i == 1)
						expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
					else
						expect(cells[i]).to.have.attr('style', 'border-left: 1px solid #000000; border-right: 1px solid #000000');
				}
			});
	});

	it.skip('Apply all inner and outer borders', function() {
		openAppearencePanelOnAllCells();

		helper.clickOnIdle('#border-12');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
				for (var i = 0; i < cells.length; i++) {
					expect(cells[i]).to.have.attr('style', 'border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-left: 1px solid #000000; border-right: 1px solid #000000');
				}
			});
	});

	it('Apply border color', function() {
		openAppearencePanelOnFirstCell();

		// Apply left border first
		helper.clickOnIdle('#border-2');

		// Then apply border color
		helper.clickOnIdle('#FrameLineColor > .ui-header');

		mobileHelper.selectFromColorPicker('#FrameLineColor', 3);

		// Check that the color is shown as selected
		cy.cGet('#FrameLineColor > .ui-header .color-sample-selected')
			.should('have.attr', 'style', 'background-color: rgb(255, 153, 0);');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'style', 'border-left: 1px solid #ff9900');
	});
});
