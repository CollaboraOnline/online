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
    Notes about the design:
        * Because there are more then one definitions of rectangle and point, we need a prefix. The prefix is "Simple".
        * This file is meant to be the base for geometry classes.
        * Needs to keep things simple and maintainable:
            * Interoperability between classes is important. These classes don't get other classes as inputs.
            * There shouldn't be something like "rectangle.testSomething(otherRectangle)", instead "rectangle.testSometghing(otherRectangle.toArray())"
            * We need this approach to keep things maintainable. These classes are not base for others for now. We shouldn't force types.
            * Function inputs are primitives, like number, array of numbers, array of arrays of numbers, ..
        * We have 3 types of coordinate units in Collabora Online.
            * CSS pixels.
            * Core pixels.
            * twips.
        * Core pixels are indeed equal to Canvas pixels. So:
            * Core pixels = Canvas pixels.
        * We are using term "core pixels" in many places.
        * Why are there a CSS pixels and core / canvas pixels?
            * Because now many devices have extreme pixel densities.
            * If you render a page with traditional pixel density using CSS: the buttons, UI, whatever is on the page will be rendered very small. Because pixels or too small.
            * Browsers are solving this issue with "devicePixelRatio" variable. They are rendering the page using this variable. The result is called CSS pixels.
            * This variable is equal to: "device's pixel density" / "traditional pixel density"
            * If devicePixelRatio is different than "1", the device has a bigger pixel density than traditional devices.
            * Canvas HTML elements are using device's pixel density. So we can use high definiton images on our canvas.
			* app.dpiScale is a *divider* for converting core pixels into CSS pixels. CSS pixels conversion probably will always be used for positioning etc. of HTML elements.
            * Search "devicePixelRatio" for more info.
        * We need to convert these 3 types where we need.
        * Every class is initiated with "twips" units. twips is the base unit. Every other type is calculated.
		* One can use "app.twipsToPixels", "app.pixelsToTwips" and "app.dpiScale" for initiating new classes with non-base units.
		* We use below terminology:
			* x => to get and set x.
			* pX => to get and set x using core / canvas units. Internally, it is converted into twips.
			* cX => to get and set x using CSS units. Internally, it is converted into twips.
		* Every type has its own sub functions:
			* toArray (native-twips), cToArray (CSS), pToArray (core / canvas), containsPoint (takes number array as input), pContainsPoint, cContainsPoint and the like.
		* twips is an integer unit. We also prefer integer types here, since other types are pixels.
		* If one needs hairlines in drawing, they can always add 0.5 or something to result.
		* Our canvas uses special positioning and sizing, it doesn't / shouldn't use these classes for resizing. Sections can use these safely. See CanvasSectionContainer::onResize if curious.
		* Rounding errors:
			* Converting between units is never lossless. But once a variable is set, variable's unit should be consistent. For this:
				* We are using calculated variables inside the unit. For example, when pX2 is queried:
					* We use "return pX1 + pWidth"
					* If we used "(_x1 + _width) * app.twipsToPixels", we would have raised the possibility of inconsistency. Then below 2 may or may not be equal:
						* object.pX1 + object.pWidth !== object.pX2 => We want these to be equal so we don't use "(_x1 + _width) * app.twipsToPixels".
				* This ensures the consistency once the variables are set, but the compound error increases (if one modifies the non-base values again and again, and again).
*/

namespace cool {

// Simple point, for simple purposes.
export class SimplePoint {
	private _x: number;
	private _y: number;

	// Constructor uses twips.
	constructor(x: number, y: number) {
		this._x = Math.round(x);
		this._y = Math.round(y);
	}

	// twips.
	public get x(): number { return this._x; }
	public set x(x: number) { this._x = Math.round(x); }

	public get y(): number { return this._y; }
	public set y(y: number) { this._y = Math.round(y); }

