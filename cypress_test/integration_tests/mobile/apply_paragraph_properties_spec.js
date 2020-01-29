/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../common/helper');

describe('Apply paragraph properties.', function() {
	beforeEach(function() {
		helper.loadTestDoc('simple.odt', true);

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();
	});

	afterEach(function() {
		cy.get('.closemobile').click();
		cy.wait(200); // wait some time to actually release the document
	});

	function generateTextHTML() {
		// Do a new selection
		cy.get('#document-container').click();
		cy.get('.leaflet-marker-icon')
			.should('not.exist');

		cy.wait(200);

		cy.get('body').type('{shift}{home}');
		cy.get('.leaflet-marker-icon');

		cy.wait(200);

		// Open context menu
		cy.get('.leaflet-marker-icon')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(2);
				var XPos = (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
				var YPos = marker[0].getBoundingClientRect().top - 5;
				cy.get('body').rightclick(XPos, YPos);
			});

		// Execute copy
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon .context-menu-link')
			.contains('Copy')
			.click();

		// Close warning about clipboard operations
		cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
			.click();
	}

	it('Apply left alignment.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Change alignment
		cy.get('#CenterPara')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');

		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Open paragraph properties
		cy.get('#Paragraph')
			.click();

		// Change alignment
		cy.get('#LeftPara')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'left');
	});

	it('Apply center alignment.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Change alignment
		cy.get('#CenterPara')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'center');
	});

	it('Apply right alignment.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Change alignment
		cy.get('#RightPara')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'right');
	});

	it('Apply justify alignment.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Change alignment
		cy.get('#JustifyPara')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'align', 'justify');
	});

	it('Change writing direction.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Change writing mode
		cy.get('#ParaRightToLeft')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.should('have.attr', 'dir', 'rtl');

		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

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

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.should('not.have.attr', 'dir');
	});

	it('Apply default bulleting.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		cy.get('#DefaultBullet')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container ul li p')
			.should('exist');
	});

	it('Apply default numbering.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		cy.get('#DefaultNumbering')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container ol li p')
			.should('exist');
	});

	it('Apply background color.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Change background color
		cy.get('#BackgroundColor')
			.click();

		cy.get('#color-picker-2-basic-color-5')
			.click();

		cy.get('#color-picker-2-tint-3')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['background']).to.be.equal('rgb(0, 255, 0)');
			});
	});

	it('Increase / decrease para spacing.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Increase para spacing
		cy.get('#ParaspaceIncrease')
			.click();
		cy.get('#ParaspaceIncrease')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-top']).to.be.equal('0.08in');
				expect(item[0].style['margin-bottom']).to.be.equal('0.08in');
			});

		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

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

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-top']).to.be.equal('0.04in');
				expect(item[0].style['margin-bottom']).to.be.equal('0.04in');
			});
	});

	it('Change para spacing via combobox.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Check para spacing current value
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.0');
		cy.get('#belowparaspacing .spinfield')
			.should('have.attr', 'value', '0.0');

		// Change spacing
		cy.get('#aboveparaspacing .sinfieldcontrols .plus')
			.click();
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#aboveparaspacing .sinfieldcontrols .plus')
			.click();
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.04');
		cy.get('#aboveparaspacing .sinfieldcontrols .plus')
			.click();
		cy.get('#aboveparaspacing .spinfield')
			.should('have.attr', 'value', '0.06');

		cy.get('#belowparaspacing .sinfieldcontrols .plus')
			.click();
		cy.get('#belowparaspacing .spinfield')
			.should('have.attr', 'value', '0.02');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-top']).to.be.equal('0.06in');
				expect(item[0].style['margin-bottom']).to.be.equal('0.02in');
			});
	});

	it('Increase / decrease indent.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Increase indent
		cy.get('#IncrementIndent')
			.click();
		cy.get('#IncrementIndent')
			.click();

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-left']).to.be.equal('0.98in');
			});

		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

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

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-left']).to.be.equal('0.49in');
			});
	});

	it('Apply before text indent.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Change indent
		cy.get('#beforetextindent .sinfieldcontrols .plus')
			.click();
		cy.get('#beforetextindent .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#beforetextindent .sinfieldcontrols .plus')
			.click();
		cy.get('#beforetextindent .spinfield')
			.should('have.attr', 'value', '0.04');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-left']).to.be.equal('0.04in');
			});
	});

	it('Apply after text indent.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Change indent
		cy.get('#aftertextindent .sinfieldcontrols .plus')
			.click();
		cy.get('#aftertextindent .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#aftertextindent .sinfieldcontrols .plus')
			.click();
		cy.get('#aftertextindent .spinfield')
			.should('have.attr', 'value', '0.04');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['margin-right']).to.be.equal('0.04in');
			});
	});

	it('Apply first line indent.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Increase firstline indent
		cy.get('#firstlineindent .sinfieldcontrols .plus')
			.click();
		cy.get('#firstlineindent .spinfield')
			.should('have.attr', 'value', '0.02');
		cy.get('#firstlineindent .sinfieldcontrols .plus')
			.click();
		cy.get('#firstlineindent .spinfield')
			.should('have.attr', 'value', '0.04');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].style['text-indent']).to.be.equal('0.04in');
			});
	});
});
