/* global describe expect it cy before after afterEach require Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var a11yHelper = require('../../common/a11y_helper');

const allCommonDialogs = [
    '.uno:AcceptTrackedChanges',
    '.uno:HyperlinkDialog',
    '.uno:InsertQrCode',
    '.uno:InsertSymbol',
    '.uno:RunMacro',
    '.uno:SearchDialog',
    '.uno:SetDocumentProperties',
    '.uno:Signature',
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

const needLinguisticDataDialogs = [
    '.uno:SpellingAndGrammarDialog',
    '.uno:ThesaurusDialog',
];

// these need a specific context
const missingContextDialogs = [
    '.uno:ContourDialog',
];

// don't pass yet
const buggyDialogs = [
    '.uno:HyperlinkDialog',
    '.uno:InsertFrame',
    '.uno:OutlineBullet',
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
        if (missingContextDialogs.includes(command)) {
            it.skip(`Dialog ${command} (missing context)`, function () {});
        } else if (buggyDialogs.includes(command)) {
            it.skip(`Dialog ${command} (buggy)`, function () {});
        } else {
            it(`Common Dialog ${command}`, function () {
                if (!hasLinguisticData && needLinguisticDataDialogs.includes(command)) {
                    this._runnable.title += ' (skipped: missing linguistic data)';
                    this.skip();
                }
                testDialog(command);
            });
        }
    });

    it.skip('Transform dialog (buggy)', function () {
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:BasicShapes.octagon');
        });

        cy.cGet('#test-div-shapeHandlesSection').should('exist');

        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:TransformDialog');
        });
        handleDialog(win, 1);

        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:FormatArea');
        });
        handleDialog(win, 1);

        // exit shape mode
        helper.typeIntoDocument('{esc}');
    });

    it('Line dialog', function () {
        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:Line');
        });

        cy.cGet('#test-div-shapeHandlesSection').should('exist');

        cy.then(() => {
            win.app.map.sendUnoCommand('.uno:FormatLine');
        });
        handleDialog(win, 1);
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
        handleDialog(win, 1);
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

    function testDialog(command) {
        cy.then(() => {
            win.app.map.sendUnoCommand(command);
        });

        handleDialog(win, 1, command);
    }

    function runA11yValidation(win) {
        a11yHelper.runA11yValidation(win, 'validatedialogsa11y');
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
                    command == '.uno:InsertCaptionDialog' ||
                    command == '.uno:SpellingAndGrammarDialog') {
                    cy.cGet('#options-button').click();
                    handleDialog(win, level + 1);
                } else if (command == '.uno:InsertIndexesEntry') {
                    cy.cGet('#new-button').click();
                    handleDialog(win, level + 1);
                } else if (command == '.uno:ContentControlProperties') {
                    cy.cGet('#add-button').click();
                    handleDialog(win, level + 1);
                } else if (command == '.uno:ThemeDialog') {
                    cy.cGet('#button_add-button').click();
                    handleDialog(win, level + 1);
                } else if (command == '.uno:SearchDialog') {
                    cy.cGet('.ui-expander-label').contains('Other options').should('be.visible').click();
                    cy.cGet('#similarity-input').check();
                    cy.cGet('#similaritybtn-button').should('be.enabled').click();
                    handleDialog(win, level + 1);
                } else if (command == '.uno:Signature') {
                    cy.cGet('#signatures .ui-treeview-entry > div:first-child').click();
                    cy.cGet('#view-button').should('be.enabled').click();
                    handleDialog(win, level + 1);
                    cy.cGet('#sign-button').should('be.enabled').click();
                    handleDialog(win, level + 1);
                };

                handleTabsInDialog(win, level, command);
                closeActiveDialog(level);
            });
    }

    function getActiveDialog(level) {
        return cy.cGet('.ui-dialog[role="dialog"]')
            .should('have.length', level)
            .then($dialogs => cy.wrap($dialogs.last()))
    }

    function testNameDialog(win, level) {
        /* exercise the name dialog */
        getActiveDialog(level + 1)
            .then(() => {
                return helper.processToIdle(win);
            })
            .then(() => {
                runA11yValidation(win);
            })
            .then(() => {
                // save with default suggested name
                cy.cGet('[role="dialog"][aria-labelledby*="Name"] #ok-button').should('be.enabled').click();
                return helper.processToIdle(win);
            })
            .then(() => {
                cy.cGet('.ui-dialog[role="dialog"]').should('have.length', level);
            });
        /* Then add the same name again so we get the warning subdialog */
        cy.cGet('button.ui-pushbutton[aria-label="Add"]:visible').click();
        getActiveDialog(level + 1)
            .then(() => {
                return helper.processToIdle(win);
            })
            .then(() => {
                // save with a name that exists to force the warning subdialog
                cy.cGet('#name_entry-input').clear().type('Hatching 1');
                cy.cGet('[role="dialog"][aria-labelledby*="Name"] #ok-button').should('be.enabled').click();
                return helper.processToIdle(win);
            })
            .then(() => {
                // warning subdialog, default close will cancel
                handleDialog(win, level + 1);
            });
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
				} else if (command == '.uno:SetDocumentProperties' && tabAriaControls == 'general')  {
                                    cy.cGet('#changepass-button').should('not.be.disabled').click();
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
                                } else if (command == '.uno:FontDialog' && tabAriaControls == 'font')  {
                                    cy.cGet('#btnWestFeatures-button').click();
                                    handleDialog(win, level + 1);
                                } else if (command == '.uno:PageDialog' && tabAriaControls == 'Footer')  {
                                    cy.cGet('button.ui-pushbutton[aria-label="More..."]:visible').click();
                                    handleDialog(win, level + 1);
                                } else if (command == '.uno:PageDialog' && tabAriaControls == 'lbhatch')  {
                                    cy.cGet('button.ui-pushbutton[aria-label="Add"]:visible').click();
                                    testNameDialog(win, level);
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
