import { Point, PointConvertable, PointLike } from  './Point';

declare var L: any;

function PointConstruct(x: number, y: number, round?: boolean): Point {
	return new L.Point(x, y, round);
}

function toPoint(x: PointConvertable | number, y?: number, round?: boolean): Point {
	return L.point(x, y, round);
}

/// Bounds represents a rectangular area on the screen.
export class Bounds {

	public min: Point;
	public max: Point;

	constructor(a: PointConvertable[] | PointConvertable, b?: PointConvertable) {
		if (!a)
			return;

		var points = b ? [<PointConvertable>a, b] : <PointConvertable[]>[a];

		for (var i = 0, len = points.length; i < len; i++) {
			this.extend(points[i]);
		}
	}

	public static parse(rectString: string): Bounds {

		if (typeof rectString !== 'string') {
			console.error('invalid input type, expected string');
			return undefined;
		}

		var rectParts = rectString.match(/\d+/g);
		if (rectParts === null || rectParts.length < 4) {
			console.error('incomplete rectangle');
			return undefined;
		}

		var refPoint1 = PointConstruct(parseInt(rectParts[0]), parseInt(rectParts[1]));
		var offset = PointConstruct(parseInt(rectParts[2]), parseInt(rectParts[3]));
		var refPoint2 = refPoint1.add(offset);

		return new Bounds(refPoint1, refPoint2);
	}

	public static parseArray(rectListString: string): Bounds[] {

		if (typeof rectListString !== 'string') {
			console.error('invalid input type, expected string');
			return undefined;
		}

		var parts = rectListString.match(/\d+/g);
		if (parts === null || parts.length < 4) {
			return [];
		}

		var rectangles: Bounds[] = [];
		for (var i = 0; (i + 3) < parts.length; i += 4) {
			var refPoint1 = PointConstruct(parseInt(parts[i]), parseInt(parts[i + 1]));
			var offset = PointConstruct(parseInt(parts[i + 2]), parseInt(parts[i + 3]));
			var refPoint2 = refPoint1.add(offset);
			rectangles.push(new Bounds(refPoint1, refPoint2));
		}

		return rectangles;
	}

	// extend the bounds to contain the given point
	public extend(pointSrc: Point | Array<number> | PointLike): Bounds {
		var point = toPoint(pointSrc);

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

	public clone(): Bounds {
		return new Bounds(this.min, this.max);
	}

	public getCenter(round?: boolean): Point {
		return PointConstruct(
			(this.min.x + this.max.x) / 2,
			(this.min.y + this.max.y) / 2, round);
	}

	public round(): void {
		this.min.x = Math.round(this.min.x);
		this.min.y = Math.round(this.min.y);
		this.max.x = Math.round(this.max.x);
		this.max.y = Math.round(this.max.y);
	}

	public getBottomLeft(): Point {
		return PointConstruct(this.min.x, this.max.y);
	}

	public getTopRight(): Point {
		return PointConstruct(this.max.x, this.min.y);
	}

	public getTopLeft(): Point {
		return PointConstruct(this.min.x, this.min.y);
	}

	public getBottomRight(): Point {
		return PointConstruct(this.max.x, this.max.y);
	}

	public getSize(): Point {
		return this.max.subtract(this.min);
	}

	public contains(obj: Bounds | PointConvertable): boolean {
		var min, max;

		var bounds: Bounds;
		var point: Point;
		if (Array.isArray(obj) || obj instanceof L.Point) {
			point = toPoint(<PointConvertable>obj);
		} else {
			bounds = Bounds.toBounds(obj);
		}

		if (bounds) {
			min = bounds.min;
			max = bounds.max;
		} else {
			min = max = point;
		}

		return (min.x >= this.min.x) &&
			(max.x <= this.max.x) &&
			(min.y >= this.min.y) &&
			(max.y <= this.max.y);
	}

	public intersects(boundsSrc: Bounds | PointConvertable[]): boolean {
		var bounds = Bounds.toBounds(boundsSrc);

		var min = this.min;
		var max = this.max;
		var min2 = bounds.min;
		var max2 = bounds.max;
		var xIntersects = (max2.x >= min.x) && (min2.x <= max.x);
		var yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	}

	// non-destructive, returns a new Bounds
	public add(point: Point): Bounds {
		return this.clone()._add(point);
	}

	// destructive, used directly for performance in situations where it's safe to modify existing Bounds
	public _add(point: Point): Bounds {
		this.min._add(point);
		this.max._add(point);
		return this;
	}

	public getPointArray(): Point[] {
		return [
			this.getBottomLeft(), this.getBottomRight(),
			this.getTopLeft(), this.getTopRight()
		];
	}

	public toString(): string {
		return '[' +
			this.min.toString() + ', ' +
			this.max.toString() + ']';
	}

	public isValid(): boolean {
		return !!(this.min && this.max);
	}

	public intersectsAny(boundsArray: Bounds[]): boolean {
		for (var i = 0; i < boundsArray.length; ++i) {
			if (boundsArray[i].intersects(this)) {
				return true;
			}
		}

		return false;
	}

	public clampX(x: number): number {
		return Math.max(this.min.x, Math.min(this.max.x, x));
	}

	public clampY(y: number): number {
		return Math.max(this.min.y, Math.min(this.max.y, y));
	}

	public clamp(obj: Point | Bounds): Point | Bounds {
		if (obj instanceof L.Point) {
			return PointConstruct(
				this.clampX((obj as Point).x),
				this.clampY((obj as Point).y)
			);
		}

		if (obj instanceof Bounds) {
			return new Bounds(
				PointConstruct(
					this.clampX((obj as Bounds).min.x),
					this.clampY((obj as Bounds).min.y)
				),

				PointConstruct(
					this.clampX((obj as Bounds).max.x),
					this.clampY((obj as Bounds).max.y)
				)
			);
		}

		console.error('invalid argument type');
	}

	public equals(bounds: Bounds): boolean {
		return this.min.equals(bounds.min) && this.max.equals(bounds.max);
	}

	public toRectangle(): number[] {
		return [
			this.min.x, this.min.y,
			this.max.x - this.min.x,
			this.max.y - this.min.y
		];
	}

	public toCoreString(): string {
		return this.min.x + ', ' + this.min.y + ', ' + (this.max.x - this.min.x) + ', ' + (this.max.y - this.min.y);
	}

	public static toBounds(a: Bounds | PointConvertable | PointConvertable[], b?: PointConvertable): Bounds {
		if (!a || a instanceof Bounds) {
			return <Bounds>a;
		}

		return new Bounds(a, b);
	}
}

L.Bounds = Bounds;
L.bounds = Bounds.toBounds;
