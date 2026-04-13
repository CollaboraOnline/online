/* global describe it cy require beforeEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var { getSlideShow, getSlideShowContent, getSlideShowCanvas } = require('../../common/impress_helper');

describe(['tagmultiuser'], 'Follow me slide show', function() {
    var win1, win2;

    beforeEach(function() {
            helper.setupAndLoadDocument('impress/follow.odp',true);

            cy.getFrameWindow('#iframe1').then((win) => { win1 = win; });
            cy.getFrameWindow('#iframe2').then((win) => { win2 = win; });
	    cy.viewport(2000, helper.maxScreenshotableViewportHeight);

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
        getSlideShowContent().find(".slideshow-nav-container #endshow").click();
        getSlideShow().should('not.exist');
        cy.cGet('.notebookbar #slide-presentation-follow-me').should('be.not.visible');
        cy.cGet('.notebookbar #slide-presentation-follow').should('be.visible');
    });

    it('Go to next effect', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        getSlideShow().should('be.visible');
        impressHelper.waitForSlideShowIdle(win2);
        getSlideShowContent().find('#slideshow-canvas').click();
        impressHelper.waitForSlideShowIdle(win2);

        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('be.visible');
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('effect1', 0.05);
    });

    it('Go to previous effect and slide', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        getSlideShow().should('be.visible');
        impressHelper.waitForSlideShowIdle(win2);
        impressHelper.waitForSlideShowIdle(win1);

        //move to nextslide last effect
        for (let i = 0; i < 5; i++) {
            getSlideShowContent().find(".slideshow-nav-container #next").click();
            impressHelper.waitForSlideShowIdle(win2);
            impressHelper.waitForSlideShowIdle(win1);
        }
        getSlideShowCanvas().compareSnapshot('slide2_effect3', 0.05);

        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('be.visible');
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect3', 0.05);

        // go to previous effect
        cy.cSetActiveFrame('#iframe2');
        getSlideShowContent().find(".slideshow-nav-container #previous").click();
        impressHelper.waitForSlideShowIdle(win2);
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.05);
        cy.cSetActiveFrame('#iframe1');
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.05);

        //go to previous effect
        cy.cSetActiveFrame('#iframe2');
        for (let i = 0; i < 3; i++) {
            getSlideShowContent().find(".slideshow-nav-container #previous").click();
            impressHelper.waitForSlideShowIdle(win2);
            impressHelper.waitForSlideShowIdle(win1);
        }
        getSlideShowCanvas().compareSnapshot('effect1', 0.05);
        cy.cSetActiveFrame('#iframe1');
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('effect1', 0.05);
    });

    it('Follow and unfollow', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        getSlideShow().should('be.visible');
        impressHelper.waitForSlideShowIdle(win2);
        impressHelper.waitForSlideShowIdle(win1);

        //move to nextslide last effect
        for (let i = 0; i < 4; i++) {
            getSlideShowContent().find(".slideshow-nav-container #next").click();
            impressHelper.waitForSlideShowIdle(win2);
            impressHelper.waitForSlideShowIdle(win1);
        }
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.05);

        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('be.visible');
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.05);

        //unfollow by going 1 slide backward
        for (let i = 0; i < 3; i++) {
            getSlideShowContent().find(".slideshow-nav-container #previous").click();
            impressHelper.waitForSlideShowIdle(win1);
        }
        // higher tolerance due to difference in state of navigation buttons
        getSlideShowCanvas().compareSnapshot('effect1', 0.07);

        //start following again
        cy.cSetActiveFrame('#iframe1');
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowContent().find("#follow").click();
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.07);

        cy.cSetActiveFrame('#iframe2');
        getSlideShowContent().find(".slideshow-nav-container #next").click();
        impressHelper.waitForSlideShowIdle(win2);
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect3', 0.07);
    });

    it('Rejoin', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        getSlideShow().should('be.visible');
        impressHelper.waitForSlideShowIdle(win2);
        impressHelper.waitForSlideShowIdle(win1);

        //move to nextslide last effect
        for (let i = 0; i < 4; i++) {
            getSlideShowContent().find(".slideshow-nav-container #next").click();
            impressHelper.waitForSlideShowIdle(win2);
            impressHelper.waitForSlideShowIdle(win1);
        }
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.05);

        cy.cSetActiveFrame('#iframe1');
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowContent().find(".slideshow-nav-container #endshow").click();
        getSlideShow().should('not.exist');
        // Wait for the _windowCloseInterval cleanup to complete before clicking follow.
        helper.waitForTimers(win1, 'slideshowwindowclose');
        cy.cGet('.notebookbar #slide-presentation-follow').should('be.visible');
        cy.cGet('#slide-presentation-follow').click();
        getSlideShow().should('be.visible');
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('slide2_effect2', 0.05);
    });

    it('Exit', function () {
        cy.cSetActiveFrame('#iframe2');
        cy.cGet('.notebookbar #slide-presentation-follow-me').click();
        getSlideShow().should('be.visible');
        impressHelper.waitForSlideShowIdle(win2);
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowContent().find(".slideshow-nav-container #next").click();
        impressHelper.waitForSlideShowIdle(win2);
        impressHelper.waitForSlideShowIdle(win1);

        getSlideShowCanvas().compareSnapshot('effect1', 0.05);

        cy.cSetActiveFrame('#iframe1');
        impressHelper.waitForSlideShowIdle(win1);
        getSlideShowCanvas().compareSnapshot('effect1', 0.05);

        cy.cSetActiveFrame('#iframe2');
        getSlideShowContent().find(".slideshow-nav-container #endshow").click();
        getSlideShow().should('not.exist');
        cy.cSetActiveFrame('#iframe1');
        getSlideShow().should('not.exist');
    });
});
