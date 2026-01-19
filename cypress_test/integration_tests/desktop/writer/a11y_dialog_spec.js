/* global describe expect it cy before after afterEach require Cypress */

var helper = require('../../common/helper');
var ceHelper = require('../../common/contenteditable_helper');
var desktopHelper = require('../../common/desktop_helper');

const allCommonDialogs = [
    '.uno:HyperlinkDialog',
    '.uno:InsertQrCode',
    '.uno:InsertSymbol',
    '.uno:SearchDialog?InitialFocusReplace:bool=true',
    '.uno:SearchDialog',
    '.uno:SetDocumentProperties',
    '.uno:SpellingAndGrammarDialog',
    '.uno:SplitCell',
    '.uno:StyleNewByExample',
    '.uno:ThesaurusDialog',
    '.uno:WidgetTestDialog'
];

const allWriterDialogs = [
    '.uno:ChapterNumberingDialog',
    '.uno:EditRegion',
    '.uno:EditStyle?Param:string=Example&Family:short=1',
    '.uno:EditStyle?Param:string=Heading&Family:short=2',
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
    '.uno:ThemeDialog',
    '.uno:TitlePageDialog',
    '.uno:Translate',
    '.uno:Watermark',
    '.uno:WordCountDialog'
];

// these need a specific context
const missingContextDialogs = [
    '.uno:ContourDialog',
    '.uno:SpellingAndGrammarDialog',
    '.uno:ThesaurusDialog',
];

// don't pass yet
const buggyDialogs = [
    '.uno:InsertFrame',
    '.uno:OutlineBullet',
];

