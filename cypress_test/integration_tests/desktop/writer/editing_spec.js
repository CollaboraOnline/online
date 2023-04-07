/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
// var repairHelper = require('../../common/repair_document_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Clipboard Editing', function() {
	var testFileName = 'undo_redo.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
		cy.cGet('div.clipboard').as('clipboard');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function _checkSelectionStart(value) {
		cy.get('@clipboard').should(($c) => {
			expect($c.get(0)._getSelectionStart()).to.eq(value);
		});
	}

	function _checkSelectionEnd(value) {
		cy.get('@clipboard').should(($c) => {
			expect($c.get(0)._getSelectionEnd()).to.eq(value);
		});
	}

	function getBlinkingCursorPosition(aliasName) {
		var cursorSelector = '.cursor-overlay .blinking-cursor';
		cy.cGet(cursorSelector).then(function(cursor) {
			var boundRect = cursor[0].getBoundingClientRect();
			var xPos = boundRect.right;
			var yPos = (boundRect.top + boundRect.bottom) / 2;
			cy.wrap({x: xPos, y: yPos}).as(aliasName);
		});

		cy.get('@' + aliasName).then(point => {
			expect(point.x).to.be.greaterThan(0);
			expect(point.y).to.be.greaterThan(0);
		});
	}

	function clickAt(aliasName, double = false) {
		cy.get('@' + aliasName).then(point => {
			expect(point.x).to.be.greaterThan(0);
			expect(point.y).to.be.greaterThan(0);
			if (double) {
				cy.cGet('body').dblclick(point.x, point.y);
			} else {
				cy.cGet('body').click(point.x, point.y);
			}
		});
	}

	function clipboardType(text, times = 1) {
		var input = '';
		for (var i = 0; i < times; ++i) {
			input += text;
		}

		cy.log('Clipboard - typing start.');
		// cy.wait(50);
		cy.get('@clipboard').type(input, {delay: 10, force: true});
		cy.log('Clipboard - typing end.');
	}

	function clipboardMoveCaret(direction, modifier = '', times = 1) {
		cy.log('Clipboard - moving caret start');
		cy.log('  Param - direction: ' + direction);
		if (modifier)
			cy.log('  Param - modifier: ' + modifier);
		if (times > 1)
			cy.log('  Param - times: ' + times);

		var dirKey = '';
		if (direction === 'up') {
			dirKey = '{uparrow}';
		} else if (direction === 'down') {
			dirKey = '{downarrow}';
		} else if (direction === 'left') {
			dirKey = '{leftarrow}';
		} else if (direction === 'right') {
			dirKey = '{rightarrow}';
		} else if (direction === 'home') {
			dirKey = '{home}';
		} else if (direction === 'end') {
			dirKey = '{end}';
		} else if (direction === 'pgup') {
			dirKey = '{pageUp}';
		} else if (direction === 'pgdown') {
			dirKey = '{pageDown}';
		}

		var key = '';
		for (var i = 0; i < times; ++i) {
			key += dirKey;
		}
		if (modifier === 'ctrl') {
			key = '{ctrl}' + key;
		} else if (modifier === 'shift') {
			key = '{shift}' + key;
		}

		cy.get('@clipboard').type(key, {delay: 10, force: true});
		cy.log('Clipboard - moving caret end');
	}

	function clipboardSelect(start, end) {
		clipboardMoveCaret('home');
		clipboardMoveCaret('right', '', start);
		if (start < end) {
			clipboardMoveCaret('right', 'shift', end - start);
		}
		else if (start > end) {
			clipboardMoveCaret('left', 'shift', start - end);
		}
	}

	function clipboardCheckHTMLContent(content) {
		cy.wait(1000);
		cy.get('@clipboard').should(($c) => {
			expect($c).have.html($c.get(0)._wrapContent(content));
		});
	}

	function clipboardCheckPlainContent(content) {
		cy.wait(1000);
		cy.get('@clipboard').should('have.text', content);
	}

	function clipboardCheckSelectionRange(start, end) {
		if (start > end) {
			var t = start;
			start = end;
			end = t;
		}
		cy.wait(500);
		cy.get('@clipboard').should('have.prop', 'isSelectionNull', false);
		_checkSelectionStart(start);
		_checkSelectionEnd(end);
	}

	function clipboardCheckCaretPosition(pos) {
		cy.wait(500);
		_checkSelectionStart(pos);
		_checkSelectionEnd(pos);
	}

	function clipboardCheckSelectionIsNull() {
		cy.wait(500);
		cy.get('@clipboard').should('have.prop', 'isSelectionNull', true);
	}

	function clipboardCheckSelectionIsEmpty(pos) {
		cy.wait(500);
		cy.get('@clipboard').should('have.prop', 'isSelectionNull', false);
		_checkSelectionStart(pos);
		_checkSelectionEnd(pos);
	}

	it('Typing in an empty paragraph', function() {
		// initial position
		clipboardCheckHTMLContent('');
		clipboardCheckCaretPosition(0);
		// typing
		// clipboardType('Hello World');
		// clipboardCheckHTMLContent('Hello World');
		// clipboardCheckCaretPosition(11);

		clipboardType('H');
		clipboardCheckHTMLContent('H');
		clipboardCheckCaretPosition(1);
	});

	it('Typing <backspace> in an empty paragraph', function() {
		// initial position
		clipboardCheckHTMLContent('');
		clipboardCheckCaretPosition(0);
		// typing
		clipboardType('{backspace}');
		clipboardCheckHTMLContent('');
		clipboardCheckCaretPosition(0);
	});

	it('Typing <delete> in an empty paragraph', function() {
		// initial position
		clipboardCheckHTMLContent('');
		clipboardCheckCaretPosition(0);
		// typing
		clipboardType('{del}');
		clipboardCheckHTMLContent('');
		clipboardCheckCaretPosition(0);
	});

	it('Moving inside paragraph', function() {
		// initial position
		clipboardCheckHTMLContent('');
		clipboardCheckCaretPosition(0);
		// typing
		clipboardType('Hello World');
		clipboardCheckHTMLContent('Hello World');
		clipboardCheckCaretPosition(11);
		// move left
		clipboardMoveCaret('left', '', 5);
		clipboardCheckCaretPosition(6);
		getBlinkingCursorPosition('P');
		// try to move beyond paragraph begin
		clipboardMoveCaret('home');
		clipboardCheckCaretPosition(0);
		clipboardMoveCaret('left');
		clipboardCheckCaretPosition(0);
		// move right
		clipboardMoveCaret('right', '', 2);
		clipboardCheckCaretPosition(2);
		// try to move beyond paragraph end
		clipboardMoveCaret('end');
		clipboardCheckCaretPosition(11);
		clipboardMoveCaret('right');
		clipboardCheckCaretPosition(11);
		// click on text
		clickAt('P');
		clipboardCheckCaretPosition(6);
	});

	it('Moving between paragraphs', function() {
		// typing paragraph 1
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		// paragraph 2 (empty)
		clipboardType('{enter}');
		clipboardCheckPlainContent('');
		// paragraph 3 (empty)
		clipboardType('{enter}');
		clipboardCheckPlainContent('');
		getBlinkingCursorPosition('P1');
		// typing paragraph 4
		clipboardType('{enter}');
		clipboardType('green red');
		clipboardCheckPlainContent('green red');
		clipboardMoveCaret('left', '', 4);
		clipboardCheckCaretPosition(5);
		getBlinkingCursorPosition('P2');
		// move up to paragraph 3
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('');
		clipboardCheckCaretPosition(0);
		// move back to paragraph 4
		clipboardMoveCaret('down');
		clipboardCheckPlainContent('green red');
		clipboardCheckCaretPosition(5);
		// move up to paragraph 1
		clipboardMoveCaret('up', '', 3);
		clipboardCheckPlainContent('Hello World');
		// click on paragraph 3
		clickAt('P1');
		clipboardCheckPlainContent('');
		clipboardCheckCaretPosition(0);
		// click on paragraph 4
		clickAt('P2');
		clipboardCheckPlainContent('green red');
		clipboardCheckCaretPosition(5);
		// try to move beyond last paragraph
		clipboardMoveCaret('down');
		clipboardCheckPlainContent('green red');
		clipboardCheckCaretPosition(9);
		// try to move beyond first paragraph
		clipboardMoveCaret('up', '', 4);
		clipboardCheckPlainContent('Hello World');
		clipboardCheckCaretPosition(0);
	});

	it('Typing at paragraph beginning', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardMoveCaret('home');
		clipboardCheckCaretPosition(0);
		clipboardType('k');
		clipboardCheckHTMLContent('kHello World');
		clipboardCheckCaretPosition(1);
	});

	it('Typing <delete> at paragraph beginning', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardMoveCaret('home');
		clipboardCheckCaretPosition(0);
		clipboardType('{del}');
		clipboardCheckHTMLContent('ello World');
		clipboardCheckCaretPosition(0);
	});

	it('Typing <enter>', function() {
		// typing 4 paragraphs
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardType('{enter}');
		clipboardCheckPlainContent('');
		clipboardType('{enter}');
		clipboardCheckPlainContent('');
		clipboardType('{enter}');
		clipboardType('green red');
		clipboardCheckPlainContent('green red');
		// move current paragraph one line below
		clipboardMoveCaret('home');
		clipboardType('{enter}');
		clipboardCheckPlainContent('green red');
		// move to first paragraph
		clipboardMoveCaret('up', '', 4);
		// split paragraph
		clipboardMoveCaret('right', '', 5);
		clipboardType('{enter}');
		clipboardCheckPlainContent(' World');
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('Hello');
	});

	it('Typing <backspace>', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardType('{enter}');
		// delete empty paragraph
		clipboardType('{enter}');
		clipboardType('{backspace}');
		clipboardCheckPlainContent('');
		clipboardCheckCaretPosition(0);
		// type new paragraph
		clipboardType('{enter}');
		clipboardType('green red');
		// move paragraph one line above
		clipboardMoveCaret('home');
		clipboardType('{backspace}');
		clipboardCheckPlainContent('green red');
		clipboardCheckCaretPosition(0);
		// merge with above paragraph
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Hello Worldgreen red');
		clipboardCheckCaretPosition(11);
		// try to delete beyond first paragraph begin
		clipboardMoveCaret('home');
		clipboardType('{backspace}');
		clipboardCheckHTMLContent('Hello Worldgreen red');
		clipboardCheckCaretPosition(0);
		// type after <backspace> at paragraph begin
		clipboardType('k');
		clipboardCheckHTMLContent('kHello Worldgreen red');
		clipboardCheckCaretPosition(1);
	});

	it('Typing <delete>', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardType('{enter}');
		// delete empty paragraph
		clipboardType('{enter}');
		clipboardMoveCaret('up');
		clipboardType('{del}');
		clipboardCheckPlainContent('');
		clipboardCheckCaretPosition(0);
		// type new paragraph
		clipboardType('{enter}');
		clipboardType('green red');
		// delete empty paragraph
		clipboardType('{enter}');
		clipboardMoveCaret('up');
		clipboardMoveCaret('end');
		clipboardType('{del}');
		clipboardCheckPlainContent('green red');
		clipboardCheckCaretPosition(9);
		// move paragraph one line above
		clipboardMoveCaret('up');
		clipboardType('{del}');
		clipboardCheckPlainContent('green red');
		clipboardCheckCaretPosition(0);
		// merge with above paragraph
		clipboardMoveCaret('up');
		clipboardMoveCaret('end');
		clipboardType('{del}');
		clipboardCheckPlainContent('Hello Worldgreen red');
		clipboardCheckCaretPosition(11);
		// try to delete beyond paragraph end
		clipboardMoveCaret('end');
		clipboardType('{del}');
		clipboardCheckHTMLContent('Hello Worldgreen red');
		clipboardCheckCaretPosition(20);
		// type after <delete> at paragraph end
		clipboardType('k');
		clipboardCheckHTMLContent('Hello Worldgreen redk');
		clipboardCheckCaretPosition(21);
	});

	it('Preserving spaces', function() {
		clipboardType('Hello     World   ');
		clipboardCheckPlainContent('Hello     World   ');
		clipboardType('{enter}');
		clipboardType('   ');
		clipboardCheckPlainContent('   ');
		// check that spaces are preserved when moving between paragraphs
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('Hello     World   ');
		// check that spaces are preserved after a <backspace>
		clipboardMoveCaret('end');
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Hello     World  ');
		// check that spaces are preserved after a <delete>
		clipboardMoveCaret('down');
		clipboardCheckPlainContent('   ');
		clipboardMoveCaret('home');
		clipboardType('{del}');
		clipboardCheckPlainContent('  ');
		// check that spaces are preserved after a paragraph splitting
		clipboardMoveCaret('up');
		clipboardMoveCaret('right', '', 7);
		clipboardType('{enter}');
		clipboardCheckPlainContent('   World  ');
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('Hello  ');
		// check that spaces are preserved after a paragraph merging (<backspace>)
		clipboardMoveCaret('down');
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Hello     World  ');
		// check that spaces are preserved after a paragraph merging (<delete>)
		clipboardType('{enter}');
		clipboardMoveCaret('up');
		clipboardMoveCaret('end');
		clipboardType('{del}');
		clipboardCheckPlainContent('Hello     World  ');
	});

	it('Preserving <tab>s', function() {
		clipboardType('Hello\t\tWorld\t\t');
		clipboardCheckPlainContent('Hello\t\tWorld\t\t');
		clipboardType('{enter}');
		clipboardType('\t\t');
		clipboardCheckPlainContent('\t\t');
		// check that tabs are preserved when moving between paragraphs
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('Hello\t\tWorld\t\t');
		// check that tabs are preserved after a <backspace>
		clipboardMoveCaret('end');
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Hello\t\tWorld\t');
		// check that tabs are preserved after a <delete>
		clipboardMoveCaret('down');
		clipboardCheckPlainContent('\t\t');
		clipboardMoveCaret('home');
		clipboardType('{del}');
		clipboardCheckPlainContent('\t');
		// check that tabs are preserved after a paragraph splitting
		clipboardMoveCaret('up');
		clipboardMoveCaret('right', '', 6);
		clipboardType('{enter}');
		clipboardCheckPlainContent('\tWorld\t');
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('Hello\t');
		// check that tabs are preserved after a paragraph merging (<backspace>)
		clipboardMoveCaret('down');
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Hello\t\tWorld\t');
		// check that tabs are preserved after a paragraph merging (<delete>)
		clipboardType('{enter}');
		clipboardMoveCaret('up');
		clipboardMoveCaret('end');
		clipboardType('{del}');
		clipboardCheckPlainContent('Hello\t\tWorld\t');
	});

	it('Preserving line breaks', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardMoveCaret('left', '', 6);
		clipboardType('{shift+enter}');
		clipboardCheckPlainContent('Hello\n World');
		clipboardCheckCaretPosition(6);
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Hello World');
		clipboardType('{shift+enter}');
		clipboardMoveCaret('left');
		clipboardType('{del}');
		clipboardCheckPlainContent('Hello World');
	});

	it('Selecting inside paragraph', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		// select left-word
		clipboardMoveCaret('left', 'shift', 5);
		clipboardCheckSelectionRange(11, 6);
		clipboardMoveCaret('right');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(7);
		getBlinkingCursorPosition('P');
		// select right-ward
		clipboardMoveCaret('right', 'shift', 4);
		clipboardCheckSelectionRange(7, 11);
		clipboardMoveCaret('left');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(10);
		// select from end to start
		clipboardMoveCaret('end');
		clipboardMoveCaret('home', 'shift');
		clipboardCheckSelectionRange(11, 0);
		// clear selection with a click
		clickAt('P');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(7);
		// select 'World' by a double click
		clickAt('P', true);
		clipboardCheckSelectionRange(6, 11);
		// check empty selection
		clipboardMoveCaret('left', 'shift', 5);
		clipboardCheckSelectionIsEmpty(6);
		clipboardMoveCaret('left', 'shift');
		clipboardCheckSelectionRange(5, 6);
		clipboardMoveCaret('right', 'shift');
		clipboardCheckSelectionIsEmpty(6);
	});

	it('Deselect a selection ending at the end of the paragraph', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardSelect(6,11);
		clipboardMoveCaret('right');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(11);
	});

	it('Typing with selection inside paragraph', function() {
		clipboardType('Green and red');
		clipboardCheckPlainContent('Green and red');
		// type in a right-ward selection
		clipboardSelect(6,9);
		clipboardType('o');
		clipboardCheckPlainContent('Green o red');
		clipboardCheckCaretPosition(7);
		clipboardCheckSelectionIsNull();
		clipboardType('r');
		// type in a left-ward selection
		clipboardSelect(8,6);
		clipboardType('a');
		clipboardCheckPlainContent('Green a red');
		clipboardCheckCaretPosition(7);
		clipboardCheckSelectionIsNull();
		clipboardType('nd');
		// type the same char, the selection starts with
		clipboardSelect(6,9);
		clipboardType('a');
		clipboardCheckPlainContent('Green a red');
		clipboardCheckCaretPosition(7);
		clipboardCheckSelectionIsNull();
	});

	it('Typing <enter> with selection inside paragraph', function() {
		clipboardType('Green and red');
		clipboardCheckPlainContent('Green and red');
		// type <enter> in a right-ward selection
		clipboardSelect(6,9);
		clipboardType('{enter}');
		clipboardCheckPlainContent(' red');
		clipboardCheckCaretPosition(0);
		clipboardCheckSelectionIsNull();
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('Green ');
		clipboardMoveCaret('end');
		clipboardType('and');
		clipboardType('{del}');
		clipboardCheckPlainContent('Green and red');
		// type <enter> in a left-ward selection
		clipboardSelect(9,6);
		clipboardType('{enter}');
		clipboardCheckPlainContent(' red');
		clipboardCheckCaretPosition(0);
		clipboardCheckSelectionIsNull();
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('Green ');
	});

	it('Typing <backspace> with selection inside paragraph', function() {
		clipboardType('Green and red');
		clipboardCheckPlainContent('Green and red');
		// type <backspace> in a right-ward selection
		clipboardSelect(6,9);
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Green  red');
		clipboardCheckCaretPosition(6);
		clipboardCheckSelectionIsNull();
		clipboardType('and');
		// type <backspace> in a left-ward selection
		clipboardSelect(9,6);
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Green  red');
		clipboardCheckCaretPosition(6);
		clipboardCheckSelectionIsNull();
	});

	it('Typing <delete> with selection inside paragraph', function() {
		clipboardType('Green and red');
		clipboardCheckPlainContent('Green and red');
		// type <delete> in a right-ward selection
		clipboardSelect(6,9);
		clipboardType('{del}');
		clipboardCheckPlainContent('Green  red');
		clipboardCheckCaretPosition(6);
		clipboardCheckSelectionIsNull();
		clipboardType('and');
		// type <delete> in a left-ward selection
		clipboardSelect(9,6);
		clipboardType('{del}');
		clipboardCheckPlainContent('Green  red');
		clipboardCheckCaretPosition(6);
		clipboardCheckSelectionIsNull();
	});

	it('Selection starts in previous paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardCheckPlainContent('Green red');
		clipboardMoveCaret('up', '', 2);
		clipboardMoveCaret('home');
		clipboardMoveCaret('right', '', 5);
		clipboardMoveCaret('right', 'shift', 13);
		clipboardCheckPlainContent('Green red');
		clipboardCheckSelectionRange(0, 5);
	});

	it('Typing with selection starting in previous paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('up', '', 2);
		clipboardMoveCaret('home');
		clipboardMoveCaret('right', '', 5);
		clipboardMoveCaret('right', 'shift', 13);
		clipboardType('s');
		clipboardCheckPlainContent('Hellos red');
		clipboardCheckSelectionIsNull();
		// TODO: this fails, we skip the old text content but not the old caret position
		clipboardCheckCaretPosition(6);
	});

	it('Typing <enter> with selection starting in previous paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('up', '', 2);
		clipboardMoveCaret('home');
		clipboardMoveCaret('right', '', 5);
		clipboardMoveCaret('right', 'shift', 13);
		clipboardType('{enter}');
		clipboardCheckPlainContent(' red');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(0);
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('Hello');
	});

	it('Typing <backspace> with selection starting in previous paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('up', '', 2);
		clipboardMoveCaret('home');
		clipboardMoveCaret('right', '', 5);
		clipboardMoveCaret('right', 'shift', 13);
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Hello red');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(5);
	});

	it('Typing <delete> with selection starting in previous paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('up', '', 2);
		clipboardMoveCaret('home');
		clipboardMoveCaret('right', '', 5);
		clipboardMoveCaret('right', 'shift', 13);
		clipboardType('{del}');
		clipboardCheckPlainContent('Hello red');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(5);
	});

	it('Selection ends in next paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardCheckPlainContent('Green red');
		clipboardMoveCaret('left', '', 3);
		clipboardMoveCaret('left', 'shift', 13);
		clipboardCheckPlainContent('Hello World');
		clipboardCheckSelectionRange(6, 11);
	});

	it('Typing with selection ending in next paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('left', '', 3);
		clipboardMoveCaret('left', 'shift', 13);
		clipboardType('b');
		clipboardCheckPlainContent('Hello bred');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(7);
	});

	it('Typing <enter> with selection ending in next paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('left', '', 3);
		clipboardMoveCaret('left', 'shift', 13);
		clipboardType('{enter}');
		clipboardCheckPlainContent('red');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(0);
		clipboardMoveCaret('up');
		clipboardCheckPlainContent('Hello ');
	});

	it('Typing <backspace> with selection ending in next paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('left', '', 3);
		clipboardMoveCaret('left', 'shift', 13);
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Hello red');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(6);
	});

	it('Typing <delete> with selection ending in next paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('left', '', 3);
		clipboardMoveCaret('left', 'shift', 13);
		clipboardType('{del}');
		clipboardCheckPlainContent('Hello red');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(6);
	});

	it('Typing <backspace> with empty selection', function() {
		clipboardType('Green red');
		clipboardCheckPlainContent('Green red');
		clipboardSelect(6,7);
		clipboardMoveCaret('left', 'shift');
		clipboardCheckSelectionIsEmpty(6);
		clipboardType('or ');
		clipboardCheckSelectionIsEmpty(9);
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Green orred');
		clipboardCheckCaretPosition(8);
		clipboardCheckSelectionIsNull();
		clipboardSelect(7,6);
		clipboardMoveCaret('right', 'shift');
		clipboardCheckSelectionIsEmpty(7);
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Green rred');
		clipboardCheckCaretPosition(6);
		clipboardCheckSelectionIsNull();
	});

	it('Typing <backspace> with empty selection at the start of the paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('home');
		clipboardMoveCaret('right', 'shift');
		clipboardMoveCaret('left', 'shift');
		clipboardCheckPlainContent('Green red');
		clipboardCheckSelectionIsEmpty(0);
		clipboardType('{backspace}');
		clipboardCheckPlainContent('Hello WorldGreen red');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(11);
	});

	it('Typing <delete> with empty selection', function() {
		clipboardType('Green red');
		clipboardCheckPlainContent('Green red');
		clipboardSelect(6,7);
		clipboardMoveCaret('left', 'shift');
		clipboardCheckSelectionIsEmpty(6);
		clipboardType('or ');
		clipboardCheckSelectionIsEmpty(9);
		clipboardType('{del}');
		clipboardCheckPlainContent('Green or ed');
		clipboardCheckCaretPosition(9);
		clipboardCheckSelectionIsNull();
		clipboardSelect(7,6);
		clipboardMoveCaret('right', 'shift');
		clipboardCheckSelectionIsEmpty(7);
		clipboardType('{del}');
		clipboardCheckPlainContent('Green o ed');
		clipboardCheckCaretPosition(7);
		clipboardCheckSelectionIsNull();
	});

	it('Typing <delete> with empty selection at the end of the paragraph', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('up');
		clipboardMoveCaret('end');
		clipboardMoveCaret('left', 'shift');
		clipboardMoveCaret('right', 'shift');
		clipboardCheckPlainContent('Hello World');
		clipboardCheckSelectionIsEmpty(11);
		clipboardType('{del}');
		clipboardCheckPlainContent('Hello WorldGreen red');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(11);
	});

	it('Undo/Redo after typing', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardType('{ctrl+z}');
		clipboardCheckPlainContent('Hello ');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(6);
		clipboardType('{ctrl+y}');
		clipboardCheckPlainContent('Hello World');
		clipboardCheckSelectionRange(6, 11);
		clipboardMoveCaret('end');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('up');
		clipboardType('{ctrl+z}');
		clipboardCheckPlainContent('Green ');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(6);
		clipboardMoveCaret('up');
		clipboardType('{ctrl+y}');
		clipboardCheckPlainContent('Green red');
		clipboardCheckSelectionRange(6, 9);
	});

	it('Undo/Redo after <enter>', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardMoveCaret('left', '', 6);
		clipboardType('{enter}');
		clipboardCheckPlainContent(' World');
		clipboardType('{ctrl+z}');
		clipboardCheckPlainContent('Hello World');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(5);
		clipboardType('{ctrl+y}');
		clipboardCheckPlainContent(' World');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(0);
	});

	it('Undo/Redo after <backspace>', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardType('{backspace}', 5);
		clipboardCheckPlainContent('Hello ');
		clipboardType('{ctrl+z}');
		clipboardCheckPlainContent('Hello World');
		clipboardCheckSelectionRange(6, 11);
		clipboardType('{ctrl+y}');
		clipboardCheckPlainContent('Hello ');
		clipboardCheckSelectionIsEmpty(6);
	});

	it('Undo/Redo after <delete>', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardMoveCaret('left', '', 5);
		clipboardType('{del}', 5);
		clipboardCheckPlainContent('Hello ');
		clipboardType('{ctrl+z}');
		clipboardCheckPlainContent('Hello World');
		clipboardCheckSelectionRange(6, 11);
		clipboardType('{ctrl+y}');
		clipboardCheckPlainContent('Hello ');
		clipboardCheckSelectionIsEmpty(6);
	});

	it('Typing after undo command', function() {
		clipboardType('Hello World');
		clipboardCheckPlainContent('Hello World');
		clipboardType('{ctrl+z}');
		// After undo/redo client makes an explicit request for a new version of current paragraph.
		// So we need to skip to send new input to core until client receives the updated content.
		// So let's do a tiny wait before starting typing.
		// cy.wait(50);
		clipboardType('Duck');
		clipboardCheckPlainContent('Hello Duck');
		clipboardCheckSelectionIsNull();
		clipboardCheckCaretPosition(10);
	});

	it('Typing after click', function() {
		clipboardType('Hello World');
		clipboardMoveCaret('left', '', 5);
		getBlinkingCursorPosition('P');
		clipboardMoveCaret('end');
		clipboardType(' again');
		clickAt('P');
		clipboardType('red');
		clipboardCheckPlainContent('Hello redWorld again');
		clipboardCheckCaretPosition(9);
	});

	it('Typing after <delete>', function() {
		clipboardType('Hello World');
		clipboardMoveCaret('left', '', 5);
		clipboardType('{del}', 4);
		clipboardType('moo');
		clipboardCheckPlainContent('Hello mood');
		clipboardCheckCaretPosition(9);
	});

	it('Typing after <enter> at beginning of the line', function() {
		clipboardType('Hello World');
		clipboardMoveCaret('home');
		clipboardType('{enter}', 3);
		clipboardType('Green ');
		clipboardCheckPlainContent('Green Hello World');
		clipboardCheckCaretPosition(6);
	});

	it('Typing after <backspace> at beginning of the line', function() {
		clipboardType('Hello World');
		clipboardType('{enter}', 3);
		clipboardType('Green and red');
		clipboardMoveCaret('home');
		clipboardType('{backspace}', 3);
		clipboardType(' Yellow ');
		clipboardCheckPlainContent('Hello World Yellow Green and red');
		clipboardCheckCaretPosition(19);
	});

		// It fails, no copy/paste command is emitted by the client
	it.skip('Copy/Paste', function() {
		clipboardType('Hello World');
		clipboardType('{enter}');
		clipboardType('Green red');
		clipboardMoveCaret('up');
		clipboardSelect(6, 11);
		clipboardType('{ctrl+c}');
		clipboardCheckPlainContent('Hello World');
		clipboardCheckSelectionRange(6, 11);
		clipboardMoveCaret('down');
		clipboardMoveCaret('end');
		clipboardType('{ctrl+v}');
		clipboardCheckPlainContent('Green redWorld');
	});

});
