/* global describe expect it cy before after afterEach require Cypress */

var helper = require('../../common/helper');

const allWriterDialogs = [
    '.uno:ChapterNumberingDialog',
    '.uno:EditRegion',
    '.uno:FontDialog',
    '.uno:FootnoteDialog',
    '.uno:FormatColumns',
    '.uno:InsertBreak',
    '.uno:InsertBookmark',
    '.uno:InsertCaptionDialog',
    '.uno:InsertFrame',
    '.uno:InsertIndexesEntry',
    '.uno:InsertMultiIndex',
    '.uno:InsertSection',
    '.uno:LineNumberingDialog',
    '.uno:OutlineBullet',
    '.uno:PageDialog',
    '.uno:PageNumberWizard',
    '.uno:ParagraphDialog',
    '.uno:SearchDialog?InitialFocusReplace:bool=true',
    '.uno:SpellingAndGrammarDialog',
    '.uno:SplitTable',
    '.uno:TableDialog',
    '.uno:TableNumberFormatDialog',
    '.uno:TableSort',
    '.uno:ThemeDialog',
    '.uno:ThesaurusDialog',
    '.uno:TitlePageDialog',
    '.uno:Translate',
    '.uno:Watermark',
    '.uno:WordCountDialog'
];

// these need a specific context
const missingContextDialogs = [
    '.uno:ContourDialog',
    '.uno:TransformDialog'
];

// don't pass yet
const buggyDialogs = [
    '.uno:InsertFrame',
    '.uno:OutlineBullet',
    '.uno:PageDialog',
    '.uno:ParagraphDialog',
    '.uno:SpellingAndGrammarDialog',
    '.uno:TableDialog'
];

describe(['tagdesktop'], 'Accessibility Writer Tests', { testIsolation: false }, function () {
    let win;

    before(function () {
        helper.setupAndLoadDocument('writer/help_dialog.odt');

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

            // TODO: make this true
            // expect(result.CompleteWriterDialogCoverage, `complete writer dialog coverage`).to.be.true;
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
        cy.cGet('.jsdialog-window').should('not.exist');
    });

    allWriterDialogs.forEach(function (command) {
        if (missingContextDialogs.includes(command)) {
            it.skip(`Dialog ${command} (missing context)`, function () {});
        } else if (buggyDialogs.includes(command)) {
            it.skip(`Dialog ${command} (buggy)`, function () {});
        } else {
            it(`Dialog ${command}`, function () {
                testDialog(command);
            });
        }
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

    it('ReadOnly info dialog', function () {
        // Text ReadOnly info dialog
        helper.clearAllText();
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
                }

                handleTabsInDialog(win, level);
                closeActiveDialog(level);
            });
    }

    function getActiveDialog(level) {
        return cy.cGet('.ui-dialog[role="dialog"]')
            .should('have.length', level)
            .then($dialogs => cy.wrap($dialogs.last()))
    }

    function handleTabsInDialog(win, level) {
        traverseTabs(() => getActiveDialog(level), win);
    }

    function traverseTabs(getContainer, win, isNested = false) {
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
                                                win, true
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
