/* global describe it cy beforeEach require expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Chart tests.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/chart.ods');
		mobileHelper.enableEditingMobile();
		calcHelper.selectFirstColumn();
		insertChart();
	});

	function insertChart() {
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Chart...').click();
		cy.cGet('.leaflet-drag-transform-marker').should('have.length', 32);
		cy.cGet('svg .OLE2').should('exist');
		cy.cGet('svg .OLE2 g g path').should('have.length', 40);
	}

	function stepIntoChartEditing() {
		cy.cGet('.leaflet-drag-transform-marker').should('exist');

		// Double click onto the chart shape
		cy.cGet('svg g svg')
			.then(function(items) {
				expect(items).to.have.length(1);
				var boundingRect = items[0].getBoundingClientRect();
				var XPos = boundingRect.left + 10;
				var YPos = (boundingRect.top + boundingRect.bottom) / 2;

				cy.cGet('body').dblclick(XPos, YPos);
			});

		cy.cGet('.leaflet-drag-transform-marker').should('not.exist');
	}

	function exitChartEditing() {
		calcHelper.typeIntoFormulabar('{enter}');
	}

	function selectChartOnCenter() {
		cy.cGet('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var boundingRect = items[0].getBoundingClientRect();
				var XPos = (boundingRect.left + boundingRect.right) / 2;
				var YPos = (boundingRect.top + boundingRect.bottom) / 2;
				cy.cGet('body').click(XPos, YPos);
			});

		cy.cGet('.leaflet-drag-transform-marker').should('be.visible');
	}

	it.skip('Change chart type.', function() {
		stepIntoChartEditing();
		mobileHelper.openMobileWizard();
		cy.cGet('#ChartTypePanel').click();
		cy.cGet('#cmb_chartType').click();
		cy.cGet('.ui-combobox-text', 'Pie').click();

		// TODO: this leads to crash?
		//mobileHelper.closeMobileWizard();

		exitChartEditing();
		selectChartOnCenter();
		cy.cGet('svg .OLE2 g g path').should('have.length', 7);
	});
});
