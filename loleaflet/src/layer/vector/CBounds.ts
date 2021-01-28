/* eslint-disable */

/*
 * CBounds represents a rectangular area on the screen in pixel coordinates.
 */

class CBounds {
	min: CPoint;
	max: CPoint;

	constructor(a?: CPoint, b?: CPoint) {
		if (a !== undefined)
			this.extend(a);
		if (b !== undefined)
			this.extend(b);
	}

	static fromPointArray(points: Array<CPoint>): CBounds {

		if (!points.length)
			return undefined;

		if (points.length == 1)
			return new CBounds(points[0], points[0]);

		var bounds = new CBounds(points[0], points[1]);
		for (var i: number = 2; i < points.length; ++i)
			bounds.extend(points[i]);

		return bounds;
	}

	static parse(rectString: string): CBounds {

		var rectParts = rectString.match(/\d+/g);
		if (rectParts === null || rectParts.length < 4) {
			console.error('incomplete rectangle');
			return undefined;
		}

		var refPoint1 = new CPoint(parseInt(rectParts[0]), parseInt(rectParts[1]));
		var offset = new CPoint(parseInt(rectParts[2]), parseInt(rectParts[3]));
		var refPoint2 = refPoint1.add(offset);

		return new CBounds(refPoint1, refPoint2);
	};

	static parseArray(rectListString: string): Array<CBounds> {

		var parts = rectListString.match(/\d+/g);
		if (parts === null || parts.length < 4) {
			return new Array<CBounds>();
		}

		var rectangles = new Array<CBounds>();
		for (var i = 0; (i + 3) < parts.length; i += 4) {
			var refPoint1 = new CPoint(parseInt(parts[i]), parseInt(parts[i + 1]));
			var offset = new CPoint(parseInt(parts[i + 2]), parseInt(parts[i + 3]));
			var refPoint2 = refPoint1.add(offset);
			rectangles.push(new CBounds(refPoint1, refPoint2));
		}

		return rectangles;
	};

	// extend the bounds to contain the given point
	extend(point: CPoint): CBounds {

		if (!this.min && !this.max) {
			this.min = point.clone();
			this.max = point.clone();
		} else {
			this.min.x = Math.min(point.x, this.min.x);
			this.max.x = Math.max(point.x, this.max.x);
			this.min.y = Math.min(point.y, this.min.y);
			this.max.y = Math.max(point.y, this.max.y);
		}
		return this;
	}

	clone(): CBounds {
		return new CBounds(this.min, this.max);
	}

	getCenter(round: boolean = false): CPoint {
		return new CPoint(
		        (this.min.x + this.max.x) / 2,
		        (this.min.y + this.max.y) / 2, round);
	}

	round() {
		this.min.x = Math.round(this.min.x);
		this.min.y = Math.round(this.min.y);
		this.max.x = Math.round(this.max.x);
		this.max.y = Math.round(this.max.y);
	}

	getBottomLeft(): CPoint {
		return new CPoint(this.min.x, this.max.y);
	}

	getTopRight(): CPoint {
		return new CPoint(this.max.x, this.min.y);
	}

	getTopLeft(): CPoint {
		return new CPoint(this.min.x, this.min.y);
	}

	getBottomRight(): CPoint {
		return new CPoint(this.max.x, this.max.y);
	}

	getSize(): CPoint {
		return this.max.subtract(this.min);
	}

	contains(obj: CBounds | CPoint): boolean {
		var min: CPoint, max: CPoint;

		if (obj instanceof CBounds) {
			min = obj.min;
			max = obj.max;
		} else {
			min = max = obj;
		}

		return (min.x >= this.min.x) &&
		       (max.x <= this.max.x) &&
		       (min.y >= this.min.y) &&
		       (max.y <= this.max.y);
	}

	intersects(bounds: CBounds): boolean { // (Bounds) -> Boolean

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
		    yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	}

	// non-destructive, returns a new Bounds
	add(point: CPoint): CBounds {
		return this.clone()._add(point);
	}

	// destructive, used directly for performance in situations where it's safe to modify existing Bounds
	_add(point: CPoint): CBounds {
		this.min._add(point);
		this.max._add(point);
		return this;
	}

	getPointArray(): Array<CPoint> {
		return Array<CPoint>(
			this.getBottomLeft(), this.getBottomRight(),
			this.getTopLeft(), this.getTopRight()
		);
	}

	toString(): string {
		return '[' +
		        this.min.toString() + ', ' +
		        this.max.toString() + ']';
	}

	isValid(): boolean {
		return !!(this.min && this.max);
	}

	intersectsAny(boundsArray: Array<CBounds>): boolean {
		for (var i = 0; i < boundsArray.length; ++i) {
			if (boundsArray[i].intersects(this)) {
				return true;
			}
		}

		return false;
	}

	clampX(x: number): number {
		return Math.max(this.min.x, Math.min(this.max.x, x));
	}

	clampY(y: number): number {
		return Math.max(this.min.y, Math.min(this.max.y, y));
	}

	clampPoint(obj: CPoint): CPoint {
		return new CPoint(
			this.clampX(obj.x),
			this.clampY(obj.y)
		);
	}

	clampBounds(obj: CBounds): CBounds {
		return new CBounds(
			new CPoint(
				this.clampX(obj.min.x),
				this.clampY(obj.min.y)
			),

			new CPoint(
				this.clampX(obj.max.x),
				this.clampY(obj.max.y)
			)
		);
	}

	equals(bounds: CBounds): boolean {
		return this.min.equals(bounds.min) && this.max.equals(bounds.max);
	}
};
