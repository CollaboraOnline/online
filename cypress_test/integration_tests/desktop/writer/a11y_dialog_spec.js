/* global describe expect it cy before after afterEach require Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var a11yHelper = require('../../common/a11y_helper');

const allWriterDialogs = [
    '.uno:ChapterNumberingDialog',
    '.uno:EditRegion',
    '.uno:EditStyle?Param:string=Example&Family:short=1',
    '.uno:EditStyle?Param:string=Heading&Family:short=2',
    { command: '.uno:ExportToEPUB', args: { SynchronMode: { type: 'boolean', value: false } } },
    '.uno:FieldDialog',
    '.uno:FontDialog',
    '.uno:FootnoteDialog',
    '.uno:FormatColumns',
    '.uno:InsertBreak',
    '.uno:InsertBookmark',
    '.uno:InsertCaptionDialog',
    '.uno:InsertFieldCtrl',
    '.uno:InsertFrame',
    '.uno:InsertIndexesEntry',
    '.uno:InsertMultiIndex',
    '.uno:InsertSection',
    '.uno:LineNumberingDialog',
    '.uno:OutlineBullet',
    '.uno:PageDialog',
    '.uno:PageNumberWizard',
    '.uno:ParagraphDialog',
    '.uno:SplitTable',
    '.uno:TableDialog',
    '.uno:TableNumberFormatDialog',
    '.uno:TableSort',
    '.uno:TitlePageDialog',
    '.uno:Translate',
    '.uno:Watermark',
    '.uno:WordCountDialog'
];

// 'common' dialogs that writer specifically does not support
const excludedCommonDialogs = [
    '.uno:SpellDialog'
];

describe(['tagdesktop'], 'Accessibility Writer Dialog Tests', { testIsolation: false }, function () {
    let win;
    let hasLinguisticData = false;

    before(function () {
        helper.setupAndLoadDocument('writer/help_dialog.odt', /*isMultiUser=*/false, /*copyCertificates=*/true);

        // to make insertImage use the correct buttons
        desktopHelper.switchUIToNotebookbar();

        helper.setDummyClipboardForCopy();

        cy.getFrameWindow().then(function (frameWindow) {
            win = frameWindow;
            a11yHelper.enableUICoverage(win);
        });

        cy.cGet('.jsdialog-window').should('not.exist');

        cy.then(() => {
            return helper.processToIdle(win);
        }).then(() => {
            const thesaurusState = win.app.map.stateChangeHandler.getItemValue('.uno:ThesaurusDialog');
            hasLinguisticData = (thesaurusState === 'enabled');
        });
    });

    after(function () {
        a11yHelper.reportUICoverage(win, hasLinguisticData);

        cy.get('@uicoverageResult').then(result => {
            expect(result.used, `used .ui files`).to.not.be.empty;
            // TODO: make these true
            // expect(result.CompleteWriterDialogCoverage, `complete writer dialog coverage`).to.be.true;
            // expect(result.CompleteCommonDialogCoverage, `complete common dialog coverage`).to.be.true;
        });
    });

    afterEach(function () {
        // Close any dialogs that might still be open after a test failure
        cy.cGet('body').then($body => {
            const dialogs = $body.find('.jsdialog-window .ui-dialog-titlebar-close');
            if (dialogs.length > 0) {
                // Close dialogs from innermost to outermost
                for (let i = dialogs.length - 1; i >= 0; i--) {
                    cy.wrap(dialogs[i]).click({ force: true });
                }
            }
        });
        cy.cGet('.jsdialog-window:not(.ui-overflow-group-popup)').should('not.exist');

        a11yHelper.resetState();
    });

    // Helper to test that a11y validation detects injected errors
    function testA11yErrorDetection(injectBadElement) {
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:FontDialog');
        });

        a11yHelper.getActiveDialog(1)
            .then(() => helper.processToIdle(win))
            .then(() => {
                a11yHelper.getActiveDialog(1).then($dialog => {
                    injectBadElement($dialog, win);
                });
            })
            .then(() => {
                // Validation should detect an error
                var spy = Cypress.sinon.spy(win.console, 'error');
                win.app.dispatcher.dispatch('validatedialogsa11y');

                cy.then(() => {
                    const a11yErrors = spy.getCalls().filter(call =>
                        String(call.args[0]).includes(win.app.A11yValidatorException.PREFIX)
                    );
                    expect(a11yErrors.length, 'Should detect a11y error').to.be.greaterThan(0);
                    spy.restore();
                });
            })
            .then(() => {
                a11yHelper.closeActiveDialog(1);
            });
    }

    function escLevel(win, count) {
            for (var i = 0; i < count; i++) {
                    helper.typeIntoDocument('{esc}');
                    helper.processToIdle(win);
            }
    }

    it('Detects non-native button element error', function () {
        testA11yErrorDetection(function($dialog, win) {
            // Inject a span with role="button" instead of native <button>
            const badElement = win.document.createElement('span');
            badElement.setAttribute('role', 'button');
            badElement.setAttribute('id', 'something');
            badElement.textContent = 'Bad Button';
            $dialog.find('.ui-dialog-content')[0].appendChild(badElement);
        });
    });

    it('Detects image missing alt attribute', function () {
        testA11yErrorDetection(function($dialog, win) {
            // Inject an image without alt attribute
            const container = win.document.createElement('div');
            container.setAttribute('id', 'something');
            const img = win.document.createElement('img');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            // No alt attribute set
            container.appendChild(img);
            $dialog.find('.ui-dialog-content')[0].appendChild(container);
        });
    });

    it('Detects image with empty alt but parent lacks label', function () {
        testA11yErrorDetection(function($dialog, win) {
            // Inject an image with empty alt="" but parent has no label
            const container = win.document.createElement('div');
            container.setAttribute('id', 'something');
            container.id = 'test-unlabeled-parent';
            // No aria-label, aria-labelledby, or associated label element
            const img = win.document.createElement('img');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            img.setAttribute('alt', '');
            container.appendChild(img);
            $dialog.find('.ui-dialog-content')[0].appendChild(container);
        });
    });

    it('Detects image with non-empty alt when parent also has label', function () {
        testA11yErrorDetection(function($dialog, win) {
            // Inject an image with non-empty alt AND parent has aria-label (duplicate)
            const container = win.document.createElement('div');
            container.setAttribute('id', 'something');
            container.setAttribute('aria-label', 'Parent Label');
            const img = win.document.createElement('img');
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            img.setAttribute('alt', 'Image description');
            container.appendChild(img);
            $dialog.find('.ui-dialog-content')[0].appendChild(container);
        });
    });

    a11yHelper.allCommonDialogs.forEach(function (commandSpec) {
        const command = typeof commandSpec === 'string' ? commandSpec : commandSpec.command;
        if (excludedCommonDialogs.includes(command)) {
            // silently skip the common dialogs that writer doesn't have
            return;
        } else {
            it.skip(`Common Dialog ${command}`, function () {
                if (!hasLinguisticData && a11yHelper.needsLinguisticData(command)) {
                    this._runnable.title += ' (skipped: missing linguistic data)';
                    this.skip();
                }
                a11yHelper.testDialog(win, commandSpec);
            });
        }
    });

    it.skip('Transform dialog', function () {
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:BasicShapes.octagon');
        });

        cy.cGet('#test-div-shapeHandlesSection').should('exist');

        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:TransformDialog');
        });
        a11yHelper.handleDialog(win, 1);

        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:FormatArea');
        });
        a11yHelper.handleDialog(win, 1);

        // exit shape mode
        helper.typeIntoDocument('{esc}');
    });

    it.skip('Line dialog', function () {
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:Line');
        });

        cy.cGet('#test-div-shapeHandlesSection').should('exist');

        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:FormatLine');
        });
        a11yHelper.handleDialog(win, 1);
        // exit line mode
        helper.typeIntoDocument('{esc}');
    });

    it('PasteSpecial Dialog', function () {
        // Select some text
        helper.selectAllText();

        helper.copy().then(() => {
            return helper.processToIdle(win);
        })
        .then(() => {
            win.app.map.sendUnoCommand('.uno:PasteSpecial');
        });
        a11yHelper.handleDialog(win, 1);
    });

    allWriterDialogs.forEach(function (commandSpec) {
        const command = typeof commandSpec === 'string' ? commandSpec : commandSpec.command;
        it.skip(`Writer Dialog ${command}`, function () {
            a11yHelper.testDialog(win, commandSpec);
        });
    });

    it('DropdownField dialog', function () {
        helper.getBlinkingCursorPosition('P');
        helper.clickAt('P');
        a11yHelper.handleDialog(win, 1);
    });

    it('ContentControlProperties dialog', function () {
        // triple select to include table, then delete all
        helper.typeIntoDocument('{ctrl}a');
        helper.typeIntoDocument('{ctrl}a');
        helper.typeIntoDocument('{ctrl}a');
        helper.textSelectionShouldExist();
        helper.typeIntoDocument('{del}');
        helper.textSelectionShouldNotExist();

        // ContentControlProperties dialog
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:InsertDropdownContentControl');
            win.app.map.sendUnoCommand('.uno:ContentControlProperties');
        });
        a11yHelper.handleDialog(win, 1, '.uno:ContentControlProperties');
    });

    it.skip('Object dialog', function () {
        helper.clearAllText({ isTable: true });
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:InsertObjectChart');
        });
        cy.cGet('#test-div-shapeHandlesSection').should('exist');

        // Two esc get us out of the chart navigation and then chart edit mode
        escLevel(win, 2);
        helper.processToIdle(win);

        // At which point the sidebar disappears, and just the shape is selected
        cy.cGet('#sidebar-dock-wrapper').should('not.be.visible');

        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:FrameDialog');
        });
        a11yHelper.handleDialog(win, 1, '.uno:FrameDialog');
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:NameGroup');
        });
        a11yHelper.handleDialog(win, 1, '.uno:NameGroup');
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:ObjectTitleDescription');
        });
        a11yHelper.handleDialog(win, 1, '.uno:ObjectTitleDescription');

        // esc to get back to main document
        escLevel(win, 1);
        helper.processToIdle(win);

        // sidebar starts again, and grabs focus to itself
        cy.cGet('#sidebar-dock-wrapper').should('be.visible').then(function(sidebar) {
                helper.waitForTimers(win, 'sidebarstealfocus');
                helper.waitUntilLayoutingIsIdle(win);
                helper.containsFocusElement(sidebar[0], true);
       });

       // esc to send focus back to main document
       escLevel(win, 1);
       helper.processToIdle(win);

       // focus stays here after that
       cy.cGet('div.clipboard').should('have.focus');
    });

    it.skip('Graphic dialog', function () {
        helper.clearAllText();
        desktopHelper.insertImage();
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:GraphicDialog');
        });
        a11yHelper.handleDialog(win, 1, '.uno:GraphicDialog');
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:CompressGraphic');
        });
        a11yHelper.handleDialog(win, 1, '.uno:GraphicDialog');
    });

    it('Rename bookmark', function () {
        helper.clearAllText();

        helper.typeIntoDocument('bookmark');
        helper.selectAllText();
        cy.then(() => {
            // insert a bookmark first
            win.app.map.sendUnoCommand('.uno:InsertBookmark?Bookmark:string=bookmark');
            // edit bookmark
            win.app.map.sendUnoCommand('.uno:InsertBookmark');
        });
        a11yHelper.getActiveDialog(1).should('exist')
            .then(() => {
            cy.cGet('#bookmarks .ui-treeview-entry > div:first-child').click();
            cy.cGet('#rename-button').should('be.enabled').click();
            a11yHelper.handleDialog(win, 2);
            a11yHelper.closeActiveDialog(1);
        });
    });

    it.skip('PDF export warning dialog', function () {
        a11yHelper.testPDFExportWarningDialog(win);
    });

    it.skip('ReadOnly info dialog', function () {
        // Text ReadOnly info dialog
        helper.clearAllText({ isTable: true });
        helper.typeIntoDocument('READONLY');
        helper.selectAllText();
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:InsertSection?RegionProtect:bool=true');
        });
        helper.typeIntoDocument('{del}');
        a11yHelper.handleDialog(win, 1);
    });

});
