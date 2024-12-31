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
 * JSDialog.Edit - single line input field widget
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'edit',
 *     text: 'abc',
 *     placeholder: 'this is shown when empty',
 *     password: false,
 *     hidden: false,
 *     changedCallback: null
 * }
 */

declare var JSDialog: any;

class EditWidget {
	parentContainer: HTMLElement;
	data: EditWidgetJSON;
	builder: any;
	callback: JSDialogCallback;

	constructor(
		parentContainer: HTMLElement,
		data: EditWidgetJSON,
		builder: any,
		callback: JSDialogCallback,
	) {
		this.parentContainer = parentContainer;
		this.data = data;
		this.builder = builder;
		this.callback = callback;
	}

	static buildImpl(
		parentContainer: HTMLElement,
		data: EditWidgetJSON,
		builder: any,
		callback: JSDialogCallback,
	) {
		var container = L.DomUtil.create(
			'div',
			'ui-edit-container ' + builder.options.cssClass,
			parentContainer,
		);
		container.id = data.id;

		var edit = L.DomUtil.create(
			'input',
			'ui-edit ' + builder.options.cssClass,
			container,
		);
		edit.value = data.text;
		edit.id = data.id + '-input';
		edit.dir = 'auto';

		if (data.password === true) edit.type = 'password';

		if (data.enabled === false) {
			container.setAttribute('disabled', 'true');
			edit.disabled = true;
		}

		JSDialog.SynchronizeDisabledState(container, [edit]);

		edit.addEventListener('keyup', function (e: KeyboardEvent) {
			var callbackToUse =
				e.key === 'Enter' && data.changedCallback ? data.changedCallback : null;
			if (callback) callbackToUse = callback;
			if (typeof callbackToUse === 'function') callbackToUse(this.value);
			else builder.callback('edit', 'change', container, this.value, builder);
		});

		edit.addEventListener('click', function (e: MouseEvent) {
			e.stopPropagation();
		});

		if (data.hidden) $(edit).hide();

		if (data.placeholder) $(edit).attr('placeholder', data.placeholder);
	}

	build(): boolean {
		EditWidget.buildImpl(
			this.parentContainer,
			this.data,
			this.builder,
			this.callback,
		);
		return false;
	}
}

JSDialog.edit = function (
	parentContainer: HTMLElement,
	data: EditWidgetJSON,
	builder: any,
	callback: JSDialogCallback,
) {
	const widget = new EditWidget(parentContainer, data, builder, callback);
	return widget.build();
};
