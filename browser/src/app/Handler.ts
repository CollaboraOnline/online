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

// Handler is a base class for handler classes that are used internally
// to add interaction features like dragging to classes like Map and
// Marker.

class Handler implements IDAble {
	private _map: any;
	private _enabled: boolean;
	public _leaflet_id: number = -1;

	constructor(map: any) {
		this._map = map;
		this._enabled = false;
	}

	public enable() {
		if (this._enabled) {
			return;
		}

		this._enabled = true;
		this.addHooks();
	}

	public disable() {
		if (!this._enabled) {
			return;
		}

		this._enabled = false;
		this.removeHooks();
	}

	public enabled() {
		return this._enabled;
	}

	protected addHooks() {}
	protected removeHooks() {}
}
