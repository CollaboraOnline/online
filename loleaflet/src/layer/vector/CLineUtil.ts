/* -*- js-indent-level: 8 -*- */
/*
 * CLineUtil contains different utility functions for line segments
 * and polylines (clipping, simplification, distances, etc.)
 */

namespace CLineUtil {

    var _lastCode: number = 0;

	// Simplify polyline with vertex reduction and Douglas-Peucker simplification.
	// Improves rendering performance dramatically by lessening the number of points to draw.

	export function simplify(points: Array<CPoint>, tolerance: number): Array<CPoint> {
		if (!tolerance || !points.length) {
			return points.slice();
		}

		var sqTolerance = tolerance * tolerance;

		// stage 1: vertex reduction
		points = _reducePoints(points, sqTolerance);

		// stage 2: Douglas-Peucker simplification
		points = _simplifyDP(points, sqTolerance);

		return points;
	}

	// distance from a point to a segment between two points
	function pointToSegmentDistance(p: CPoint, p1: CPoint, p2: CPoint) {
		return Math.sqrt(_sqDistToClosestPointOnSegment(p, p1, p2));
	}

	// Douglas-Peucker simplification, see http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm
	function _simplifyDP(points: Array<CPoint>, sqTolerance: number): Array<CPoint> {

		var len = points.length;
		var markers = typeof Uint8Array !== undefined + '' ? new Uint8Array(len) : Array<boolean>(len);

		markers[0] = markers[len - 1] = true;

		_simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

		var i: number;
		var newPoints = Array<CPoint>();

		for (i = 0; i < len; i++) {
			if (markers[i]) {
				newPoints.push(points[i]);
			}
		}

		return newPoints;
	}

	function _simplifyDPStep(points: Array<CPoint>, markers: Uint8Array | Array<boolean>, sqTolerance: number, first: number, last: number) {

		var maxSqDist = 0;
        var index: number;
        var i: number;
        var sqDist: number;

		for (i = first + 1; i <= last - 1; i++) {
			sqDist = _sqDistToClosestPointOnSegment(points[i], points[first], points[last]);

			if (sqDist > maxSqDist) {
				index = i;
				maxSqDist = sqDist;
			}
		}

		if (maxSqDist > sqTolerance) {
			markers[index] = true;

			_simplifyDPStep(points, markers, sqTolerance, first, index);
			_simplifyDPStep(points, markers, sqTolerance, index, last);
		}
	}

	// reduce points that are too close to each other to a single point
	function _reducePoints(points: Array<CPoint>, sqTolerance: number): Array<CPoint> {
		var reducedPoints = [points[0]];

		for (var i = 1, prev = 0, len = points.length; i < len; i++) {
			if (_sqDist(points[i], points[prev]) > sqTolerance) {
				reducedPoints.push(points[i]);
				prev = i;
			}
		}
		if (prev < len - 1) {
			reducedPoints.push(points[len - 1]);
		}
		return reducedPoints;
	}

	// Cohen-Sutherland line clipping algorithm.
	// Used to avoid rendering parts of a polyline that are not currently visible.

	export function clipSegment(a: CPoint, b: CPoint, bounds: CBounds, useLastCode: boolean, round: boolean): Array<CPoint> {
		var codeA = useLastCode ? _lastCode : _getBitCode(a, bounds);
		var codeB = _getBitCode(b, bounds);
        var codeOut: number;
        var p: CPoint
        var newCode: number;

		// save 2nd code to avoid calculating it on the next segment
		_lastCode = codeB;

		while (true) {
			// if a,b is inside the clip window (trivial accept)
			if (!(codeA | codeB)) {
				return [a, b];
			// if a,b is outside the clip window (trivial reject)
			} else if (codeA & codeB) {
				return [];
			// other cases
			} else {
				codeOut = codeA || codeB;
				p = _getEdgeIntersection(a, b, codeOut, bounds, round);
				newCode = _getBitCode(p, bounds);

				if (codeOut === codeA) {
					a = p;
					codeA = newCode;
				} else {
					b = p;
					codeB = newCode;
				}
			}
		}
	}

	function _getEdgeIntersection(a: CPoint, b: CPoint, code: number, bounds: CBounds, round: boolean): CPoint {
		var dx = b.x - a.x;
        var dy = b.y - a.y;
		var min = bounds.min;
		var max = bounds.max;
        var x: number;
        var y: number;

		if (code & 8) { // top
			x = a.x + dx * (max.y - a.y) / dy;
			y = max.y;

		} else if (code & 4) { // bottom
			x = a.x + dx * (min.y - a.y) / dy;
			y = min.y;

		} else if (code & 2) { // right
			x = max.x;
			y = a.y + dy * (max.x - a.x) / dx;

		} else if (code & 1) { // left
			x = min.x;
			y = a.y + dy * (min.x - a.x) / dx;
		}

		return new CPoint(x, y, round);
	}

	function _getBitCode(p: CPoint, bounds: CBounds): number {
		var code = 0;

		if (p.x < bounds.min.x) { // left
			code |= 1;
		} else if (p.x > bounds.max.x) { // right
			code |= 2;
		}

		if (p.y < bounds.min.y) { // bottom
			code |= 4;
		} else if (p.y > bounds.max.y) { // top
			code |= 8;
		}

		return code;
	}

	// square distance (to avoid unnecessary Math.sqrt calls)
	function _sqDist(p1: CPoint, p2: CPoint): number {
		var dx = p2.x - p1.x,
		    dy = p2.y - p1.y;
		return dx * dx + dy * dy;
	}

	// return closest point on segment or distance to that point
	function _sqClosestPointOnSegment(p: CPoint, p1: CPoint, p2: CPoint): CPoint {
		var x = p1.x;
		var y = p1.y;
		var dx = p2.x - x;
		var dy = p2.y - y;
		var dot = dx * dx + dy * dy;
		var t: number;

		if (dot > 0) {
			t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

			if (t > 1) {
				x = p2.x;
				y = p2.y;
			} else if (t > 0) {
				x += dx * t;
				y += dy * t;
			}
		}

		return new CPoint(x, y);
    }

    // returns distance to closest point on segment.
	function _sqDistToClosestPointOnSegment(p: CPoint, p1: CPoint, p2: CPoint): number {
        return _sqDist(_sqClosestPointOnSegment(p, p1, p2), p);
	}
}
