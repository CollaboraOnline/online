/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * JSDialog.MultilineEdit - text field with multiple lines and scrollbar
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'multilineedit',
 *     text: 'text content\nsecond line',
 *     html: '<a href="hyperlink">hyperlink</a>' // only if contenteditable is true
 *     cursor: true,
 *     contenteditable: false
 *     enabled: false
 * }
 *
 * 'cursor' specifies if user can type into the field or it is readonly
 * 'enabled' editable field can be temporarily disabled
 */

/* global JSDialog */

interface MultilineEditData {
	id: string;
	type: string;
	text: string;
	html?: string;
	cursor?: boolean | string;
	contenteditable?: boolean;
	enabled?: boolean;
	hidden?: boolean;
}

interface Builder {
	options: {
		cssClass: string;
	};
	callback: (
		type: string,
		action: string,
		element: HTMLElement,
		value: string,
		builder: Builder,
	) => void;
	_cleanText: (text: string) => string;
}

function _sendSimpleSelection(
	edit: HTMLTextAreaElement | HTMLDivElement,
	builder: Builder,
): void {
	const startPos = (edit as HTMLTextAreaElement).selectionStart;
	const endPos = (edit as HTMLTextAreaElement).selectionEnd;

	const selection = startPos + ';' + endPos;
	builder.callback('edit', 'textselection', edit, selection, builder);
}

function _multiLineEditControl(
	parentContainer: HTMLElement,
	data: MultilineEditData,
	builder: Builder,
	callback?: (value: string) => void,
): HTMLElement | false {
	let controlType: 'textarea' | 'div' | 'p' = 'textarea';
	if (data.contenteditable) {
		controlType = 'div';
	} else if (data.cursor === false || data.cursor === 'false') {
		controlType = 'p';
	}
	const edit = L.DomUtil.create(
		controlType,
		`ui-textarea ${builder.options.cssClass}`,
		parentContainer,
	) as HTMLTextAreaElement | HTMLDivElement | HTMLParagraphElement;

	if (data.contenteditable) {
		edit.setAttribute('contenteditable', 'true');
	}

	if (controlType === 'textarea') {
		(edit as HTMLTextAreaElement).value = builder._cleanText(data.text);
	} else if (controlType === 'p') {
		data.text = data.text.replace(/(?:\r\n|\r|\n)/g, '<br>');
		edit.textContent = builder._cleanText(data.text);
	} else if (controlType === 'div') {
		if (data.html) {
			edit.innerHTML = data.html;
		} else {
			edit.textContent = builder._cleanText(data.text);
		}
	}

	edit.id = data.id;

	if (data.enabled === false) {
		(edit as HTMLTextAreaElement).disabled = true;
	}

	function _keyupChangeHandler(): void {
		if (callback) {
			callback(this.value);
		}

		builder.callback('edit', 'change', edit, this.value, builder);
		setTimeout(() => {
			_sendSimpleSelection(edit, builder);
		}, 0);
	}

	edit.addEventListener('keyup', _keyupChangeHandler);
	edit.addEventListener('change', _keyupChangeHandler); // required despite keyup as, e.g., iOS paste does not trigger keyup

	edit.addEventListener('mouseup', (event: MouseEvent) => {
		if ((edit as HTMLTextAreaElement).disabled) {
			event.preventDefault();
			return;
		}

		_sendSimpleSelection(event.target as HTMLTextAreaElement, builder);
	});

	if (data.hidden) {
		L.DomUtil.addClass(edit, 'hidden');
	}

	return false;
}

JSDialog.multilineEdit = function (
	parentContainer: HTMLElement,
	data: MultilineEditData,
	builder: Builder,
): HTMLElement | false {
	const buildInnerData = _multiLineEditControl(parentContainer, data, builder);
	return buildInnerData;
};
