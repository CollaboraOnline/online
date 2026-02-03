/* global describe expect it cy before after afterEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');
var a11yHelper = require('../../common/a11y_helper');

const allCalcDialogs = [
    '.uno:FormatCellDialog'
];

// 'common' dialogs that calc specifically does not support
const excludedCommonDialogs = [
    '.uno:AcceptTrackedChanges',
    '.uno:GotoPage',
    '.uno:SpellingAndGrammarDialog',
    '.uno:SplitCell',
];

// don't pass yet
const buggyCalcDialogs = [
    '.uno:FormatCellDialog',
    '.uno:InsertQrCode',
    '.uno:InsertSymbol',
    '.uno:Signature',
    '.uno:StyleNewByExample',
];

describe(['tagdesktop'], 'Accessibility Calc Dialog Tests', { testIsolation: false }, function () {
    let win;
    let hasLinguisticData = false;

    before(function () {
        helper.setupAndLoadDocument('calc/help_dialog.ods', /*isMultiUser=*/false, /*copyCertificates=*/true);

        // to make insertImage use the correct buttons
        desktopHelper.switchUIToNotebookbar();

        helper.setDummyClipboardForCopy();

        cy.getFrameWindow().then(function (frameWindow) {
            win = frameWindow;
            a11yHelper.enableUICoverage(win);
        });

        cy.cGet('.jsdialog-window').should('not.exist');


        cy.then(() => {
            // Go to a cell with text to enable thesaurus (if there is linguistic data available).
            helper.typeIntoInputField(helper.addressInputSelector, 'C5');
            calcHelper.assertAddressAfterIdle(win, 'C5');
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
            // expect(result.CompleteCalcDialogCoverage, `complete calc dialog coverage`).to.be.true;
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

	// make C5 the home cell for all tests
        helper.typeIntoInputField(helper.addressInputSelector, 'C5');
        calcHelper.assertAddressAfterIdle(win, 'C5');
    });

    a11yHelper.allCommonDialogs.forEach(function (commandSpec) {
        const command = typeof commandSpec === 'string' ? commandSpec : commandSpec.command;
        if (excludedCommonDialogs.includes(command)) {
            // silently skip the common dialogs that calc doesn't have
            return;
        } else if (a11yHelper.isBuggyCommonDialog(command)) {
            it.skip(`Common Dialog ${command} (buggy)`, function () {});
	} else if (buggyCalcDialogs.includes(command)) {
            it.skip(`Dialog ${command} (buggy)`, function () {});
        } else {
            it(`Common Dialog ${command}`, function () {
                if (!hasLinguisticData && a11yHelper.needsLinguisticData(command)) {
                    this._runnable.title += ' (skipped: missing linguistic data)';
                    this.skip();
                }
                a11yHelper.testDialog(win, commandSpec);
            });
        }
    });

    allCalcDialogs.forEach(function (commandSpec) {
        const command = typeof commandSpec === 'string' ? commandSpec : commandSpec.command;
        if (buggyCalcDialogs.includes(command)) {
            it.skip(`Dialog ${command} (buggy)`, function () {});
        } else {
            it(`Calc Dialog ${command}`, function () {
                a11yHelper.testDialog(win, commandSpec);
            });
        }
    });

});
