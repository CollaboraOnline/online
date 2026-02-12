// @ts-strict-ignore
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
 * JSDialog.KeyCodes - key code related functions
 */

JSDialog.getUNOKeyCodeWithModifiers = function (
	e: KeyboardEvent,
	builder: any,
	app: any,
): number {
	let keyCode = e.keyCode;

	const shift =
		keyCode === builder.map.keyboard.keyCodes.SHIFT ? app.UNOModifier.SHIFT : 0;
	const ctrl =
		keyCode === builder.map.keyboard.keyCodes.CTRL || e.metaKey
			? app.UNOModifier.CTRL
			: 0;
	const alt =
		keyCode === builder.map.keyboard.keyCodes.ALT ? app.UNOModifier.ALT : 0;

	const modifier = shift | ctrl | alt;

	if (modifier) {
		keyCode = e.key.toUpperCase().charCodeAt(0);
		keyCode = builder.map.keyboard._toUNOKeyCode(keyCode);
		keyCode |= modifier;
	}

	return keyCode;
};
