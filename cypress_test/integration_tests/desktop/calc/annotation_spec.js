/* global describe it require afterEach beforeEach */
var helper = require('../../common/helper');
var { insertMultipleComment } = require('../../common/desktop_helper');

describe('Annotation Tests', function() {
	var origTestFileName = 'annotation.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert',function() {
		insertMultipleComment('calc');

		helper.cFrame().find('.cool-annotation').should('exist');
		helper.cFrame().find('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		helper.cFrame().find('#comment-container-1').trigger('mouseover');
		helper.cFrame().find('#annotation-content-area-1').should('contain','some text');
	});

	it('Modify',function() {
		insertMultipleComment('calc');

		helper.cFrame().find('#comment-container-1').should('exist');

		helper.cFrame().find('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		helper.cFrame().find('#comment-container-1').trigger('mouseover');
		helper.cFrame().find('#annotation-content-area-1').should('contain','some text');
		helper.cFrame().find('#comment-annotation-menu-1').click();
		helper.cFrame().find('body').contains('.context-menu-item','Modify').click();
		helper.cFrame().find('#annotation-modify-textarea-1').type('some other text, ');
		helper.cFrame().find('#annotation-save-1').click();
		helper.cFrame().find('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		helper.cFrame().find('#annotation-content-area-1').trigger('mouseover');
		helper.cFrame().find('#annotation-content-area-1').should('contain','some other text, some text');
		helper.cFrame().find('#comment-container-1').should('exist');
	});

	it('Reply should not be possible', function() {
		insertMultipleComment('calc');

		helper.cFrame().find('#comment-container-1').should('exist');

		helper.cFrame().find('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		helper.cFrame().find('#comment-container-1').trigger('mouseover');
		helper.cFrame().find('#annotation-content-area-1').should('contain','some text');
		helper.cFrame().find('#comment-annotation-menu-1').click();
		helper.cFrame().find('.context-menu-list:visible .context-menu-item').should('not.have.text', 'Reply');
	});

	it('Remove',function() {
		insertMultipleComment('calc');

		helper.cFrame().find('#comment-container-1').should('exist');

		helper.cFrame().find('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		helper.cFrame().find('#comment-container-1').trigger('mouseover');
		helper.cFrame().find('#annotation-content-area-1').should('contain','some text');
		helper.cFrame().find('#comment-annotation-menu-1').click();
		helper.cFrame().find('body').contains('.context-menu-item','Remove').click();
		helper.cFrame().find('#comment-container-1').should('not.exist');
	});
});
