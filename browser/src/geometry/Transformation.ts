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

declare var L: any;

namespace cool {

/**
 * Transformation is an utility class to perform simple point transformations through a 2d-matrix.
 */
export class Transformation {

	private a: number;
	private b: number;
	private c: number;
	private d: number;

	constructor(a: number, b: number, c: number, d: number) {
		this.a = a;
		this.b = b;
		this.c = c;
		this.d = d;
	}

	public transform(point: Point, scale: number): Point {
		return this._transform(point.clone(), scale);
	}

	// destructive transform (faster)
	public _transform(point: Point, scale: number): Point {
		scale = scale || 1;
		point.x = scale * (this.a * point.x + this.b);
		point.y = scale * (this.c * point.y + this.d);
		return point;
	}

	public untransform(point: Point, scale: number): Point {
		scale = scale || 1;
		return new Point(
			(point.x / scale - this.b) / this.a,
			(point.y / scale - this.d) / this.c);
	}
}

}

L.Transformation = cool.Transformation;
