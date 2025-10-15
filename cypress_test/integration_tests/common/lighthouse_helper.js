/* global describe it require cy beforeEach */
import "@cypress-audit/lighthouse/commands";

var helper = require('./helper');

function runLighthouseAccessibilityTest(docType, filePath) {
    describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], `${docType} Lighthouse Accessibility Tests`, function () {

        beforeEach(function() {
            var newFilePath = helper.setupDocument(filePath);
            helper.loadDocument(newFilePath, /*skipDocumentChecks*/ true);
            helper.documentChecks(/*skipInitializedCheck*/ true);
        });

        it('lighthouse accessibility score', function() {
            cy.lighthouse({
                accessibility: 100,
            });
        });
    });
}

module.exports.runLighthouseAccessibilityTest = runLighthouseAccessibilityTest;