/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.MultilineEdit - text field with multiple lines and scrollbar
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'multilineedit',
 *     test: 'text content\nsecond line',
 *     useTextInput: true,
 *     rawKeyEvents: false,
 *     cursor: true,
 *     enabled: false
 * }
 * 
 * 'useTextInput' instead of typing into field, key events are sent using L.TextInput
 * 'rawKeyEvents' instead of typing into field, key events are sent only to the server using jsdialog events
 * 'cursor' specifies if user can type into the field or it is readonly
 * 'enabled' editable field can be temporarily disabled
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global JSDialog UNOKey UNOModifier */

function _sendSelection(edit, builder) {
	var currentText = edit.value;
	var startPos = edit.selectionStart;
	var endPos = edit.selectionEnd;
	var startPara = 0;
	var endPara = 0;

	if (currentText.indexOf('\n') >= 0) {
		var currentPos = 0;
		var found = currentText.indexOf('\n', currentPos);
		while (startPos > found) {
			if (found === -1)
				break;
			currentPos = found + 1;
			startPara++;
			found = currentText.indexOf('\n', currentPos);
		}

		startPos -= currentPos;

		currentPos = 0;
		found = currentText.indexOf('\n', currentPos);
		while (endPos > found) {
			if (found === -1)
				break;
			currentPos = found + 1;
			endPara++;
			found = currentText.indexOf('\n', currentPos);
		}

		endPos -= currentPos;
	}

	var selection = startPos + ';' + endPos + ';' + startPara + ';' + endPara;
	builder.callback('edit', 'textselection', edit, selection, builder);
}

function _multiLineEditControl(parentContainer, data, builder, callback) {
	var controlType = 'textarea';
	if (data.cursor && (data.cursor === 'false' || data.cursor === false))
		controlType = 'p';

	var edit = L.DomUtil.create(controlType, 'ui-textarea ' + builder.options.cssClass, parentContainer);

	if (controlType === 'textarea')
		edit.value = builder._cleanText(data.text);
	else
	{
		data.text = data.text.replace(/(?:\r\n|\r|\n)/g, '<br>');
		edit.textContent = builder._cleanText(data.text);
	}

	edit.id = data.id;

	if (data.enabled === 'false' || data.enabled === false)
		edit.disabled = true;

	// todo: change -> keyup to provide real-time updates
	edit.addEventListener('change', function() {
		if (callback)
			callback(this.value);
		if (data.rawKeyEvents || data.useTextInput) {
			// here event.keyCode has some non-ascii code
		} else
			builder.callback('edit', 'change', edit, this.value, builder);
	});

	if (data.useTextInput) {
		// uses TextInput.js logic and events handling (IME for mobile/touch devices)
		edit.addEventListener('input', builder.map._textInput._onInput.bind(builder.map._textInput));
		edit.addEventListener('beforeinput', builder.map._textInput._onBeforeInput.bind(builder.map._textInput));
	} else if (data.rawKeyEvents) {
		// sends key events over jsdialog
		var modifier = 0;

		edit.addEventListener('keydown', function(event) {
			if (edit.disabled) {
				event.preventDefault();
				return;
			}

			if (event.key === 'Enter') {
				builder.callback('edit', 'keypress', edit, UNOKey.RETURN | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'Escape' || event.key === 'Esc') {
				builder.callback('edit', 'keypress', edit, UNOKey.ESCAPE | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'Left' || event.key === 'ArrowLeft') {
				builder.callback('edit', 'keypress', edit, UNOKey.LEFT | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'Right' || event.key === 'ArrowRight') {
				builder.callback('edit', 'keypress', edit, UNOKey.RIGHT | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'Up' || event.key === 'ArrowUp') {
				setTimeout(function () { _sendSelection(edit, builder); }, 0);
			} else if (event.key === 'Down' || event.key === 'ArrowDown') {
				setTimeout(function () { _sendSelection(edit, builder); }, 0);
			} else if (event.key === 'Home') {
				builder.callback('edit', 'keypress', edit, UNOKey.HOME | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'End') {
				builder.callback('edit', 'keypress', edit, UNOKey.END | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'Backspace') {
				builder.callback('edit', 'keypress', edit, UNOKey.BACKSPACE | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'Delete') {
				builder.callback('edit', 'keypress', edit, UNOKey.DELETE | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'Space') {
				builder.callback('edit', 'keypress', edit, UNOKey.SPACE | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'Tab') {
				builder.callback('edit', 'keypress', edit, UNOKey.TAB | modifier, builder);
				event.preventDefault();
			} else if (event.key === 'Shift') {
				modifier = modifier | UNOModifier.SHIFT;
				event.preventDefault();
			} else if (event.key === 'Control') {
				modifier = modifier | UNOModifier.CTRL;
				event.preventDefault();
			} else if (event.key === 'a' && event.ctrlKey) {
				builder.callback('edit', 'keypress', edit, UNOKey.A | UNOModifier.CTRL, builder);
			}
		});

		edit.addEventListener('keyup', function(event) {
			if (edit.disabled) {
				event.preventDefault();
				return;
			}

			if (event.key === 'Shift') {
				modifier = modifier & (~UNOModifier.SHIFT);
				event.preventDefault();
			} else if (event.key === 'Control') {
				modifier = modifier & (~UNOModifier.CTRL);
				event.preventDefault();
			}
		});

		edit.addEventListener('blur', function() {
			modifier = 0;
		});

		edit.addEventListener('keypress', function(event) {
			if (edit.disabled) {
				event.preventDefault();
				return;
			}

			if (event.key === 'Enter' ||
				event.key === 'Escape' ||
				event.key === 'Esc' ||
				event.key === 'Left' ||
				event.key === 'ArrowLeft' ||
				event.key === 'Right' ||
				event.key === 'ArrowRight' ||
				event.key === 'Up' ||
				event.key === 'ArrowUp' ||
				event.key === 'Down' ||
				event.key === 'ArrowDown' ||
				event.key === 'Home' ||
				event.key === 'End' ||
				event.key === 'Backspace' ||
				event.key === 'Delete' ||
				event.key === 'Space' ||
				event.key === 'Tab') {
				// skip
			} else {
				var keyCode = event.keyCode;
				if (event.ctrlKey) {
					keyCode = event.key.toUpperCase().charCodeAt(0);
					keyCode = builder.map.keyboard._toUNOKeyCode(keyCode);
					keyCode |= UNOModifier.CTRL;
				}

				builder.callback('edit', 'keypress', edit, keyCode, builder);
			}

			event.preventDefault();
		});
	}

	if (data.rawKeyEvents || data.useTextInput) {
		edit.addEventListener('mouseup', function(event) {
			if (edit.disabled) {
				event.preventDefault();
				return;
			}

			builder.callback('edit', 'grab_focus', edit, null, builder);

			_sendSelection(event.target, builder);
			event.preventDefault();
		});
	}

	if (data.hidden)
		L.DomUtil.addClass(edit, 'hidden');

	return false;
}

JSDialog.multilineEdit = function (parentContainer, data, builder) {
	var buildInnerData = _multiLineEditControl(parentContainer, data, builder);
	return buildInnerData;
};
