/* global describe it Cypress cy require afterEach beforeEach */

var helper = require('../../common/helper');
var { insertMultipleComment, hideSidebar, selectZoomLevel } = require('../../common/desktop_helper');

describe('Annotation Tests', function() {
	var origTestFileName = 'annotation.odt';
	var testFileName;

	beforeEach(function() {
		cy.viewport(1400, 600);
		cy.log('could reach 1');
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		cy.log('could reach 2');
		var mode = Cypress.env('USER_INTERFACE');
		if (mode === 'notebookbar') {
			helper.cFrame().get('.unospan-optionstoolboxdown.unoSidebar').should('have.class', 'selected');
			helper.cFrame().get('.unospan-optionstoolboxdown.unoSidebar').click();
			helper.cFrame().get('.unospan-optionstoolboxdown.unoSidebar').should('not.have.class', 'selected');
		} else {
			hideSidebar();
		}
		selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert',function() {
		insertMultipleComment('writer');

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('#annotation-content-area-1').should('contain','some text0');
	});

	it('Modify',function() {
		insertMultipleComment('writer');

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('#annotation-content-area-1').should('contain','some text0');

		helper.cFrame().find('#comment-annotation-menu-1').click();

		helper.cFrame().contains('.context-menu-item','Modify').click();

		helper.cFrame().find('#annotation-modify-textarea-1').type('some other text, ');

		helper.cFrame().find('#annotation-save-1').click();

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('#annotation-content-area-1').should('contain','some other text, some text0');
	});

	it('Reply',function() {
		insertMultipleComment('writer');

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('#annotation-content-area-1').should('contain','some text');

		helper.cFrame().find('#comment-annotation-menu-1').click();

		helper.cFrame().contains('.context-menu-item','Reply').click();

		helper.cFrame().find('#annotation-reply-textarea-1').type('some reply text');

		helper.cFrame().find('#annotation-reply-1').click();

		helper.cFrame().find('#annotation-content-area-2').should('contain','some reply text');
	});

	it('Remove',function() {
		insertMultipleComment('writer');

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('.cool-annotation-content > div').should('contain','some text');

		helper.cFrame().find('.cool-annotation-menu').click();

		helper.cFrame().contains('.context-menu-item','Remove').click();

		helper.cFrame().find('.cool-annotation-content-wrapper').should('not.exist');
	});

});

describe('Collapsed Annotation Tests', function() {
	var testFileName = 'annotation.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert',function() {
		insertMultipleComment('writer', 1, false);

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('#annotation-content-area-1').should('contain','some text0');
	});

	it('Modify',function() {
		insertMultipleComment('writer', 1, false);

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('#annotation-content-area-1').should('contain','some text0');

		helper.cFrame().find('.cool-annotation-img').click();

		helper.cFrame().find('#comment-annotation-menu-1').click();

		helper.cFrame().contains('.context-menu-item','Modify').click();

		helper.cFrame().find('#annotation-modify-textarea-1').type('some other text, ');

		helper.cFrame().find('#annotation-save-1').click();

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('#annotation-content-area-1').should('contain','some other text, some text0');
	});

	it('Reply',function() {
		insertMultipleComment('writer', 1, false);

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('#annotation-content-area-1').should('contain','some text');

		helper.cFrame().find('.cool-annotation-img').click();

		helper.cFrame().find('#comment-annotation-menu-1').click();

		helper.cFrame().contains('.context-menu-item','Reply').click();

		helper.cFrame().find('#annotation-reply-textarea-1').type('some reply text');

		helper.cFrame().find('#annotation-reply-1').click();

		helper.cFrame().find('#annotation-content-area-2').should('contain','some reply text');
	});

	it('Remove',function() {
		insertMultipleComment('writer', 1, false);

		helper.cFrame().find('.cool-annotation-content-wrapper').should('exist');

		helper.cFrame().find('.cool-annotation-content > div').should('contain','some text');

		helper.cFrame().find('.cool-annotation-img').click();

		helper.cFrame().find('.cool-annotation-menu').click();

		helper.cFrame().contains('.context-menu-item','Remove').click();

		helper.cFrame().find('.cool-annotation-content-wrapper').should('not.exist');
	});

});
