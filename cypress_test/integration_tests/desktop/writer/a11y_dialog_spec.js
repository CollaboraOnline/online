/* global describe it cy beforeEach require */
var helper = require('../../common/helper');

describe(['tagdesktop'], 'Accessibility Writer Tests', function() {
     beforeEach(function() {
        helper.setupAndLoadDocument('writer/help_dialog.odt');
    });

    it('Check accessibility for writer', function() {
        cy.getFrameWindow().then(function (win) {
            cy.spy(win.console, 'error').as('console:error');

            win.app.allDialogs.forEach(command => {
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

                cy.log(`Testing dialog: ${command}`);
                cy.cGet('.jsdialog-window').should('not.exist');
                cy.then(() => {
                    win.app.map.sendUnoCommand(command);
                });
                cy.wait(1000);
                cy.cGet('.jsdialog-window').should('exist');
                cy.cGet('body').type('{esc}');
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
        });
    });
});
