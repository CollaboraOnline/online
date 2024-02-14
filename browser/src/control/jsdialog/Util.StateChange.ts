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
 * Util.StateChange - helper for defining enable / disable callback
 */

declare var JSDialog: any;

type StateChangeCallback = (enabled: boolean) => void;

function onStateChange(element: Element, callback: StateChangeCallback) {
	var enabledCallback = function (mutations: Array<MutationRecord>) {
		for (var i in mutations) {
			if (mutations[i].attributeName === 'disabled') {
				var enable = mutations[i].oldValue !== null;
				callback(enable);
			}
		}
	};

	var enableObserver = new MutationObserver(enabledCallback);
	enableObserver.observe(element, { attributeFilter: ['disabled'], attributeOldValue: true });
}

function synchronizeDisabledState(source: Element, targets: Array<Element>) {
	var enabledCallback = function (enable: boolean) {
		for (const i in targets) {
			if (enable) {
				targets[i].removeAttribute('disabled');
			} else {
				targets[i].setAttribute('disabled', '');
			}
		}
	};
	onStateChange(source, enabledCallback);
}

JSDialog.OnStateChange = onStateChange;
JSDialog.SynchronizeDisabledState = synchronizeDisabledState;
