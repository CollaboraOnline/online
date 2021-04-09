/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var { addComment, addSlide, changeSlide }= require('../../common/impress_helper');

describe('Comment Scrolling',function() {
	var testFileName = 'comment_switching.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('no comment or one comment', function() {
		cy.get('.leaflet-control-scroll-down').should('not.exist');
		addComment(1);
		cy.get('.leaflet-control-scroll-down').should('not.exist');
	});

	it('omit slides without comments', function() {
		//scroll up
		addComment(1);
		addSlide(2);
		addComment(1);
		cy.get('.leaflet-control-scroll-up').should('exist');
		cy.get('.leaflet-control-scroll-up').click().wait(300);
		cy.get('#PageStatus').should('contain','Slide 1 of 3');

		//scroll down
		cy.get('.leaflet-control-scroll-down').should('exist');
		cy.get('.leaflet-control-scroll-down').click().wait(300);
		cy.get('#PageStatus').should('contain','Slide 3 of 3');
	});


	it('switch to previous or next slide',function() {
		addSlide(1);
		addComment(2);

		//scroll up
		addSlide(1);
		cy.get('.leaflet-control-scroll-up').should('exist');
		cy.get('.leaflet-control-scroll-up').click().wait(300);
		cy.get('#PageStatus').should('contain','Slide 2 of 3');

		//scroll down
		changeSlide(1,'previous');
		cy.get('.leaflet-control-scroll-down').should('exist');
		cy.get('.leaflet-control-scroll-down').click().wait(300);
		cy.get('#PageStatus').should('contain','Slide 2 of 3');
	});

	it('multiple comments on same slide', function() {
		addComment(1);
		addSlide(1);
		addComment(2);
		addSlide(1);
		addComment(1);
		changeSlide(1,'previous');

		//scroll down
		cy.get('.leaflet-control-scroll-down').should('exist');
		cy.get('.leaflet-control-scroll-down').click().wait(300);
		cy.get('#PageStatus').should('contain','Slide 2 of 3');

		//scroll up
		cy.get('.leaflet-control-scroll-up').should('exist');
		cy.get('.leaflet-control-scroll-up').click().wait(300);
		cy.get('#PageStatus').should('contain','Slide 2 of 3');
	});
});
