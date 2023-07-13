/* -*- js-indent-level: 8 -*- */
/*
 * JSDialog.FocusCycle - focus related functions
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global JSDialog */

function getFocusableElements(container) {
	var ret = container.querySelectorAll('[tabIndex="0"]:not(.jsdialog-begin-marker, .jsdialog-end-marker):not([disabled]):not(.hidden)');
	if (!ret.length)
		ret = container.querySelectorAll('input:not([disabled]):not(.hidden)');
	if (!ret.length)
		ret = container.querySelectorAll('textarea:not([disabled]):not(.hidden)');
	if (!ret.length)
		ret = container.querySelectorAll('select:not([disabled]):not(.hidden)');
	if (!ret.length)
		ret = container.querySelectorAll('button:not([disabled]):not(.hidden)');
	return ret;
}

/// close tab focus switching in cycle inside container
function makeFocusCycle(container, failedToFindFocusFunc) {
	var beginMarker = L.DomUtil.create('div', 'jsdialog autofilter jsdialog-begin-marker');
	var endMarker = L.DomUtil.create('div', 'jsdialog autofilter jsdialog-end-marker');

	beginMarker.tabIndex = 0;
	endMarker.tabIndex = 0;

	container.insertBefore(beginMarker, container.firstChild);
	container.appendChild(endMarker);

	container.addEventListener('focusin', function(event) {
		if (event.target == endMarker) {
			var firstFocusElement = getFocusableElements(container);
			if (firstFocusElement && firstFocusElement.length) {
				firstFocusElement[0].focus();
				return;
			}
		} else if (event.target == beginMarker) {
			var focusables = getFocusableElements(container);
			var lastFocusElement = focusables.length ? focusables[focusables.length - 1] : null;
			if (lastFocusElement) {
				lastFocusElement.focus();
				return;
			}
		}

		if ((event.target == endMarker || event.target == beginMarker) && failedToFindFocusFunc)
			failedToFindFocusFunc();
	});
}

JSDialog.GetFocusableElements = getFocusableElements;
JSDialog.MakeFocusCycle = makeFocusCycle;
