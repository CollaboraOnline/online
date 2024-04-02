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

// Simple point, for simple purposes.
export class SimplePoint {
	private _x: number;
	private _y: number;

	// Constructor uses twips.
	constructor(x: number, y: number) {
		this._x = x;
		this._y = y;
	}

	// twips.
	public get x(): number { return this._x; }
	public set x(x: number) { this._x = x; }

	public get y(): number { return this._y; }
	public set y(y: number) { this._y = y; }

	public equals(point: Array<number>) { return this.x === point[0] && this.y === point[1]; }
	public toArray(): number[] { return [this._x, this._y]; }

	// Core pixel.
	public get pX(): number { return Math.round(this._x * app.twipsToPixels); }
	public set pX(x: number) { this._x = x / app.twipsToPixels; }

	public get pY(): number { return Math.round(this._y * app.twipsToPixels); }
	public set pY(y: number) { this._y = y / app.twipsToPixels; }

	public pEquals(point: Array<number>) { return this.pX === point[0] && this.pY === point[1]; }
	public pToArray(): number[] { return [this.pX, this.pY]; }

	// CSS pixel.
	public get cX(): number { return Math.round(this._x * app.twipsToPixels / app.dpiScale); }
	public set cX(x: number) { this._x = Math.round(x * app.dpiScale / app.twipsToPixels); }

	public get cY(): number { return Math.round(this._y * app.twipsToPixels / app.dpiScale); }
	public set cY(y: number) { this._y = Math.round(y * app.dpiScale / app.twipsToPixels); }

	public cEquals(point: Array<number>) { return this.cX === point[0] && this.cY === point[1]; }
	public cToArray(): number[] { return [this.cX, this.cY]; }
}

/**
 * Represents a rectangle object which works with core pixels.
 * x1 and y1 should always <= x2 and y2. In other words width >= 0 && height >= 0 is a precondition.
 * This class doesn't check for above conditions.
 */
export class Rectangle {
	private _x1: number;
	private _y1: number;
	private _width: number;
	private _height: number;

	// Constructor uses twips.
	constructor (x: number, y: number, width: number, height: number) {
		this._x1 = x;
		this._y1 = y;
		this._width = width;
		this._height = height;
	}

	// twips.
	public get x1(): number { return this._x1; }
	public set x1 (x1: number) { this._width += (this._x1 - x1); this._x1 = x1; }

	public get y1(): number { return this._y1; }
	public set y1 (y1: number) { this._height += (this._y1 - y1); this._y1 = y1; }

	public get x2(): number { return (this._x1 + this._width); }
	public set x2 (x2: number) { this._width = x2 - this._x1; }

	public get y2(): number { return (this._y1 + this._height); }
	public set y2 (y2: number) { this._height = y2 - this._y1; }

	public get width(): number { return this._width; }
	public set width (width: number) { this._width = width; }

	public get height(): number { return this._height; }
	public set height (height: number) { this._height = height; }

	public get area(): number { return (this._width * this._height); }
	public get center(): number[] { return [(this.x1 + this.x2) / 2, (this.y1 + this.y2) / 2]; }
	public get toArray(): number[] { return [this._x1, this._y1, this._width, this._height]; }

	// twips checkers for coordinate match.
	public containsPoint (point: number[]): boolean { return (point[0] >= this.x1 && point[0] <= this.x2 && point[1] >= this.y1 && point[1] <= this.y2); }
	public containsX (x: number): boolean { return (x >= this.x1 && x <= this.x2); }
	public containsY (y: number): boolean { return (y >= this.y1 && y <= this.y2); }
	public equals(rectangle: Array<number>) { return this.x1 === rectangle[0] && this.y1 === rectangle[this.y1] && this.width === rectangle[2] && this.height === rectangle[3]; }

	public moveTo (point: number[]): void { this._x1 = point[0]; this._y1 = point[1]; }
	public moveBy (point: number[]): void { this._x1 += point[0]; this._y1 += point[1]; }
	public setArea (area: number, preserveHeight: boolean): void { if (preserveHeight) { this.width = area / this.height; } else { this.height = area / this.width; } }

	// Pixel.
	public get pX1(): number { return Math.round(this._x1 * app.twipsToPixels); }
	public set pX1 (x1: number) { x1 = x1 / app.twipsToPixels; this.x1 = x1; }

	public get pY1(): number { return Math.round(this._y1 * app.twipsToPixels); }
	public set pY1 (y1: number) { y1 = y1 / app.twipsToPixels; this.y1 = y1; }

	public get pX2(): number { return Math.round((this._x1 + this._width) * app.twipsToPixels); }
	public set pX2 (x2: number) { this.width = x2 / app.twipsToPixels; }

	public get pY2(): number { return Math.round((this._y1 + this._height) * app.twipsToPixels); }
	public set pY2 (y2: number) { this.height = y2 / app.twipsToPixels; }

