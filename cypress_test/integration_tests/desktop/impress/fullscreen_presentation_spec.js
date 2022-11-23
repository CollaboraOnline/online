/* global describe it cy require afterEach Cypress expect */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Fullscreen Presentation.', function() {
	var testFileName = 'text_fields.odp';

	function getSlideShowContent() {
		return cy.get('@coolIFrameGlobal')
			.find('.leaflet-slideshow').then(($iframe) =>{
				cy.wrap($iframe.contents());
			});
	}

	function before(fileName) {
		testFileName = fileName;
		helper.beforeAll(testFileName, 'impress');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		} else {
			desktopHelper.hideSidebar();
		}

		cy.get('#menu-slide > a')
			.click();
		cy.get('#menu-fullscreen-presentation > a')
			.click();
	}

	function slideExist(id) {
		getSlideShowContent().find('#' + id)
			.should('exist')
			.should('have.class', 'Slide');
	}

	function textFieldHasContent(id, className, content) {
		getSlideShowContent().find('#' + id)
			.should('have.class', className)
			.find('.PlaceholderText')
			.as('placeholder');
		if (className.indexOf('Time') !== 0) {
			cy.get('@placeholder').should('contain', content);
		} else {
			cy.get('@placeholder')
				.should('exist')
				.then((template) => {
					var displayedContent = template.prop('textContent');
					var displayedTime = Date.parse('2000-01-01T' + displayedContent + '.000Z');
					var expectedTime = Date.parse('2000-01-01T' + content + '.000Z');
					expect(displayedTime).to.be.closeTo(expectedTime, 60000, 'displayedContent: ' + displayedContent);
				});
		}
	}

	function metaSlidesChildExist(id) {
		getSlideShowContent().find('#ooo\\:meta_slides > #' + id)
			.should('exist');
	}

	function slideBackgroundObjectShould(slideId, elementSelector, chainer) {
		getSlideShowContent().find('#' + slideId + ' > .MasterPageView > .BackgroundObjects > ' + elementSelector)
			.should(chainer);
	}

	function textFieldCheck(textFields, visibilityMap) {
		var numberOfSlides = Object.keys(visibilityMap).length;

		for (var i = 0; i < numberOfSlides; ++i)
		{
			cy.wait(1000);
			var slideId = 'id' + (i + 1).toString();
			slideExist(slideId);
			textFields.forEach((tf) => {
				var included = visibilityMap[slideId].includes(tf.id);
				var isSlideNumber = tf.className.indexOf('PageNumber') === 0;
				if (included) {
					textFieldHasContent(tf.id, tf.className, tf.content);
					if (!isSlideNumber) {
						metaSlidesChildExist(tf.id);
					}
				}
				var selector = isSlideNumber ? '#' + tf.id : 'use[href="#' + tf.id + '"]';
				slideBackgroundObjectShould(slideId, selector, included ? 'exist' : 'not.exist');
			});
			// move to next slide
			getSlideShowContent().find('#' + slideId).click();
		}

	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Text fields.', function() {
		before('text_fields.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id1').should('have.class', 'Slide');

		getSlideShowContent().find('#tf2 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', '1');

		getSlideShowContent().find('#tf6 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', '1');

		getSlideShowContent().find('#tf5 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', 'SlideOne');

		// go to second slide
		getSlideShowContent().find('#id1').click();

		getSlideShowContent().find('#id2').should('have.class', 'Slide');

		getSlideShowContent().find('#tf7 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', '2');

		getSlideShowContent().find('#tf9 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', '2');

		getSlideShowContent().find('#tf8 > g > text > tspan > tspan > tspan')
			.should('have.class', 'PlaceholderText')
			.should('contain', 'SlideHello');
	});

	it('Custom background.', function() {
		before('slide-bitmap-background.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id1')
			.should('have.class', 'Slide');
		getSlideShowContent().find('#id1 > g').its('0')
			.should('have.class', 'MasterPageView');
		getSlideShowContent().find('#id1 > g > use')
			.should('have.class', 'Background')
			.should('have.attr', 'href', '#bg-id1');

		getSlideShowContent().find('#id1 > .Page > .SlideBackground > .Background')
			.should('have.attr', 'id', 'bg-id1');
	});

	it('Leading spaces shorter than a text line.', function() {
		before('white-spaces.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id8 > .SVGTextShape > .TextParagraph > .TextPosition')
			.as('textLines')
			.should('contain', '2');

		getSlideShowContent().get('@textLines').eq(0).find('tspan').first()
			.should('have.text', '    ')
			.then((spaces) => {
				const spacesLength = spaces.prop('textLength').baseVal.valueAsString;
				getSlideShowContent().get('@textLines').eq(1).find('tspan').first()
					.should('have.text', '1234')
					.then((template) => {
						const templateLength = template.prop('textLength').baseVal.valueAsString;
						expect(spacesLength).to.eq(templateLength);
					});
			});
	});

	it('Leading spaces as long as a text line.', function() {
		before('white-spaces.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id10 > .SVGTextShape > .TextParagraph > .TextPosition')
			.as('textLines')
			.should('contain', '2');

		getSlideShowContent().get('@textLines').eq(0).find('tspan').first()
			.then((spaces) => {
				expect(spaces).to.have.prop('textContent').match(/ +/);
				const spacesLength = spaces.prop('textLength').baseVal.value;
				getSlideShowContent().get('@textLines').eq(1).find('tspan').first()
					.should('have.text', '1234567890')
					.then((template) => {
						const templateLength = template.prop('textLength').baseVal.value;
						expect(spacesLength).to.be.gte(templateLength);
						const textX = parseFloat(this.textLines[1].getAttribute('x'));
						expect(template.get(0).getBBox().x).to.be.closeTo(textX, 0.001);
					});
			});
	});

	it('Leading spaces longer than a text line.', function() {
		before('white-spaces.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id12 > .SVGTextShape > .TextParagraph > .TextPosition')
			.as('textLines')
			.should('contain', '3');

		getSlideShowContent().get('@textLines').eq(1).find('tspan').first()
			.should('have.text', '    ')
			.then((spaces) => {
				const spacesLength = spaces.prop('textLength').baseVal.valueAsString;
				getSlideShowContent().get('@textLines').eq(2).find('tspan').first()
					.should('have.text', '1234')
					.then((template) => {
						const templateLength = template.prop('textLength').baseVal.valueAsString;
						expect(spacesLength).to.eq(templateLength);
					});
			});
	});

	it('Internal spaces up to the end of the line.', function() {
		before('white-spaces.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id14 > .SVGTextShape > .TextParagraph > .TextPosition')
			.as('textLines')
			.should('contain', '2');

		getSlideShowContent().get('@textLines').eq(0).find('tspan').first()
			.then((spaces) => {
				expect(spaces).to.have.prop('textContent').match(/1 +/);
				getSlideShowContent().get('@textLines').eq(1).find('tspan').first()
					.should('have.text', '1234567890')
					.then((template) => {
						const textX = parseFloat(this.textLines[1].getAttribute('x'));
						expect(template.get(0).getBBox().x).to.be.closeTo(textX, 0.001);
					});
			});
	});

	it('Internal spaces crossing two lines.', function() {
		before('white-spaces.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id16 > .SVGTextShape > .TextParagraph > .TextPosition')
			.as('textLines')
			.should('contain', '3');

		getSlideShowContent().get('@textLines').eq(1).find('tspan').first()
			.should('have.text', '    567890')
			.then((spaces) => {
				const spacesLength = spaces.prop('textLength').baseVal.valueAsString;
				getSlideShowContent().get('@textLines').eq(2).find('tspan').first()
					.should('have.text', '1234567890')
					.then((template) => {
						const templateLength = template.prop('textLength').baseVal.valueAsString;
						expect(spacesLength).to.eq(templateLength);
					});
			});
	});

	it('Animation: Emphasis: Spin.', function() {
		before('anim-spin.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id1')
			.should('have.class', 'Slide');
		getSlideShowContent().find('#id1 > g').its('1')
			.should('have.class', 'Page');
		getSlideShowContent().find('#id3')
			.then((shape) => {
				const matrix = shape.prop('transform').baseVal.getItem(0).matrix;
				expect(matrix.a).to.eq(1);
				expect(matrix.b).to.eq(0);
				expect(matrix.c).to.eq(0);
				expect(matrix.d).to.eq(1);
				expect(matrix.e).to.eq(0);
				expect(matrix.f).to.eq(0);
			})
			.click();

		cy.wait(3000);
		getSlideShowContent().find('#id3')
			.then((shape) => {
				const matrix = shape.prop('transform').baseVal.getItem(0).matrix;
				expect(Math.round(matrix.a)).to.eq(0);
				expect(matrix.b).to.eq(1);
				expect(matrix.c).to.eq(-1);
				expect(Math.round(matrix.d)).to.eq(0);
				expect(matrix.e).to.eq(22501);
				expect(matrix.f).to.eq(-5500);
			});
	});

	it('Animation: Emphasis: Grow and Shrink.', function() {
		before('anim-grow-and-shrink.odp');

		cy.wait(3000);

		getSlideShowContent().find('#id1')
			.should('have.class', 'Slide');
		getSlideShowContent().find('#id1 > g').its('1')
			.should('have.class', 'Page');
		getSlideShowContent().find('#id3')
			.then((shape) => {
				const matrix = shape.prop('transform').baseVal.getItem(0).matrix;
				expect(matrix.a).to.eq(1);
				expect(matrix.b).to.eq(0);
				expect(matrix.c).to.eq(0);
				expect(matrix.d).to.eq(1);
				expect(matrix.e).to.eq(0);
				expect(matrix.f).to.eq(0);
			})
			.click();

		cy.wait(3000);
		getSlideShowContent().find('#id3')
			.then((shape) => {
				const matrix = shape.prop('transform').baseVal.getItem(0).matrix;
				expect(matrix.a).to.eq(2.5);
				expect(matrix.b).to.eq(0);
				expect(matrix.c).to.eq(0);
				expect(matrix.d).to.eq(2.5);
				expect(matrix.e).to.eq(-21000.75);
				expect(matrix.f).to.eq(-12750.75);
			});
	});

	it('Small text fields.', function() {
		before('small-text-fields.odp');
		cy.wait(2000);

		var textFields = [
			{id: 'tf1', className: 'DateTime.Default', content: '01/01/2022'},
			{id: 'tf2', className: 'Footer.Default', content: 'master page footer'},
			{id: 'tf3', className: 'PageNumber.Default', content: '1'},
			{id: 'tf4', className: 'DateTime.id6', content: '01/01/2022'},
			{id: 'tf5', className: 'Footer.id7', content: 'master page footer'},
			{id: 'tf6', className: 'PageNumber.id8', content: '1'},
		];
		var visibilityMap = {
			id1: ['tf1', 'tf2', 'tf3', 'tf4', 'tf5', 'tf6'],
		};

		textFieldCheck(textFields, visibilityMap);
	});

	it('Duplicated text fields.', function() {
		before('double-text-fields.odp');
		cy.wait(2000);

		var date = new Date().toLocaleDateString();
		var time = new Date().toLocaleTimeString();

		var textFields = [
			{id: 'tf1', className: 'DateTime.Default', content: '01/01/2022'},
			{id: 'tf2', className: 'Footer.Default', content: 'master page footer'},
			{id: 'tf3', className: 'PageNumber.Default', content: '1'},
			{id: 'tf4', className: 'PageName.id9', content: 'Slide 1'},
			{id: 'tf5', className: 'PageName.id10', content: 'Slide 1'},
			{id: 'tf6', className: 'DateTime.id11', content: '01/01/2022'},
			{id: 'tf7', className: 'Footer.id12', content: 'master page footer'},
			{id: 'tf8', className: 'PageNumber.id13', content: '1'},
			{id: 'tf9', className: 'Date.id14', content: date},
			{id: 'tf10', className: 'Date.id15', content: date},
			{id: 'tf11', className: 'Time.id16', content: time},
			{id: 'tf12', className: 'Time.id17', content: time},
			{id: 'tf13', className: 'PageName.id9', content: 'Slide 2'},
			{id: 'tf14', className: 'PageName.id10', content: 'Slide 2'},
			{id: 'tf15', className: 'PageNumber.id13', content: '2'},
		];
		var visibilityMap = {
			id1: ['tf1', 'tf2', 'tf3', 'tf4', 'tf5', 'tf6', 'tf7', 'tf8', 'tf9', 'tf10', 'tf11', 'tf12'],
			id2: ['tf6', 'tf7', 'tf9', 'tf10', 'tf11', 'tf12', 'tf13', 'tf14', 'tf15'],
			id3: []
		};

		textFieldCheck(textFields, visibilityMap);
	});

	it('Two Master pages text fields.', function() {
		before('two-mp-text-fields.odp');
		cy.wait(2000);

		var date = new Date().toLocaleDateString();

		var textFields = [
			{id: 'tf1', className: 'DateTime.Default', content: '01/01/2022'},
			{id: 'tf2', className: 'Footer.Default', content: 'master page footer'},
			{id: 'tf3', className: 'PageNumber.Default', content: '1'},
			{id: 'tf4', className: 'PageName.id17', content: 'Slide 1'},
			{id: 'tf5', className: 'PageName.id18', content: 'Slide 1'},
			{id: 'tf6', className: 'DateTime.id19', content: '01/01/2022'},
			{id: 'tf7', className: 'Footer.id20', content: 'master page footer'},
			{id: 'tf8', className: 'PageNumber.id21', content: '1'},
			{id: 'tf9', className: 'Date.id22', content: date},
			{id: 'tf10', className: 'Date.id23', content: date},
			{id: 'tf11', className: 'PageName.id17', content: 'Slide 2'},
			{id: 'tf12', className: 'PageName.id18', content: 'Slide 2'},
			{id: 'tf13', className: 'PageNumber.id21', content: '2'},
			{id: 'tf14', className: 'DateTime.Default', content: date},
			{id: 'tf15', className: 'Footer.Default', content: 'master page 2 footer'},
			{id: 'tf16', className: 'PageNumber.Default', content: '4'},
			{id: 'tf17', className: 'DateTime.id10', content: date},
			{id: 'tf18', className: 'Footer.id11', content: 'master page 2 footer'},
			{id: 'tf19', className: 'PageNumber.id12', content: '4'},
		];
		var visibilityMap = {
			id1: ['tf1', 'tf2', 'tf3', 'tf4', 'tf5', 'tf6', 'tf7', 'tf8', 'tf9', 'tf10'],
			id2: ['tf6', 'tf7', 'tf9', 'tf10', 'tf11', 'tf12', 'tf13'],
			id3: [],
			id4: ['tf14', 'tf15', 'tf16', 'tf17', 'tf18', 'tf19'],
		};

		textFieldCheck(textFields, visibilityMap);
	});
});
