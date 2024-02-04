/*
 * CPolyUtil contains utility functions for polygons.
 */

import { Point } from '../../geometry/Point';
import { CPointSet } from './CPointSet';

export namespace CPolyUtil {

	export function rectanglesToPointSet(rectangles: Array<Array<Point>>, unitConverter: (point: Point) => Point): CPointSet {
		/* An Implementation based on O'ROURKE, Joseph. "Uniqueness of orthogonal connect-the-dots."
		   Machine Intelligence and Pattern Recognition. Vol. 6. North-Holland, 1988. 97-104.
		   http://www.science.smith.edu/~jorourke/Papers/OrthoConnect.pdf
		*/
		var eps = 20;
		// Glue rectangles if the space between them is less then eps
		for (var i = 0; i < rectangles.length - 1; i++) {
			for (var j = i + 1; j < rectangles.length; j++) {
				for (var k = 0; k < rectangles[i].length; k++) {
					for (var l = 0; l < rectangles[j].length; l++) {
						if (Math.abs(rectangles[i][k].x - rectangles[j][l].x) < eps) {
							rectangles[j][l].x = rectangles[i][k].x;
						}
						if (Math.abs(rectangles[i][k].y - rectangles[j][l].y) < eps) {
							rectangles[j][l].y = rectangles[i][k].y;
						}
					}
				}
			}
		}

		var points = new Map<Point, Point>();
		for (i = 0; i < rectangles.length; i++) {
			for (j = 0; j < rectangles[i].length; j++) {
				if (points.has(rectangles[i][j])) {
					points.delete(rectangles[i][j]);
				}
				else {
					points.set(rectangles[i][j], rectangles[i][j]);
				}
			}
		}

		function getKeys(points: Map<Point, Point>): Array<Point> {
			var keys: Array<Point> = [];
			points.forEach((_: Point, key: Point) => {
				keys.push(key);
			});
			return keys;
		}

		// Point comparison function for sorting a list of CPoints w.r.t x-coordinate.
		// When the points have same x-coordinate break tie based on y-coordinates.
		function xThenY(ap: Point, bp: Point): number {
			if (ap.x < bp.x || (ap.x === bp.x && ap.y < bp.y)) {
				return -1;
			}
			else if (ap.x === bp.x && ap.y === bp.y) {
				return 0;
			}
			else {
				return 1;
			}
		}

		// Point comparison function for sorting a list of CPoints w.r.t y-coordinate.
		// When the points have same y-coordinate break tie based on x-coordinates.
		function yThenX(ap: Point, bp: Point): number {

			if (ap.y < bp.y || (ap.y === bp.y && ap.x < bp.x)) {
				return -1;
			}
			else if (ap.x === bp.x && ap.y === bp.y) {
				return 0;
			}
			else {
				return 1;
			}
		}

		var sortX = getKeys(points).sort(xThenY);
		var sortY = getKeys(points).sort(yThenX);

		var edgesH = new Map<Point, Point>();
		var edgesV = new Map<Point, Point>();

		var len = getKeys(points).length;
		i = 0;
		while (i < len) {
			var currY = points.get(sortY[i]).y;
			while (i < len && points.get(sortY[i]).y === currY) {
				edgesH.set(sortY[i], sortY[i + 1]);
				edgesH.set(sortY[i + 1], sortY[i]);
				i += 2;
			}
		}

		i = 0;
		while (i < len) {
			var currX = points.get(sortX[i]).x;
			while (i < len && points.get(sortX[i]).x === currX) {
				edgesV.set(sortX[i], sortX[i + 1]);
				edgesV.set(sortX[i + 1], sortX[i]);
				i += 2;
			}
		}

		var polygons = new Array<CPointSet>();
		var edgesHKeys = getKeys(edgesH);

		while (edgesHKeys.length > 0) {
			var p: Array<[Point, number]> = [[edgesHKeys[0], 0]];
			while (true) {
				var curr = p[p.length - 1][0];
				var e = p[p.length - 1][1];
				if (e === 0) {
					var nextVertex = edgesV.get(curr);
					edgesV.delete(curr);
					p.push([nextVertex, 1]);
				}
				else {
					var nextVertex = edgesH.get(curr);
					edgesH.delete(curr);
					p.push([nextVertex, 0]);
				}
				if (p[p.length - 1][0].equals(p[0][0]) && p[p.length - 1][1] === p[0][1]) {
					p.pop();
					break;
				}
			}
			var polygon = new Array<Point>();
			for (i = 0; i < p.length; i++) {
				polygon.push(unitConverter(points.get(p[i][0])));
				edgesH.delete(p[i][0]);
				edgesV.delete(p[i][0]);
			}
			polygon.push(unitConverter(points.get(p[0][0])));
			edgesHKeys = getKeys(edgesH);
			polygons.push(CPointSet.fromPointArray(polygon));
		}
		return CPointSet.fromSetArray(polygons);
	}
}
