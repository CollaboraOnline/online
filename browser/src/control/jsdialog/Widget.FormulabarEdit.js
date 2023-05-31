/* -*- js-indent-level: 8 -*- */
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
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global JSDialog */

function _sendSelection(edit, builder, id) {
	if (document.activeElement != edit)
		return;

	var currentText = edit.innerText;
	var selection = document.getSelection();
	var startPos = selection.anchorOffset;
	var endPos = selection.focusOffset;
	var startPara = 0;
	var endPara = 0;

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
	} else if (currentText.indexOf('\n') >= 0) {
		for (var i in edit.childNodes) {
			if (edit.childNodes[i] != selection.anchorNode) {
				if (edit.childNodes[i].tagName == 'BR') {
					startPara++;
				}
			} else {
				break;
			}
		}

		for (var i in edit.childNodes) {
			if (edit.childNodes[i] != selection.focusNode) {
				if (edit.childNodes[i].tagName == 'BR') {
					endPara++;
				}
			} else {
				break;
			}
		}
	}

	var selection = startPos + ';' + endPos + ';' + startPara + ';' + endPara;
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
	cursor.scrollIntoView();
}

function _setSelection(cursorLayer, text, startX, endX, startY, endY) {
	cursorLayer.innerHTML = '';

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
			_appendText(cursorLayer, line, '');
			_appendNewLine(cursorLayer);
		} else if (i == startY) {
			_appendText(cursorLayer, line.substr(0, startX), '');

			if (reversedSelection)
				_appendCursor(cursorLayer);

			_appendText(cursorLayer,
				line.substr(startX, startY == endY ? endX - startX : undefined),
				((startX != endX || startY != endY) ? 'selection' : ''));

			if (startY == endY) {
				if (!reversedSelection)
					_appendCursor(cursorLayer);

				_appendText(cursorLayer, line.substr(endX), '');
				_appendNewLine(cursorLayer);
			} else
				_appendNewLine(cursorLayer);
		} else if (i > startY && i < endY) {
			_appendText(cursorLayer, line, 'selection');
			_appendNewLine(cursorLayer);
		} else if (i == endY && endY != startY) {
			_appendText(cursorLayer, line.substr(0, endX), 'selection');
			if (!reversedSelection)
				_appendCursor(cursorLayer);
			_appendText(cursorLayer, line.substr(endX), '');
			_appendNewLine(cursorLayer);
		} else if (i > endY) {
			_appendText(cursorLayer, line, '');
			_appendNewLine(cursorLayer);
		}
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
		textLayer.innerText = text;

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
			_sendSelection(textLayer, builder, container.id);

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
