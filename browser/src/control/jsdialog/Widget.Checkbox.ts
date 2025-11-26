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

declare var JSDialog: any;

function _createCheckboxContainer(
	parentContainer: HTMLElement,
	data: CheckboxWidgetJSON,
	builder: JSBuilder,
): HTMLDivElement {
	const container = window.L.DomUtil.create(
		'div',
		builder.options.cssClass + ' ui-checkbox checkbutton',
		parentContainer,
	);
	container.id = data.id;
	return container;
}

function _createCheckboxControl(
	parentContainer: HTMLElement,
	data: CheckboxWidgetJSON,
	builder: JSBuilder,
): HTMLInputElement {
	const checkbox = window.L.DomUtil.create(
		'input',
		builder.options.cssClass + ' ui-checkbox-input',
		parentContainer,
	);
	checkbox.type = 'checkbox';
	checkbox.id = data.id + '-input';
	checkbox.tabIndex = '0';
	return checkbox;
}

function _createCheckboxLabel(
	parentContainer: HTMLElement,
	data: CheckboxWidgetJSON,
	builder: JSBuilder,
): HTMLLabelElement {
	const label = window.L.DomUtil.create(
		'label',
		builder.options.cssClass + ' ui-checkbox-label',
		parentContainer,
	);
	label.id = data.id + '-label';
	label.textContent = builder._cleanText(data.text);
	label.htmlFor = data.id + '-input';
	return label;
}

JSDialog.Checkbox = function (
	parentContainer: HTMLElement,
	data: CheckboxWidgetJSON,
	builder: JSBuilder,
) {
	const container = _createCheckboxContainer(parentContainer, data, builder);
	const checkbox = _createCheckboxControl(container, data, builder);
	const label = _createCheckboxLabel(container, data, builder);

	checkbox.addEventListener('change', () => {
		if (container.getAttribute('disabled') === 'true') return;

		if (data.command) {
			app.dispatcher.dispatch(data.command);
			return;
		}

		builder.callback(
			'checkbox',
			'change',
			container,
			checkbox.checked,
			builder,
		);
	});

	const setDisabled = (disable: boolean) => {
		if (disable) {
			container.setAttribute('disabled', 'true');

			checkbox.disabled = true;
			checkbox.setAttribute('aria-disabled', 'true');
		} else {
			container.removeAttribute('disabled');

			checkbox.disabled = false;
			checkbox.removeAttribute('aria-disabled');
		}
	};

	setDisabled(data.enabled === false);

	JSDialog.SynchronizeDisabledState(container, [checkbox, label]);

	const toggleFunction = () => {
		if (container.getAttribute('disabled') === 'true') return;

		const items = app.map['stateChangeHandler'];
		const state = data.command
			? items.getItemValue(data.command) === 'true'
			: data.checked;

		if (state === true) {
			$(checkbox).prop('checked', true);
		} else if (state) {
			$(checkbox).prop('checked', false);
		}
	};

	toggleFunction();

	app.map.on(
		'commandstatechanged',
		function (e: any) {
			if (e.commandName === data.command) {
				toggleFunction();
				setDisabled(e.disabled || e.state == 'disabled');
			}
		},
		this,
	);

	if (data.hidden) $(checkbox).hide();
	return false;
};
