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

function _sendSimpleSelection(
	edit: HTMLTextAreaElement | HTMLDivElement,
	builder: JSBuilder,
): void {
	const startPos = (edit as HTMLTextAreaElement).selectionStart;
	const endPos = (edit as HTMLTextAreaElement).selectionEnd;

	const selection = startPos + ';' + endPos;
	builder.callback('edit', 'textselection', edit, selection, builder);
}

function _multiLineEditControl(
	parentContainer: HTMLElement,
	data: MultilineEditData,
	builder: JSBuilder,
	callback?: (value: string) => void,
): boolean {
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

	function _keyupChangeHandler(
		this: HTMLTextAreaElement | HTMLDivElement,
	): void {
		const value = (this as HTMLTextAreaElement).value ?? this.textContent ?? '';
		if (callback) {
			callback(value);
		}

		builder.callback('edit', 'change', edit, value, builder);
		setTimeout(() => {
			_sendSimpleSelection(edit, builder);
		}, 0);
	}

	edit.addEventListener('keyup', _keyupChangeHandler);
	edit.addEventListener('change', _keyupChangeHandler); // required despite keyup as, e.g., iOS paste does not trigger keyup

	edit.addEventListener('mouseup', ((event: MouseEvent) => {
		if ((edit as HTMLTextAreaElement).disabled) {
			event.preventDefault();
			return;
		}

		_sendSimpleSelection(event.target as HTMLTextAreaElement, builder);
	}) as EventListener);

	if (data.hidden) {
		L.DomUtil.addClass(edit, 'hidden');
	}

	return false;
}

JSDialog.multilineEdit = function (
	parentContainer: HTMLElement,
	data: MultilineEditData,
	builder: JSBuilder,
): boolean {
	const buildInnerData = _multiLineEditControl(parentContainer, data, builder);
	return buildInnerData;
};