	public get pWidth(): number { return Math.round(this._width * app.twipsToPixels); }
	public set pWidth (width: number) { this.width = width / app.twipsToPixels; }

	public get pHeight(): number { return Math.round(this._height * app.twipsToPixels); }
	public set pHeight (height: number) { this.height = height / app.twipsToPixels; }

	public get pArea(): number { return Math.round((this._width * this._height) * app.twipsToPixels); }
	public get pCenter(): number[] { return [(this.pX1 + this.pX2) / 2, (this.pY1 + this.pY2) / 2]; }
	public get pToArray(): number[] { return [this.pX1, this.pY1, this.pWidth, this.pHeight]; }

	// Pixel checkers for coordinate match.
	public pContainsPoint (point: number[]): boolean { return (point[0] >= this.pX1 && point[0] <= this.pX2 && point[1] >= this.pY1 && point[1] <= this.pY2); }
	public pContainsX (x: number): boolean { return (x >= this.pX1 && x <= this.pX2); }
	public pContainsY (y: number): boolean { return (y >= this.pY1 && y <= this.pY2); }
	public pEquals(rectangle: Array<number>) { return this.pX1 === rectangle[0] && this.pY1 === rectangle[this.y1] && this.pWidth === rectangle[2] && this.pHeight === rectangle[3]; }

	public pMoveTo (point: number[]): void { this.x1 = point[0] / app.twipsToPixels; this.y1 = point[1] / app.twipsToPixels; }
	public pMoveBy (point: number[]): void { this.x1 += point[0] / app.twipsToPixels; this.y1 += point[1] * app.twipsToPixels; }
	public pSetArea (area: number, preserveHeight: boolean): void { if (preserveHeight) { this.width = (area / app.twipsToPixels) / this.height; } else { this.height = (area / app.twipsToPixels) / this.width; } }

	// CSS pixel.
	public get cX1(): number { return Math.round(this._x1 * app.twipsToPixels / app.dpiScale); }
	public set cX1 (x1: number) { this._x1 = Math.round(x1 * app.pixelsToTwips * app.dpiScale); }

	public get cY1(): number { return Math.round(this._y1 * app.twipsToPixels / app.dpiScale); }
	public set cY1 (y1: number) { this._y1 = Math.round(y1 * app.pixelsToTwips * app.dpiScale); }

	public get cX2(): number { return Math.round((this._x1 + this._width) * app.twipsToPixels / app.dpiScale); }
	public set cX2 (x2: number) { this._width = Math.round(x2 * app.dpiScale * app.pixelsToTwips); }

	public get cY2(): number { return Math.round((this._y1 + this._height) * app.twipsToPixels / app.dpiScale); }
	public set cY2 (y2: number) { this._height = Math.round(y2 * app.dpiScale * app.pixelsToTwips); }

	public get cWidth(): number { return Math.round(this._width * app.twipsToPixels / app.dpiScale); }
	public set cWidth (width: number) { this._width = Math.round(width * app.dpiScale * app.pixelsToTwips); }

	public get cHeight(): number { return Math.round(this._height * app.twipsToPixels / app.dpiScale); }
	public set cHeight (height: number) { this._height = Math.round(height * app.dpiScale * app.pixelsToTwips); }

	public get cArea(): number { return (this._width * this._height) * app.twipsToPixels / app.dpiScale; }
	public get cCenter(): number[] { return [(this.cX1 + this.cX2) / 2, (this.cY1 + this.cY2) / 2]; }
	public get cToArray(): number[] { return [this.cX1, this.cY1, this.cWidth, this.cHeight]; }

	// Pixel checkers for coordinate match.
	public cContainsPoint (point: number[]): boolean { return (point[0] >= this.pX1 && point[0] <= this.pX2 && point[1] >= this.pY1 && point[1] <= this.pY2); }
	public cContainsX (x: number): boolean { return (x >= this.pX1 && x <= this.pX2); }
	public cContainsY (y: number): boolean { return (y >= this.pY1 && y <= this.pY2); }
	public cEquals(rectangle: Array<number>) { return this.pX1 === rectangle[0] && this.pY1 === rectangle[this.y1] && this.pWidth === rectangle[2] && this.pHeight === rectangle[3]; }

	public cMoveTo (point: number[]): void { this.x1 = point[0] / app.twipsToPixels; this.y1 = point[1] / app.twipsToPixels; }
	public cMoveBy (point: number[]): void { this.x1 += point[0] / app.twipsToPixels; this.y1 += point[1] * app.twipsToPixels; }
	public cSetArea (area: number, preserveHeight: boolean): void { if (preserveHeight) { this.width = (area / app.twipsToPixels) / this.height; } else { this.height = (area / app.twipsToPixels) / this.width; } }

	public clone(): Rectangle { return new Rectangle(this.x1, this.x2, this.width, this.height); }
}

}

app.definitions.rectangle = cool.Rectangle;
app.definitions.simplePoint = cool.SimplePoint;
