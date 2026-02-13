/* global describe it cy require beforeEach */

var helper = require('../../common/helper');

function getSlideShow() {
    return cy.cGet('#slideshow-cypress-iframe');
}

function getSlideShowContent() {
    return getSlideShow().its('0.contentDocument');
}

function getSlideShowCanvas() {
    return getSlideShowContent().find('#slideshow-canvas');
}

describe(['tagmultiuser'], 'Follow me slide show', function() {

    beforeEach(function() {

            helper.setupAndLoadDocument('impress/follow.odp',true);

            cy.cSetActiveFrame('#iframe1');
            cy.getFrameWindow().then((win1) => {
                this.win1 = win1;
            })
            cy.cGet('.notebookbar #Slideshow-tab-label').click();

            cy.cSetActiveFrame('#iframe2');
            cy.getFrameWindow().then((win2) => {
                this.win2 = win2;
            })
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
        getSlideShowContent().find(".slideshow-nav-container #endshow").click();
        getSlideShow().should('not.exist');
        cy.cGet('.notebookbar #slide-presentation-follow-me').should('be.not.visible');
        cy.cGet('.notebookbar #slide-presentation-follow').should('be.visible');
    });

    it('Go to next effect', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        helper.processToIdle(this.win2);
        getSlideShow().should('be.visible');
        getSlideShowContent().find('#slideshow-canvas').click();
        helper.processToIdle(this.win2);

        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('be.visible');
        helper.waitForSlideShowIdle(this.win1);
        getSlideShowCanvas().compareSnapshot('effect1', 0.1);
    });

    it('Go to previous effect and slide', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        helper.processToIdle(this.win2);

        //move to nextslide last effect
        getSlideShow().should('be.visible');
        for (let i = 0; i < 5; i++) {
            getSlideShowContent().find(".slideshow-nav-container #next").click();
            helper.processToIdle(this.win2);
        }
        helper.waitForSlideShowIdle(this.win2);
        getSlideShowCanvas().compareSnapshot('slide2_effect3', 0.1);

        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('be.visible');
        helper.waitForSlideShowIdle(this.win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect3', 0.1);

        // go to previous effect
        cy.cSetActiveFrame('#iframe2');
        getSlideShowContent().find(".slideshow-nav-container #previous").click();
        helper.waitForSlideShowIdle(this.win2);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.1);
        cy.cSetActiveFrame('#iframe1');
        helper.waitForSlideShowIdle(this.win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.1);

        //go to previous effect
        cy.cSetActiveFrame('#iframe2');
        for (let i = 0; i < 3; i++) {
            getSlideShowContent().find(".slideshow-nav-container #previous").click();
            helper.processToIdle(this.win2);
        }
        helper.waitForSlideShowIdle(this.win2);
        getSlideShowCanvas().compareSnapshot('effect1', 0.1);
        cy.cSetActiveFrame('#iframe1');
        helper.waitForSlideShowIdle(this.win1);
        getSlideShowCanvas().compareSnapshot('effect1', 0.1);
    });

    it('Follow and unfollow', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        helper.processToIdle(this.win2);

        //move to nextslide last effect
        getSlideShow().should('be.visible');
        for (let i = 0; i < 4; i++) {
            helper.processToIdle(this.win2);
            getSlideShowContent().find(".slideshow-nav-container #next").click();
        }
        helper.waitForSlideShowIdle(this.win2);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.1);

        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('be.visible');
        helper.waitForSlideShowIdle(this.win2);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.1);

        //unfollow by going 1 slide backward
        for (let i = 0; i < 3; i++) {
            helper.processToIdle(this.win2);
            getSlideShowContent().find(".slideshow-nav-container #previous").click();
        }
        helper.waitForSlideShowIdle(this.win2);
        getSlideShowCanvas().compareSnapshot('effect1', 0.1);

        //start following again
        cy.cSetActiveFrame('#iframe1');
        getSlideShowContent().find("#follow").click();
        helper.waitForSlideShowIdle(this.win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.1);

        cy.cSetActiveFrame('#iframe2');
        getSlideShowContent().find(".slideshow-nav-container #next").click();
        helper.waitForSlideShowIdle(this.win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect3', 0.1);
    });

    it('Rejoin', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        cy.wait(500);

        //move to nextslide last effect
        getSlideShow().should('be.visible');
        for (let i = 0; i < 4; i++) {
            cy.wait(500);
            getSlideShowContent().find(".slideshow-nav-container #next").click();
        }
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.1);

        cy.cSetActiveFrame('#iframe1');
        getSlideShowContent().find(".slideshow-nav-container #endshow").click();
        getSlideShow().should('not.exist');
        cy.wait(1000);
        cy.cGet('.notebookbar #slide-presentation-follow').should('be.visible');
        cy.cGet('#slide-presentation-follow').click();
        cy.wait(500);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.1);
    });

    it('Exit', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        cy.wait(500);
        getSlideShowContent().find(".slideshow-nav-container #next").click();
        cy.wait(500);

        getSlideShowCanvas().compareSnapshot('effect1', 0.1);

        cy.cSetActiveFrame('#iframe1');
        getSlideShowCanvas().compareSnapshot('effect1', 0.1);

        cy.cSetActiveFrame('#iframe2');
        getSlideShowContent().find(".slideshow-nav-container #endshow").click();
        getSlideShow().should('not.exist');
        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('not.exist');
    });
});