	public equals(point: Array<number>): boolean { return this._x === Math.round(point[0]) && this._y === Math.round(point[1]); }
	public toArray(): number[] { return [this._x, this._y]; }
	public distanceTo(point: number[]): number { return Math.sqrt(Math.pow(this._x - point[0], 2) + Math.pow(this._y - point[1], 2)); }

	// Core / canvas pixel.
	public get pX(): number { return Math.round(this._x * app.twipsToPixels); }
	public set pX(x: number) { this._x = Math.round(x * app.pixelsToTwips); }

	public get pY(): number { return Math.round(this._y * app.twipsToPixels); }
	public set pY(y: number) { this._y = Math.round(y * app.pixelsToTwips); }

	public pEquals(point: Array<number>): boolean { return this.pX === Math.round(point[0]) && this.pY === Math.round(point[1]); }
	public pToArray(): number[] { return [this.pX, this.pY]; }
	public pDistanceTo(point: number[]): number { return Math.sqrt(Math.pow(this.pX - point[0], 2) + Math.pow(this.pY - point[1], 2)); }

	// CSS pixel.
	public get cX(): number { return Math.round(this._x * app.twipsToPixels / app.dpiScale); }
	public set cX(x: number) { this._x = Math.round(x * app.dpiScale * app.pixelsToTwips); }

	public get cY(): number { return Math.round(this._y * app.twipsToPixels / app.dpiScale); }
	public set cY(y: number) { this._y = Math.round(y * app.dpiScale * app.pixelsToTwips); }

	public cEquals(point: Array<number>): boolean { return this.cX === Math.round(point[0]) && this.cY === Math.round(point[1]); }
	public cToArray(): number[] { return [this.cX, this.cY]; }
	public cDistanceTo(point: number[]): number { return Math.sqrt(Math.pow(this.cX - point[0], 2) + Math.pow(this.cY - point[1], 2)); }

	public clone(): SimplePoint { return new SimplePoint(this._x, this._y); }
}

/**
 * Represents a rectangle object which works with core pixels.
 * x1 and y1 should always <= x2 and y2. In other words width >= 0 && height >= 0 is a precondition.
 * This class doesn't check for above conditions.
 */
export class SimpleRectangle {
	private _x1: number;
	private _y1: number;
	private _width: number;
	private _height: number;

	// Constructor uses twips.
	constructor (x: number, y: number, width: number, height: number) {
		this._x1 = Math.round(x);
		this._y1 = Math.round(y);
		this._width = Math.round(width);
		this._height = Math.round(height);
	}

	// twips.
	public get x1(): number { return this._x1; }
	public set x1 (x1: number) { this._x1 = Math.round(x1); }

	public get y1(): number { return this._y1; }
	public set y1 (y1: number) { this._y1 += Math.round(y1); }

	public get x2(): number { return (this._x1 + this._width); }
	public set x2 (x2: number) { this._width = Math.round(x2) - this._x1; }

	public get y2(): number { return (this._y1 + this._height); }
	public set y2 (y2: number) { this._height = Math.round(y2) - this._y1; }

	public get width(): number { return this._width; }
	public set width (width: number) { this._width = Math.round(width); }

	public get height(): number { return this._height; }
	public set height (height: number) { this._height = Math.round(height); }

	public get area(): number { return (this._width * this._height); }
	public get center(): number[] { return [(this.x1 + this.x2) / 2, (this.y1 + this.y2) / 2]; }

	public toArray(): number[] { return [this._x1, this._y1, this._width, this._height]; }

