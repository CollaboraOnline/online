/* eslint-disable */

/*
 * CPoint represents a point with x and y coordinates.
 */

class CPoint {
    x: number;
    y: number;

    constructor(x: number, y: number, round: boolean = false) {
        this.x = (round ? Math.round(x) : x);
	    this.y = (round ? Math.round(y) : y);
    }

    static arrayToPoint(arr: Array<number>) : CPoint {
        return new CPoint(arr[0], arr[1]);
    }

    static parse(pointString: string): CPoint {

        var pointParts = pointString.match(/\d+/g);
        if (pointParts === null || pointParts.length < 2) {
            console.error('incomplete point');
            return undefined;
        }

        return new CPoint(parseInt(pointParts[0]), parseInt(pointParts[1]));
    };

    clone(): CPoint {
        return new CPoint(this.x, this.y);
    }

    // non-destructive, returns a new point
	add(point: CPoint): CPoint {
		return this.clone()._add(point);
	}

	// destructive, used directly for performance in situations where it's safe to modify existing point
	_add(point: CPoint): CPoint {
		this.x += point.x;
		this.y += point.y;
		return this;
	}

	subtract(point: CPoint): CPoint {
		return this.clone()._subtract(point);
	}

	_subtract(point: CPoint): CPoint {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	}

	divideBy(num: number): CPoint {
		return this.clone()._divideBy(num);
	}

	_divideBy(num: number): CPoint {
		this.x /= num;
		this.y /= num;
		return this;
	}

	multiplyBy(num: number): CPoint {
		return this.clone()._multiplyBy(num);
	}

	_multiplyBy(num: number): CPoint {
		this.x *= num;
		this.y *= num;
		return this;
	}

	round(): CPoint {
		return this.clone()._round();
	}

	_round(): CPoint {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
    }

	floor(): CPoint {
		return this.clone()._floor();
	}

	_floor(): CPoint {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	}

	ceil(): CPoint {
		return this.clone()._ceil();
	}

	_ceil(): CPoint {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	}

	distanceTo(point: CPoint): number {

		var x = point.x - this.x,
		    y = point.y - this.y;

		return Math.sqrt(x * x + y * y);
	}

	equals(point: CPoint): boolean {

		// Proper ieee 754 equality comparison.
		return Math.abs(point.x - this.x) < Number.EPSILON &&
			   Math.abs(point.y - this.y) < Number.EPSILON;
    }

	contains(point: CPoint): boolean {

		return Math.abs(point.x) <= Math.abs(this.x) &&
		       Math.abs(point.y) <= Math.abs(this.y);
	}

	assign(point: CPoint): boolean {
		var xChanged = this.setX(point.x);
		var yChanged = this.setY(point.y);
		return xChanged || yChanged;
    }

	setX(x: number): boolean {
		if (x === this.x) {
			return false;
		}

		this.x = x;
		return true;
	}

	setY(y: number): boolean {
		if (y === this.y) {
			return false;
		}

		this.y = y;
		return true;
	}

	toString(): string {
		return 'CPoint(' + this.x + ', ' + this.y + ')';
	}
};