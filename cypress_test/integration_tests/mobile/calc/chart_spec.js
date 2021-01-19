/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('../../common/calc_helper');

describe('Chart tests.', function() {
	var testFileName = 'chart.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		mobileHelper.enableEditingMobile();

		calcHelper.selectFirstColumn();

		insertChart();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function insertChart() {
		mobileHelper.openInsertionWizard();

		cy.contains('.menu-entry-with-icon', 'Chart...')
			.click();

		cy.get('.leaflet-drag-transform-marker')
			.should('have.length', 32);

		cy.get('svg .OLE2')
			.should('exist');

		cy.get('svg .OLE2 g g path')
			.should('have.length', 40);
	}

	function stepIntoChartEditing() {
		cy.get('.leaflet-drag-transform-marker')
			.should('exist');

		// Double click onto the chart shape
		cy.get('svg g svg')
			.then(function(items) {
				expect(items).to.have.length(1);
				var boundingRect = items[0].getBoundingClientRect();
				var XPos = boundingRect.left + 10;
				var YPos = (boundingRect.top + boundingRect.bottom) / 2;

				cy.get('body')
					.dblclick(XPos, YPos);
			});

		cy.get('.leaflet-drag-transform-marker')
			.should('not.exist');
	}

	function exitChartEditing() {
		// Select cell on bottom
		cy.get('.spreadsheet-header-rows')
			.then(function(header) {
				var rect = header[0].getBoundingClientRect();
				var posX = rect.right + 10;
				var posY = rect.top + 2;

				var moveY = 0.0;
				cy.waitUntil(function() {
					cy.get('body')
						.click(posX, posY + moveY);

					moveY += 4.0;
					return cy.get('input#addressInput')
						.should('have.prop', 'value')
						.then(function(value) {
							return value === 'A2';
						});
				});
			});
	}

	function selectChartOnCenter() {
		cy.get('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var boundingRect = items[0].getBoundingClientRect();
				var XPos = (boundingRect.left + boundingRect.right) / 2;
				var YPos = (boundingRect.top + boundingRect.bottom) / 2;
				cy.get('body')
					.click(XPos, YPos);
			});

		cy.get('.leaflet-drag-transform-marker')
			.should('be.visible');
	}

	it('Change chart type.', function() {
		stepIntoChartEditing();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ChartTypePanel');

		helper.clickOnIdle('#cmb_chartType');

		helper.clickOnIdle('.ui-combobox-text', 'Pie');

		// TODO: this leads to crash?
		//mobileHelper.closeMobileWizard();

		exitChartEditing();

		selectChartOnCenter();

		cy.get('svg .OLE2 g g path')
			.should('have.length', 7);
	});
});