	// twips checkers for coordinate match.
	public containsPoint (point: number[]): boolean { return (Math.round(point[0]) >= this.x1 && Math.round(point[0]) <= this.x2 && Math.round(point[1]) >= this.y1 && Math.round(point[1]) <= this.y2); }
	public containsX (x: number): boolean { return (Math.round(x) >= this.x1 && Math.round(x) <= this.x2); }
	public containsY (y: number): boolean { return (Math.round(y) >= this.y1 && Math.round(y) <= this.y2); }
	public containsRectangle(rectangle: number[]): boolean { return this.containsPoint([rectangle[0], rectangle[1]]) && this.containsPoint([rectangle[0] + rectangle[2], rectangle[1] + rectangle[3]]); }
	public intersectsRectangle(rectangle: number[]): boolean { return this.containsPoint([rectangle[0], rectangle[1]]) || this.containsPoint([rectangle[0] + rectangle[2], rectangle[1] + rectangle[3]]); }
	public equals(rectangle: Array<number>): boolean { return this.x1 === Math.round(rectangle[0]) && this.y1 === Math.round(rectangle[1]) && this.width === Math.round(rectangle[2]) && this.height === Math.round(rectangle[3]); }

	public moveTo (point: number[]): void { this._x1 = Math.round(point[0]); this._y1 = Math.round(point[1]); }
	public moveBy (point: number[]): void { this._x1 += Math.round(point[0]); this._y1 += Math.round(point[1]); }

	// Pixel.
	public get pX1(): number { return Math.round(this._x1 * app.twipsToPixels); }
	public set pX1 (x1: number) { this._x1 = Math.round(x1 * app.pixelsToTwips); }

	public get pY1(): number { return Math.round(this._y1 * app.twipsToPixels); }
	public set pY1 (y1: number) { this._y1 = Math.round(y1 * app.pixelsToTwips); }

	public get pX2(): number { return this.pX1 + this.pWidth; }
	public set pX2 (x2: number) { this._width = Math.round(x2 * app.pixelsToTwips) - this._x1; }

	public get pY2(): number { return this.pY1 + this.pHeight; }
	public set pY2 (y2: number) { this._height = Math.round(y2 * app.pixelsToTwips) - this._y1; }

	public get pWidth(): number { return Math.round(this._width * app.twipsToPixels); }
	public set pWidth (width: number) { this._width = Math.round(width * app.pixelsToTwips); }

	public get pHeight(): number { return Math.round(this._height * app.twipsToPixels); }
	public set pHeight (height: number) { this._height = Math.round(height * app.pixelsToTwips); }

	public get pArea(): number { return this.pWidth * this.pHeight; }
	public get pCenter(): number[] { return [(this.pX1 + this.pX2) / 2, (this.pY1 + this.pY2) / 2]; }

	public pToArray(): number[] { return [this.pX1, this.pY1, this.pWidth, this.pHeight]; }

	// Pixel checkers for coordinate match.
	public pContainsPoint (point: number[]): boolean { return (Math.round(point[0]) >= this.pX1 && Math.round(point[0]) <= this.pX2 && Math.round(point[1]) >= this.pY1 && Math.round(point[1]) <= this.pY2); }
	public pContainsX (x: number): boolean { return (Math.round(x) >= this.pX1 && Math.round(x) <= this.pX2); }
	public pContainsY (y: number): boolean { return (Math.round(y) >= this.pY1 && Math.round(y) <= this.pY2); }
	public pContainsRectangle(rectangle: number[]): boolean { return this.pContainsPoint([rectangle[0], rectangle[1]]) && this.pContainsPoint([rectangle[0] + rectangle[2], rectangle[1] + rectangle[3]]); }
	public pIntersectsRectangle(rectangle: number[]): boolean { return this.pContainsPoint([rectangle[0], rectangle[1]]) || this.pContainsPoint([rectangle[0] + rectangle[2], rectangle[1] + rectangle[3]]); }
	public pEquals(rectangle: Array<number>): boolean { return this.pX1 === Math.round(rectangle[0]) && this.pY1 === Math.round(rectangle[1]) && this.pWidth === Math.round(rectangle[2]) && this.pHeight === Math.round(rectangle[3]); }

