/* global describe expect it cy beforeEach require Cypress */

var helper = require('../../common/helper');

describe(['tagdesktop'], 'Accessibility Writer Tests', function () {
    beforeEach(function () {
        helper.setupAndLoadDocument('writer/help_dialog.odt');
    });

    it('Check accessibility for writer', function () {
        cy.getFrameWindow().then(function (win) {
            cy.spy(win.console, 'error').as('console:error');

            const enableUICoverage = {
                'Track': {
                    'type': 'boolean',
                    'value': true
                }
            };
            win.app.map.sendUnoCommand('.uno:UICoverage', enableUICoverage);

            cy.cGet('.jsdialog-window').should('not.exist');

            cy.wrap(win.app.allDialogs).each((command) => {
                // these need a specific context
                if (command == '.uno:ContourDialog' ||
                    command == '.uno:TransformDialog') {
                    cy.log(`Skipping missing-context dialog: ${command}`);
                    return;
                }
                // not jsdialog enabled
                if (command == '.uno:ChapterNumberingDialog') {
                    cy.log(`Skipping non-jsdialog dialog: ${command}`);
                    return;
                }
                if (command == '.uno:FontDialog') {
                    cy.log(`Skipping buggy dialog: ${command}`);
                    return;
                }

                cy.log(`Testing dialog: ${command}`);
                cy.then(() => {
                    win.app.map.sendUnoCommand(command);
                });

                getActiveDialog()
                    .should('exist')
                    .then(() => {
                        handleTabsInDialog();
                        closeActiveDialog();
                    });
            });

            cy.get('@console:error').then(spy => {
                const a11yErrors = spy.getCalls().filter(call =>
                    String(call.args[0]).includes('A11yValidator exception')
                );

                if (a11yErrors.length > 0) {
                    const errorMessages = a11yErrors.map(call =>
                        call.args.map(arg => String(arg)).join(' ')
                    ).join('\n\n');

                    throw new Error(`Found A11y errors:\n${errorMessages}`);
                }
            });

            cy.spy(win.app.socket, '_onMessage').as('onMessage');

            // add to the cypress queue to be run after the dialogs are processed
            // and errors checked
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
    });

    function getActiveDialog() {
        return cy.cGet('.ui-dialog[role="dialog"]')
            .should('have.length.at.least', 1)
            .last();
    }

    function handleTabsInDialog() {
        traverseTabs(() => getActiveDialog());
    }

    function traverseTabs(getContainer) {
        const TABLIST = '[role="tablist"]';
        const TAB = '[role="tab"]';

        getContainer().then($container => {
            const $tabLists = $container.find(TABLIST);

            if (!$tabLists.length) return;

            Cypress._.each($tabLists, (tabListEl, tabListIndex) => {
                const $tabs = Cypress.$(tabListEl).find(TAB);

                const clickTabByIndex = index => {
                    if (index >= $tabs.length) return;

                    getContainer()
                        .find(TABLIST).eq(tabListIndex)
                        .find(TAB).eq(index)
                        .click({ force: true });

                    getContainer().then($ctx => {
                        const $panel = getActiveTabPanel($ctx);

                        if ($panel && $panel.length) {
                            const $nestedTablists = $panel.find(TABLIST);

                            if ($nestedTablists.length > 0) {
                                traverseTabs(() => cy.wrap($panel));
                            }
                        }
                    });

                    clickTabByIndex(index + 1);
                };

                clickTabByIndex(0);
            });
        });
    }

    function getActiveTabPanel($container) {
        const $activeTab = $container
            .find('[role="tab"][aria-selected="true"]')
            .first();

        if (!$activeTab.length) return null;

        const panelId = $activeTab.attr('aria-controls');
        if (!panelId) return null;

        return $container.find(`#${panelId}[role="tabpanel"]`);
    }

    function closeActiveDialog() {
        getActiveDialog().within(() => {
            cy.get('.ui-dialog-titlebar-close').click({ force: true });
        });

        cy.cGet('.ui-dialog[role="dialog"]').should('have.length', 0);
    }
});
