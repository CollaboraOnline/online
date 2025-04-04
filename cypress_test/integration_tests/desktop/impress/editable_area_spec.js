/* global describe expect it cy beforeEach require */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var ceHelper = require('../../common/contenteditable_helper');

function selectTextShape(i) {
    cy.log('Selecting text shape - start.');
    if (typeof i !== 'number' || i <= 0 || i > 2)
        return;

    var n = 2;
    var parts = n + 1;

    // Click on the top-center of the slide to select the text shape there
    cy.cGet('#document-container')
        .then(function(items) {
            expect(items).to.have.length(1);
            var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
            var YPos = i * (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / parts;
            cy.cGet('body').click(XPos, YPos);
        });

    cy.cGet('[id^="test-div-shape-handle-"]').should('have.length', 9);
    cy.cGet('#document-container svg g path').should('exist');
    cy.log('Selecting text shape - end.');
}

describe(['taga11yenabled'], 'Editable area - Basic typing and caret moving - Shape 1', function() {

    beforeEach(function () {
        helper.setupAndLoadDocument('impress/two_text_shapes.odp');
        cy.cGet('#optionstoolboxdown .unoModifyPage').click();
        // do not cover shapes with sidebar
        cy.cGet('#sidebar-panel').should('not.be.visible');
        cy.cGet('div.clipboard').as('clipboard');

        // select top shape and activate editing
        selectTextShape(1);
        impressHelper.dblclickOnSelectedShape();
        // initial position
        ceHelper.checkHTMLContent('');
        ceHelper.checkCaretPosition(0);
        // typing
        ceHelper.type('Hello World');
        ceHelper.checkPlainContent('Hello World');
        ceHelper.checkCaretPosition(11);
   });

    it.skip('Editing top text shape', function () {
        // remove shape selection
        impressHelper.removeShapeSelection();
        ceHelper.checkHTMLContent('');
        // activate editing again
        selectTextShape(1);
        impressHelper.dblclickOnSelectedShape();
        ceHelper.checkPlainContent('Hello World');
        ceHelper.moveCaret('end');
        ceHelper.checkCaretPosition(11);
        impressHelper.removeShapeSelection();
    });

    it('Deleting text', function () {
        // backspace
        ceHelper.moveCaret('left', '', 4);
        ceHelper.type('{backspace}');
        ceHelper.checkPlainContent('Hello orld');
        ceHelper.checkCaretPosition(6);
        // delete
        ceHelper.moveCaret('left', '', 4);
        ceHelper.type('{del}');
        ceHelper.checkPlainContent('Helo orld');
        ceHelper.checkCaretPosition(2);
        impressHelper.removeShapeSelection();
    });
});

describe(['taga11yenabled'], 'Editable area - Basic typing and caret moving - Shape 2', function() {

    beforeEach(function () {
        helper.setupAndLoadDocument('impress/two_text_shapes.odp');
        cy.cGet('#optionstoolboxdown .unoModifyPage').click();
        // do not cover shapes with sidebar
        cy.cGet('#sidebar-panel').should('not.be.visible');
        cy.cGet('div.clipboard').as('clipboard');

        // select top shape and activate editing
        selectTextShape(2);
        impressHelper.dblclickOnSelectedShape();
        // initial position
        ceHelper.checkHTMLContent('');
        ceHelper.checkCaretPosition(0);
   });

    it.skip('Editing bottom text shape', function () {
        // typing
        ceHelper.type('Hello World');
        ceHelper.checkHTMLContent('Hello World');
        ceHelper.checkCaretPosition(11);
        impressHelper.removeShapeSelection();
        // activate editing again
        selectTextShape(2);
        impressHelper.dblclickOnSelectedShape();
        ceHelper.checkPlainContent('Hello World');
        ceHelper.moveCaret('end');
        ceHelper.checkCaretPosition(11);
        // typing paragraph 2
        ceHelper.type('{enter}');
        ceHelper.type('Green red');
        ceHelper.checkPlainContent('Green red');
        impressHelper.removeShapeSelection();
        // activate editing again
        selectTextShape(2);
        impressHelper.dblclickOnSelectedShape();
        // navigating between paragraphs
        ceHelper.checkPlainContent('Green red');
        ceHelper.moveCaret('up');
        ceHelper.checkPlainContent('Hello World');
        impressHelper.removeShapeSelection();
    });

    it.skip('Editing both text shapes', function () {
        // typing
        ceHelper.checkHTMLContent('');
        ceHelper.checkCaretPosition(0);
        ceHelper.type('Green red');
        ceHelper.checkPlainContent('Green red');
        ceHelper.checkCaretPosition(9);
        // select top shape and activate editing
        selectTextShape(1);
        ceHelper.checkHTMLContent('');
        impressHelper.dblclickOnSelectedShape();
        ceHelper.checkPlainContent('Hello World');
        ceHelper.moveCaret('end');
        ceHelper.type(' Yellow');
        ceHelper.checkPlainContent('Hello World Yellow');
        // select bottom shape and activate editing
        selectTextShape(2);
        ceHelper.checkHTMLContent('');
        impressHelper.dblclickOnSelectedShape();
        ceHelper.checkPlainContent('Green red');
        // remove shape selection
        impressHelper.removeShapeSelection();
        ceHelper.checkHTMLContent('');
    });

});