	public pMoveTo (point: number[]): void { this._x1 = Math.round(point[0] * app.pixelsToTwips); this._y1 = Math.round(point[1] * app.pixelsToTwips); }
	public pMoveBy (point: number[]): void { this._x1 += Math.round(point[0] * app.pixelsToTwips); this._y1 += Math.round(point[1] * app.pixelsToTwips); }

	// CSS pixel.
	public get cX1(): number { return Math.round(this._x1 * app.twipsToPixels / app.dpiScale); }
	public set cX1 (x1: number) { this._x1 = Math.round(x1 * app.dpiScale * app.pixelsToTwips); }

	public get cY1(): number { return Math.round(this._y1 * app.twipsToPixels / app.dpiScale); }
	public set cY1 (y1: number) { this._y1 = Math.round(y1 * app.dpiScale * app.pixelsToTwips); }

	public get cX2(): number { return this.cX1 + this.cWidth; }
	public set cX2 (x2: number) { this._width = Math.round(x2 * app.dpiScale * app.pixelsToTwips); }

	public get cY2(): number { return this.cY1 + this.cHeight; }
	public set cY2 (y2: number) { this._height = Math.round(y2 * app.dpiScale * app.pixelsToTwips); }

	public get cWidth(): number { return Math.round(this._width * app.twipsToPixels / app.dpiScale); }
	public set cWidth (width: number) { this._width = Math.round(width * app.dpiScale * app.pixelsToTwips); }

	public get cHeight(): number { return Math.round(this._height * app.twipsToPixels / app.dpiScale); }
	public set cHeight (height: number) { this._height = Math.round(height * app.dpiScale * app.pixelsToTwips); }

	public get cArea(): number { return this.cWidth * this.cHeight; }
	public get cCenter(): number[] { return [(this.cX1 + this.cX2) / 2, (this.cY1 + this.cY2) / 2]; }

	public cToArray(): number[] { return [this.cX1, this.cY1, this.cWidth, this.cHeight]; }

	// CSS pixel checkers for coordinate match.
	public cContainsPoint (point: number[]): boolean { return (Math.round(point[0]) >= this.cX1 && Math.round(point[0]) <= this.cX2 && Math.round(point[1]) >= this.cY1 && Math.round(point[1]) <= this.cY2); }
	public cContainsX (x: number): boolean { return (Math.round(x) >= this.cX1 && Math.round(x) <= this.cX2); }
	public cContainsY (y: number): boolean { return (Math.round(y) >= this.cY1 && Math.round(y) <= this.cY2); }
	public cContainsRectangle(rectangle: number[]): boolean { return this.cContainsPoint([rectangle[0], rectangle[1]]) && this.cContainsPoint([rectangle[0] + rectangle[2], rectangle[1] + rectangle[3]]); }
	public cIntersectsRectangle(rectangle: number[]): boolean { return this.cContainsPoint([rectangle[0], rectangle[1]]) || this.cContainsPoint([rectangle[0] + rectangle[2], rectangle[1] + rectangle[3]]); }
	public cEquals(rectangle: Array<number>): boolean { return this.cX1 === Math.round(rectangle[0]) && this.cY1 === Math.round(rectangle[this.y1]) && this.cWidth === Math.round(rectangle[2]) && this.cHeight === Math.round(rectangle[3]); }

	public cMoveTo (point: number[]): void { this._x1 = Math.round(point[0] * app.dpiScale * app.pixelsToTwips); this._y1 = Math.round(point[1] * app.dpiScale * app.pixelsToTwips); }
	public cMoveBy (point: number[]): void { this._x1 += Math.round(point[0] * app.dpiScale * app.pixelsToTwips); this._y1 += Math.round(point[1] * app.dpiScale * app.pixelsToTwips); }

	public clone(): SimpleRectangle { return new SimpleRectangle(this.x1, this.y1, this.width, this.height); }
}

}

app.definitions.simpleRectangle = cool.SimpleRectangle;
app.definitions.simplePoint = cool.SimplePoint;
