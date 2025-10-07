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

    it('Go to next effect', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        cy.wait(500);
        getSlideShow().should('be.visible');
        getSlideShowContent().find('#slideshow-canvas').click();
        cy.wait(500);

        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('be.visible');
        getSlideShow().compareSnapshot('effect1');
    });

    it('Go to previous effect and slide', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        cy.wait(500);

        //move to nextslide last effect
        getSlideShow().should('be.visible');
        for (let i = 0; i < 5; i++) {
            cy.wait(500);
            getSlideShowContent().find("#next").click();
        }
        getSlideShow().compareSnapshot('slide2_effect3');

        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('be.visible');
        getSlideShow().compareSnapshot('slide2_effect3');

        // go to previous effect
        cy.cSetActiveFrame('#iframe2');
        getSlideShowContent().find("#previous").click();
        getSlideShow().compareSnapshot('slide2_effect2');
        cy.cSetActiveFrame('#iframe1');
        getSlideShow().compareSnapshot('slide2_effect2');

        //go to previous effect
        cy.cSetActiveFrame('#iframe2');
        for (let i = 0; i < 3; i++) {
            cy.wait(500);
            getSlideShowContent().find("#previous").click();
        }
        getSlideShow().compareSnapshot('effect1');
        cy.cSetActiveFrame('#iframe1');
        getSlideShow().compareSnapshot('effect1');
    });
});
