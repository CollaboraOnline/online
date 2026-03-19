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
 * JSDialog.Pushbutton - push button widget
 */

/* global JSDialog app $ */

JSDialog.pushButton = function (
	parentContainer,
	data,
	builder,
	customCallback,
) {
	if (
		data.id &&
		data.id === 'changepass' &&
		builder.map['wopi'].IsOwner === false
	) {
		data.enabled = false;
	}
	var wrapperClass = window.mode.isMobile()
		? ''
		: 'd-flex justify-content-center';
	var wrapper = window.L.DomUtil.create(
		'div',
		wrapperClass + ' ui-pushbutton-wrapper ' + builder.options.cssClass,
		parentContainer,
	); // need for locking overlay
	wrapper.id = data.id;
	var pushbutton = window.L.DomUtil.create(
		'button',
		'ui-pushbutton ' + builder.options.cssClass,
		wrapper,
	);
	pushbutton.id = wrapper.id + '-button';
	pushbutton.setAttribute('tabindex', '0');
	builder._setAccessKey(pushbutton, builder._getAccessKeyFromText(data.text));
	var pushbuttonText =
		builder._customPushButtonTextForId(data.id) !== ''
			? builder._customPushButtonTextForId(data.id)
			: builder._cleanText(data.text);
	var image;
	if (data.image && pushbuttonText !== '') {
		window.L.DomUtil.addClass(
			pushbutton,
			'has-img d-flex align-content-center justify-content-center align-items-center',
		);
		image = window.L.DomUtil.create('img', '', pushbutton);
		image.src = data.image;
		var text = window.L.DomUtil.create('span', '', pushbutton);
		text.innerText = pushbuttonText;
		builder._stressAccessKey(text, pushbutton.accessKey);
	} else if (data.image) {
		window.L.DomUtil.addClass(
			pushbutton,
			'has-img d-flex align-content-center justify-content-center align-items-center',
		);
		image = window.L.DomUtil.create('img', '', pushbutton);
		builder._isStringLCIcon(data.image)
			? app.LOUtil.setImage(image, data.image, builder.map)
			: (image.src = data.image);
	} else if (data.symbol) {
		window.L.DomUtil.addClass(
			pushbutton,
			'has-img d-flex align-content-center justify-content-center align-items-center',
		);
		image = window.L.DomUtil.create('img', '', pushbutton);
		app.LOUtil.setImage(image, 'symbol_' + data.symbol + '.svg', builder.map);
	} else {
		pushbutton.innerText = pushbuttonText;
		builder._stressAccessKey(pushbutton, pushbutton.accessKey);
	}
	if (image) image.alt = '';

	const isDisabled = data.enabled === false;
	if (isDisabled) {
		wrapper.setAttribute('disabled', 'true');
		pushbutton.setAttribute('disabled', 'true');
		pushbutton.setAttribute('aria-disabled', true);
	}

	JSDialog.SynchronizeDisabledState(wrapper, [pushbutton]);

	if (data.isToggle) {
		wrapper.classList.add('ui-toggle');
		if (data.checked === true) wrapper.classList.add('checked');
	}

	if (customCallback) pushbutton.onclick = customCallback;
	else if (builder._responses[data.id] !== undefined)
		pushbutton.onclick = builder.callback.bind(
			builder,
			'responsebutton',
			'click',
			{ id: data.id },
			builder._responses[data.id],
			builder,
		);
	else
		pushbutton.onclick = builder.callback.bind(
			builder,
			'pushbutton',
			data.isToggle ? 'toggle' : 'click',
			wrapper,
			data.command,
			builder,
		);

	JSDialog.SetupA11yLabelForLabelableElement(
		parentContainer,
		pushbutton,
		data,
		builder,
	);

	const tooltipText = (data.aria && data.aria.label) || data.text;
	if (!pushbuttonText && tooltipText) {
		pushbutton.setAttribute('data-cooltip', builder._cleanText(tooltipText));
		window.L.control.attachTooltipEventListener(pushbutton, builder.map);
	}

	if (data.aria && data.aria.role) {
		pushbutton.setAttribute('role', data.aria.role);
	}

	builder.map.hideRestrictedItems(data, wrapper, pushbutton);
	builder.map.disableLockedItem(data, wrapper, pushbutton);
	if (data.hidden) $(wrapper).hide(); // Both pushbutton and its wrapper needs to be hidden.

	return false;
};
