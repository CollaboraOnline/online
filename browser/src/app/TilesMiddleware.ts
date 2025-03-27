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

class TileCoordData {
	x: number;
	y: number;
	z: number;
	part: number;
	mode: number;

	constructor(
		left: number,
		top: number,
		zoom: number,
		part: number,
		mode: number,
	) {
		this.x = left;
		this.y = top;
		this.z = zoom;
		this.part = part;
		this.mode = mode !== undefined ? mode : 0;
	}

	getPos() {
		return new L.Point(this.x, this.y);
	}

	key() {
		return (
			this.x +
			':' +
			this.y +
			':' +
			this.z +
			':' +
			this.part +
			':' +
			(this.mode !== undefined ? this.mode : 0)
		);
	}

	toString() {
		return (
			'{ left : ' +
			this.x +
			', top : ' +
			this.y +
			', z : ' +
			this.z +
			', part : ' +
			this.part +
			', mode : ' +
			this.mode +
			' }'
		);
	}

	public static parseKey = function (key: string) {
		window.app.console.assert(
			typeof key === 'string',
			'key should be a string',
		);
		const k = key.split(':');
		const mode = k.length === 4 ? +k[4] : 0;
		window.app.console.assert(k.length >= 5, 'invalid key format');
		return new TileCoordData(+k[0], +k[1], +k[2], +k[3], mode);
	};
}
