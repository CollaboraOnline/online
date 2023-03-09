/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.MultilineEdit - text field with multiple lines and scrollbar
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'multilineedit',
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

function _sendSimpleSelection(edit, builder) {
	var startPos = edit.selectionStart;
	var endPos = edit.selectionEnd;

	var selection = startPos + ';' + endPos;
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

	edit.addEventListener('keyup', function() {
		if (callback)
			callback(this.value);

		builder.callback('edit', 'change', edit, this.value, builder);
		setTimeout(function () { _sendSimpleSelection(edit, builder); }, 0);
	});

	edit.addEventListener('mouseup', function (event) {
		if (edit.disabled) {
			event.preventDefault();
			return;
		}

		_sendSimpleSelection(event.target, builder);
	});

	if (data.hidden)
		L.DomUtil.addClass(edit, 'hidden');

	return false;
}

JSDialog.multilineEdit = function (parentContainer, data, builder) {
	var buildInnerData = _multiLineEditControl(parentContainer, data, builder);
	return buildInnerData;
};