describe(['tagdesktop'], 'Accessibility Writer Tests', { testIsolation: false }, function () {
    let win;

    before(function () {
        helper.setupAndLoadDocument('writer/help_dialog.odt');

        // to make insertImage use the correct buttons
        desktopHelper.switchUIToNotebookbar();

        cy.getFrameWindow().then(function (frameWindow) {
            win = frameWindow;

            const enableUICoverage = {
                'Track': { 'type': 'boolean', 'value': true }
            };
            win.app.map.sendUnoCommand('.uno:UICoverage', enableUICoverage);
        });

        cy.cGet('.jsdialog-window').should('not.exist');
    });

    after(function () {
        cy.spy(win.app.socket, '_onMessage').as('onMessage').log(false);

        // Run after the dialogs are processed and errors checked
        cy.then(() => {
            const endUICoverage = {
                'Report': { 'type': 'boolean', 'value': true },
                'Track': { 'type': 'boolean', 'value': false }
            };
            win.app.map.sendUnoCommand('.uno:UICoverage', endUICoverage);
        });

        cy.get('@onMessage').should(onMessage => {
            const matchingCall = onMessage.getCalls().find(call => {
                const evt = call.args && call.args[0]
                const textMsg = evt && evt.textMsg;
                if (!textMsg || !textMsg.startsWith('unocommandresult:')) {
                    return false;
                }
                const jsonPart = textMsg.replace('unocommandresult:', '').trim();
                const data = JSON.parse(jsonPart);
                return data.commandName === '.uno:UICoverage';
            });

            expect(matchingCall, '.uno:UICoverage result').to.be.an('object');

            const textMsg = matchingCall.args[0].textMsg;
            const jsonPart = textMsg.replace('unocommandresult:', '').trim();
            const result = JSON.parse(jsonPart).result;

            Cypress.log({name: 'UICoverage Message: ', message: JSON.stringify(result)});

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
        desktopHelper.undoAll();
        cy.cGet('div.clipboard').as('clipboard');
        // double click on field at initial cursor position
        ceHelper.moveCaret('home', 'ctrl');
    });

    // Helper to test that a11y validation detects injected errors
    function testA11yErrorDetection(injectBadElement) {
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:FontDialog');
        });

        getActiveDialog(1)
            .then(() => helper.processToIdle(win))
            .then(() => {
                getActiveDialog(1).then($dialog => {
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
                closeActiveDialog(1);
            });
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

    allCommonDialogs.forEach(function (command) {
        it(`Common Dialog ${command}`, function () {
            testDialog(command);
        });
    });

    it('Transform dialog', function () {
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:BasicShapes.octagon');
        });

        cy.cGet('#test-div-shapeHandlesSection').should('exist');

        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:TransformDialog');
        });
        handleDialog(win, 1);
        // exit shape mode
        helper.typeIntoDocument('{esc}');
    });

    allWriterDialogs.forEach(function (command) {
        if (missingContextDialogs.includes(command)) {
            it.skip(`Dialog ${command} (missing context)`, function () {});
        } else if (buggyDialogs.includes(command)) {
            it.skip(`Dialog ${command} (buggy)`, function () {});
        } else {
            it(`Writer Dialog ${command}`, function () {
                testDialog(command);
            });
        }
    });

    it('DropdownField dialog', function () {
        helper.getBlinkingCursorPosition('P');
        helper.clickAt('P');
        handleDialog(win, 1);
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
        handleDialog(win, 1, '.uno:ContentControlProperties');
    });

    it.skip('Object dialog', function () {
       helper.clearAllText({ isTable: true });
       cy.then(() => {
           win.app.map.sendUnoCommand('.uno:InsertObjectChart');
       });
       cy.cGet('#test-div-shapeHandlesSection').should('exist');
       cy.then(() => {
           win.app.map.sendUnoCommand('.uno:FrameDialog');
       });
       handleDialog(win, 1, '.uno:FrameDialog');
       cy.then(() => {
           win.app.map.sendUnoCommand('.uno:NameGroup');
       });
       handleDialog(win, 1, '.uno:NameGroup');
       cy.then(() => {
           win.app.map.sendUnoCommand('.uno:ObjectTitleDescription');
       });
       handleDialog(win, 1, '.uno:ObjectTitleDescription');
    });

    it.skip('Graphic dialog', function () {
        helper.clearAllText();
        desktopHelper.insertImage();
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:GraphicDialog');
        });
        handleDialog(win, 1, '.uno:GraphicDialog');
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
        getActiveDialog(1).should('exist')
            .then(() => {
            cy.cGet('#bookmarks .ui-treeview-entry > div:first-child').click();
            cy.cGet('#rename-button').should('be.enabled').click();
            handleDialog(win, 2);
            closeActiveDialog(1);
        });
    });

    it('ReadOnly info dialog', function () {
        // Text ReadOnly info dialog
        helper.clearAllText({ isTable: true });
        helper.typeIntoDocument('READONLY');
        helper.selectAllText();
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:InsertSection?RegionProtect:bool=true');
        });
        helper.typeIntoDocument('{del}');
        handleDialog(win, 1);
    });

    function checkA11yErrors(win, spy) {
        cy.then(() => {
            const a11yValidatorExceptionText = win.app.A11yValidatorException.PREFIX;
            const a11yErrors = spy.getCalls().filter(call =>
                String(call.args[0]).includes(a11yValidatorExceptionText)
            );

            if (a11yErrors.length > 0) {
                const errorMessages = a11yErrors.map(call =>
                    call.args.map(arg => String(arg)).join(' ')
                ).join('\n\n');

                throw new Error(`Found A11y errors:\n${errorMessages}`);
            }
        });
    }

    function testDialog(command) {
        cy.then(() => {
            win.app.map.sendUnoCommand(command);
        });

        handleDialog(win, 1, command);
    }

    function runA11yValidation(win) {
        cy.then(() => {
            var spy = Cypress.sinon.spy(win.console, 'error');
            win.app.dispatcher.dispatch('validatedialogsa11y');

            checkA11yErrors(win, spy);

            if (spy && spy.restore) {
                spy.restore();
            }
        });
    }

    function handleDialog(win, level, command) {
        getActiveDialog(level)
            .then(() => {
               return helper.processToIdle(win);
            })
            .then(() => {
                runA11yValidation(win);
            })
            .then(() => {
                // Open 'options' subdialogs
                if (command == '.uno:EditRegion' ||
                    command == '.uno:InsertCaptionDialog') {
                    cy.cGet('#options-button').click();
                    handleDialog(win, level + 1);
                } else if (command == '.uno:InsertIndexesEntry') {
                    cy.cGet('#new-button').click();
                    handleDialog(win, level + 1);
                } else if (command == '.uno:ContentControlProperties') {
                    cy.cGet('#add-button').click();
                    handleDialog(win, level + 1);
                } else if (command == '.uno:SearchDialog') {
                    cy.cGet('.ui-expander-label').contains('Other options').should('be.visible').click();
                    cy.cGet('#similarity-input').check();
                    cy.cGet('#similaritybtn-button').should('be.enabled').click();
                    handleDialog(win, level + 1);
		}

                handleTabsInDialog(win, level, command);
                closeActiveDialog(level);
            });
    }

    function getActiveDialog(level) {
        return cy.cGet('.ui-dialog[role="dialog"]')
            .should('have.length', level)
            .then($dialogs => cy.wrap($dialogs.last()))
    }

    function handleTabsInDialog(win, level, command) {
        traverseTabs(() => getActiveDialog(level), win, level, command);
    }

    function traverseTabs(getContainer, win, level, command, isNested = false) {
        const TABLIST = '[role="tablist"]';
        const TAB = '[role="tab"]';

        return getContainer().then($container => {
            let $tabLists;

            if (!isNested) {
                // For top-level tabs, select only direct tab lists under #tabcontrol
                // to avoid picking up tab lists from nested tab-panels
                $tabLists = $container.find('#tabcontrol > ' + TABLIST);
            } else {
                // For nested tabs, the container is already the relevant tab-panel,
                // so select all tab lists within it
                $tabLists = $container.find(TABLIST);
            }

            if (!$tabLists.length) return;

            return Cypress._.reduce($tabLists, (chain, tabListEl, tabListIndex) => {
                return chain.then(() => {
                    const $tabs = Cypress.$(tabListEl).find(TAB);

                    const clickTabByIndex = (index) => {
                        if (index >= $tabs.length) return cy.wrap(null);

                        const $tab = $tabs.eq(index);
                        const tabId = $tab.attr('id');
                        const tabAriaControls = $tab.attr('aria-controls');

                        return getContainer()
                            .find(TABLIST).eq(tabListIndex)
                            .find(TAB).eq(index)
                            .click({ force: true })
                            .then(() => {
                                return helper.processToIdle(win);
                            })
                            .then(() => {
                                runA11yValidation(win);
                            })
                            .then(() => {
                                if (command == '.uno:SetDocumentProperties' && tabAriaControls == 'customprops')  {
                                    cy.cGet('#durationbutton-button').click();
                                    handleDialog(win, level + 1);
                                } else if (command == '.uno:InsertSection' && tabAriaControls == 'section')  {
                                    // check protect to enable password dialog
                                    cy.cGet('#protect-input').check();
                                    cy.cGet('#selectpassword-button').should('not.be.disabled').click();
                                    handleDialog(win, level + 1);
                                    cy.cGet('#protect-input').uncheck();
                                    cy.cGet('#selectpassword-button').should('be.disabled');
                                } else if (command == '.uno:HyperlinkDialog' && tabAriaControls == '~Document')  {
                                    cy.cGet('#browse-button').click();
                                    handleDialog(win, level + 1);
                                }
                            })
                            .then(() => {
                                return getContainer();
                            })
                            .then($ctx => {
                                const $panel = getActiveTabPanel($ctx, tabId);

                                if (!$panel || !$panel.length) return;

                                const panelId = $panel.attr('id');
                                const panelSelector = `#${CSS.escape(panelId)}`;

                                return getContainer()
                                    .then(() => {
                                        const $nestedTablists = $panel.find(TABLIST);

                                        if (!isNested && $nestedTablists.length > 0) {
                                            return traverseTabs(
                                                () => getContainer().find(panelSelector),
                                                win, level, command, true
                                            );
                                        }
                                    });
                            })
                            .then(() => {
                                return clickTabByIndex(index + 1);
                            });
                    };

                    return clickTabByIndex(0);
                });
            }, cy.wrap(null));
        });
    }

    function getActiveTabPanel($container, activeTabId) {
        const tabSelector = `#${CSS.escape(activeTabId)}`;
        const $activeTab = $container.find(tabSelector);

        if (!$activeTab.length) return null;

        const panelId = $activeTab.attr('aria-controls');
        if (!panelId) return null;

        const panelSelector = `#${CSS.escape(panelId)}[role="tabpanel"]`;
        return $container.find(panelSelector);
    }

    function closeActiveDialog(level) {
        // Closing the dialog via the titlebar directly can be fragile.
        // So find the jsdialog ancestor, because it has a unique id,
        // and use that id to make a selector and  a get via that is
        // retryable by cypress.
        getActiveDialog(level)
            .parents('.jsdialog-window')
            .invoke('attr', 'id')
            .then(dialogId => {
              cy.cGet(`#${CSS.escape(dialogId)} .ui-dialog-titlebar-close`)
                .click();
            });

        cy.cGet('.ui-dialog[role="dialog"]').should('have.length', level - 1);
    }

});
