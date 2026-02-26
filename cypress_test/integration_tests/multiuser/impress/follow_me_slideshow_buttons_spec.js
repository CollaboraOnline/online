/* global describe it cy require beforeEach */

var helper = require('../../common/helper');
var { getSlideShow, getSlideShowContent } = require('../../common/impress_helper');

describe(['tagmultiuser'], 'Follow me slide show buttons', function () {

	beforeEach(function () {
		helper.setupAndLoadDocument('impress/follow.odp', true);

		cy.cSetActiveFrame('#iframe1');
		cy.cGet('.notebookbar #Slideshow-tab-label').click();

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.notebookbar #Slideshow-tab-label').click();
	});

	it('Attendee buttons to be disabled', function () {
		// User A starts "Present To All"
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('.notebookbar #slide-presentation-follow-me').click();
		cy.wait(500);
		getSlideShow().should('be.visible');

		// User B is attendee on slide 1
		cy.cSetActiveFrame('#iframe2');
		getSlideShow().should('be.visible');

		// B: Prev and Next are disabled
		getSlideShowContent().find('.slideshow-nav-container #previous')
			.should('have.attr', 'aria-disabled', 'true')
			.and('have.attr', 'data-cooltip', "You are on the first slide");
		getSlideShowContent().find('.slideshow-nav-container #next')
			.should('have.attr', 'aria-disabled', 'true')
			.and('have.attr', 'data-cooltip', "Waiting for presenter to advance");
	});

	it('A advances to slide 2 -> B auto-follows and buttons update', function () {
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('.notebookbar #slide-presentation-follow-me').click();
		cy.wait(500);

		// A advances to slide 2
		cy.cSetActiveFrame('#iframe1');
		for (let i = 0; i < 5; i++) {
			cy.wait(500);
			getSlideShowContent().find('.slideshow-nav-container #next').click();
		}
		cy.wait(500);
		// B is on slide 2 following A
		cy.cSetActiveFrame('#iframe2');

		// B: Prev enabled, Next disabled on same slide as presenter
		getSlideShowContent().find('.slideshow-nav-container #previous')
			.should('have.attr', 'aria-disabled', 'false')
			.and('have.attr', 'data-cooltip', "Previous");
		getSlideShowContent().find('.slideshow-nav-container #next')
			.should('have.attr', 'aria-disabled', 'true')
			.and('have.attr', 'data-cooltip', "Waiting for presenter to advance");
	});

});
