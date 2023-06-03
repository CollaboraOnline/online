/* global cy expect*/

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

function type(text, times = 1) {
	var input = '';
	for (var i = 0; i < times; ++i) {
		input += text;
	}

	cy.log('Clipboard - typing start.');
	// cy.wait(50);
	cy.get('@clipboard').type(input, {delay: 10, force: true});
	cy.log('Clipboard - typing end.');
}

function moveCaret(direction, modifier = '', times = 1) {
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

function select(start, end) {
	moveCaret('home');
	moveCaret('right', '', start);
	if (start < end) {
		moveCaret('right', 'shift', end - start);
	}
	else if (start > end) {
		moveCaret('left', 'shift', start - end);
	}
}

function checkHTMLContent(content) {
	cy.wait(1000);
	cy.get('@clipboard').should(($c) => {
		expect($c).have.html($c.get(0)._wrapContent(content));
	});
}

function checkPlainContent(content) {
	cy.wait(1000);
	cy.get('@clipboard').should('have.text', content);
}

function checkSelectionRange(start, end) {
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

function checkCaretPosition(pos) {
	cy.wait(500);
	_checkSelectionStart(pos);
	_checkSelectionEnd(pos);
}

function checkSelectionIsNull() {
	cy.wait(500);
	cy.get('@clipboard').should('have.prop', 'isSelectionNull', true);
}

function checkSelectionIsEmpty(pos) {
	cy.wait(500);
	cy.get('@clipboard').should('have.prop', 'isSelectionNull', false);
	_checkSelectionStart(pos);
	_checkSelectionEnd(pos);
}

module.exports.type = type;
module.exports.moveCaret = moveCaret;
module.exports.select = select;
module.exports.checkHTMLContent = checkHTMLContent;
module.exports.checkPlainContent = checkPlainContent;
module.exports.checkSelectionRange = checkSelectionRange;
module.exports.checkCaretPosition = checkCaretPosition;
module.exports.checkSelectionIsNull = checkSelectionIsNull;
module.exports.checkSelectionIsEmpty = checkSelectionIsEmpty;
