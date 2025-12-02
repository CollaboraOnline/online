/* global describe it cy beforeEach require */
var helper = require('../../common/helper');

describe(['tagdesktop'], 'Accessibility Writer Tests', function() {
     beforeEach(function() {
        helper.setupAndLoadDocument('writer/help_dialog.odt');
    });

    it('Check accessibility for writer', function() {
        cy.getFrameWindow().then(function (win) {
            win.app.allDialogs.forEach(command => {
                cy.log(`Testing dialog: ${command}`);
                win.app.map.sendUnoCommand(command);
                cy.wait(500);
                cy.cGet('body').type('{esc}');
            });
        });
    });
});