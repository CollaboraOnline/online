/* global describe it cy require beforeEach */

var helper = require('../../common/helper');

function getSlideShow() {
    return cy.cGet('#slideshow-cypress-iframe');
}

function getSlideShowContent() {
    return getSlideShow().its('0.contentDocument');
}

describe(['tagmultiuser'], 'Follow me slide show', function() {

    beforeEach(function() {

            helper.setupAndLoadDocument('impress/follow.odp',true);
            cy.viewport(3840, 1080);

            cy.cSetActiveFrame('#iframe1');
            cy.cGet('.notebookbar #Slideshow-tab-label').click();

            cy.cSetActiveFrame('#iframe2');
            cy.cGet('.notebookbar #Slideshow-tab-label').click();
        });

    it('Start Follow Me Slideshow', function () {
        cy.cSetActiveFrame('#iframe1');

        cy.cGet('.notebookbar #slide-presentation-follow').should('be.not.visible');
        cy.cGet('.notebookbar #slide-presentation-follow-me').should('be.visible');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        getSlideShow().should('be.visible');

        cy.cSetActiveFrame('#iframe2');
        getSlideShow().should('be.visible');
        getSlideShowContent().find("#endshow").click();
        getSlideShow().should('not.exist');
        cy.cGet('.notebookbar #slide-presentation-follow-me').should('be.not.visible');
        cy.cGet('.notebookbar #slide-presentation-follow').should('be.visible');
    });
});
