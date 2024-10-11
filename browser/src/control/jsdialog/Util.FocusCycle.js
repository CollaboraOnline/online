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
 * JSDialog.FocusCycle - focus related functions
 */

/* global app JSDialog $ */

function isAnyInputFocused() {
	if (!app.map)
		return false;

	var hasTunneledDialogOpened = app.map.dialog ? app.map.dialog.hasOpenedDialog() : false;
	var hasJSDialogOpened = app.map.jsdialog ? app.map.jsdialog.hasDialogOpened() : false;
	var hasJSDialogFocused = L.DomUtil.hasClass(document.activeElement, 'jsdialog');
	var commentHasFocus = app.view.commentHasFocus;
	var inputHasFocus = $('input:focus').length > 0 || $('textarea.jsdialog:focus').length > 0;

	return hasTunneledDialogOpened || hasJSDialogOpened || hasJSDialogFocused
		|| commentHasFocus || inputHasFocus;
}

function getFocusableElements(container) {
	if (!container)
		return null;

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

// Utility function to check if an element is focusable
// This function diffrent from getFocusableElements. This only checkes the current element is focusable or not.
function isFocusable(element) {
	if (!element) return false;

	// Check if element is focusable (e.g., input, button, link, etc.)
	const focusableElements = [
		'a[href]',
		'button',
		'textarea',
		'input[type="text"]',
		'input[type="radio"]',
		'input[type="checkbox"]',
		'select',
		'[tabindex]:not([tabindex="-1"])',
	];

	return focusableElements.some((selector) => element.matches(selector));
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

function findFocusableElement(element, direction) {
	// check if no element present the just return null
	if (!element) return null;

	// Check the current element if it is focusable
	if (isFocusable(element)) return element;

	// Check if sibling is focusable or contains focusable elements
	const focusableInSibling = findFocusableWithin(element, direction);
	if (focusableInSibling) return focusableInSibling;

	// Depending on the direction, find the next or previous sibling
	const sibling =
		direction === 'next'
			? element.nextElementSibling
			: element.previousElementSibling;

	// Recursively check the next or previous sibling of the current sibling
	return findFocusableElement(sibling, direction);
}

// Helper function to find the first focusable element within an element
function findFocusableWithin(element, direction){
	const focusableElements = Array.from(element.querySelectorAll('*'));
	return direction === 'next'
		? (focusableElements.find(isFocusable))
		: (focusableElements.reverse().find(isFocusable));
}

JSDialog.IsAnyInputFocused = isAnyInputFocused;
JSDialog.GetFocusableElements = getFocusableElements;
JSDialog.MakeFocusCycle = makeFocusCycle;
JSDialog.FindFocusableElement = findFocusableElement;
