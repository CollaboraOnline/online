/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/*
 * JSDialog.FormulabarEdit - text field in the fromulabar
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'formulabaredit',
 *     test: 'text content\nsecond line',
 *     cursor: true,
 *     enabled: false
 * }
 *
 * 'cursor' specifies if user can type into the field or it is readonly
 * 'enabled' editable field can be temporarily disabled
 */

/* global JSDialog */

function _sendSelection(edit, builder, id, event) {
	if (document.activeElement != edit)
		return;

	var selection = document.getSelection();
	var startPos = 0;
	var anchorOffset = selection.anchorOffset;
	var endPos = 0;
	var focusOffset = selection.focusOffset;
	var startPara = 0;
	var endPara = 0;

	var startElement = selection.anchorNode;
	var endElement = selection.focusNode;

	if (!window.mode.isDesktop()) {
		var element = document.elementFromPoint(event.clientX, event.clientY);
		startElement = element;
		endElement = element;
		anchorOffset = 0;
		focusOffset = 0;
	}

	if (selection.anchorNode == edit) {
		startPos = endPos = 0;
		for (var i in edit.childNodes) {
			if (i == selection.anchorOffset)
				break;
			if (edit.childNodes[i].tagName == 'BR') {
				startPara++;
				endPara++;
			}
		}
	} else {
		for (var i in edit.childNodes) {
			if (edit.childNodes[i] != startElement && edit.childNodes[i].firstChild != startElement) {
				if (edit.childNodes[i].tagName == 'BR') {
					startPara++;
					startPos = 0;
				} else {
					startPos++;
				}
			} else {
				break;
			}
		}

		for (var i in edit.childNodes) {
			if (edit.childNodes[i] != endElement && edit.childNodes[i].firstChild != endElement) {
				if (edit.childNodes[i].tagName == 'BR') {
					endPara++;
					endPos = 0;
				} else {
					endPos++;
				}
			} else {
				break;
			}
		}
	}

	var selection = (startPos + anchorOffset) + ';' + (endPos + focusOffset) + ';' + startPara + ';' + endPara;
	builder.callback('edit', 'textselection', {id: id}, selection, builder);
}

function _appendText(cursorLayer, text, style) {
	var span = L.DomUtil.create('span', style);
	span.innerText = text;
	cursorLayer.appendChild(span);
}

function _appendNewLine(cursorLayer) {
	cursorLayer.appendChild(L.DomUtil.create('br', ''));
}

function _appendCursor(cursorLayer) {
	var cursor = L.DomUtil.create('span', 'cursor');
	cursorLayer.appendChild(cursor);
	return cursor;
}

function _setSelection(cursorLayer, text, startX, endX, startY, endY) {
	var newCursorLayer = document.createDocumentFragment();

	var reversedSelection = false;
	if (endY == startY && endX < startX) {
		reversedSelection = true;

		var tmp = startX;
		startX = endX;
		endX = tmp;
	}

	if (endY < startY) {
		reversedSelection = true;

		var tmp = startY;
		startY = endY;
		endY = tmp;

		tmp = startX;
		startX = endX;
		endX = tmp;
	}

	for (var i in text) {
		var line = text[i];

		if (i < startY) {
			_appendText(newCursorLayer, line, '');
			_appendNewLine(newCursorLayer);
		} else if (i == startY) {
			_appendText(newCursorLayer, line.substr(0, startX), '');

			if (reversedSelection)
				var cursor = _appendCursor(newCursorLayer);

			_appendText(newCursorLayer,
				line.substr(startX, startY == endY ? endX - startX : undefined),
				((startX != endX || startY != endY) ? 'selection' : ''));

			if (startY == endY) {
				if (!reversedSelection)
					cursor = _appendCursor(newCursorLayer);

				_appendText(newCursorLayer, line.substr(endX), '');
				_appendNewLine(newCursorLayer);
			} else
				_appendNewLine(newCursorLayer);
		} else if (i > startY && i < endY) {
			_appendText(newCursorLayer, line, 'selection');
			_appendNewLine(newCursorLayer);
		} else if (i == endY && endY != startY) {
			_appendText(newCursorLayer, line.substr(0, endX), 'selection');
			if (!reversedSelection)
				cursor = _appendCursor(newCursorLayer);
			_appendText(newCursorLayer, line.substr(endX), '');
			_appendNewLine(newCursorLayer);
		} else if (i > endY) {
			_appendText(newCursorLayer, line, '');
			_appendNewLine(newCursorLayer);
		}
	}

	cursorLayer.textContent = '';
	cursorLayer.appendChild(newCursorLayer);

	// possible after cursor is added to the DOM
	if (cursor) {
		var blockOption = JSDialog._scrollIntoViewBlockOption('nearest');
		cursor.scrollIntoView({behavior: 'smooth', block: blockOption, inline: 'nearest'});
	}
}

function _formulabarEditControl(parentContainer, data, builder) {
	var container = L.DomUtil.create('div', 'ui-custom-textarea ' + builder.options.cssClass, parentContainer);
	container.id = data.id;

	var textLayer = L.DomUtil.create('div', 'ui-custom-textarea-text-layer ' + builder.options.cssClass, container);

	if (data.enabled !== false)
		textLayer.setAttribute('contenteditable', 'true');

	var cursorLayer = L.DomUtil.create('div', 'ui-custom-textarea-cursor-layer ' + builder.options.cssClass, container);

	container.setText = function(text, selection) {
		var newTextLayer = document.createDocumentFragment();
		for (var c = 0; c < text.length; c++) {
			if (text[c] == '\n')
				_appendNewLine(newTextLayer);
			else
				_appendText(newTextLayer, text[c], '');
		}

		textLayer.textContent = '';
		textLayer.appendChild(newTextLayer);

		var startX = parseInt(selection[0]);
		var endX = parseInt(selection[1]);
		var startY = parseInt(selection[2]);
		var endY = parseInt(selection[3]);

		text = text.split('\n');

		_setSelection(cursorLayer, text, startX, endX, startY, endY);
	};

	container.enable = function() {
		L.DomUtil.removeClass(container, 'disabled');
		textLayer.setAttribute('contenteditable', 'true');
	};
	container.disable = function() {
		L.DomUtil.addClass(container, 'disabled');
		textLayer.setAttribute('contenteditable', 'false');
	};

	['click', 'dblclick'].forEach(function (ev) {
		textLayer.addEventListener(ev, function(event) {
			if (L.DomUtil.hasClass(container, 'disabled')) {
				event.preventDefault();
				return;
			}

			builder.callback('edit', 'grab_focus', container, null, builder);
			_sendSelection(textLayer, builder, container.id, event);

			builder.map.setWinId(0);
			builder.map._textInput._emptyArea();
			builder.map._textInput.focus(true);

			event.preventDefault();
		});
	});

	// hide old selection when user starts to select something else
	textLayer.addEventListener('mousedown', function() {
		cursorLayer.querySelectorAll('.selection').forEach(function (element) {
			L.DomUtil.addClass(element, 'hidden');
		});

		var cursor = cursorLayer.querySelector('.cursor');
		if (cursor)
			L.DomUtil.addClass(cursor, 'hidden');
	});

	var text = builder._cleanText(data.text);
	container.setText(text, [0, 0, 0, 0]);

	if (data.enabled === false)
		L.DomUtil.addClass(container, 'disabled');

	if (data.hidden)
		L.DomUtil.addClass(container, 'hidden');

	return false;
}

JSDialog.formulabarEdit = function (parentContainer, data, builder) {
	var buildInnerData = _formulabarEditControl(parentContainer, data, builder);
	return buildInnerData;
};
