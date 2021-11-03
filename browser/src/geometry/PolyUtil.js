/* -*- js-indent-level: 8 -*- */
/*
 * L.PolyUtil contains utility functions for polygons (clipping, etc.).
 */

L.PolyUtil = {};

/*
 * Sutherland-Hodgeman polygon clipping algorithm.
 * Used to avoid rendering parts of a polygon that are not currently visible.
 */
L.PolyUtil.clipPolygon = function (points, bounds, round) {
	var clippedPoints,
	    edges = [1, 4, 2, 8],
	    i, j, k,
	    a, b,
	    len, edge, p,
	    lu = L.LineUtil;

	for (i = 0, len = points.length; i < len; i++) {
		points[i]._code = lu._getBitCode(points[i], bounds);
	}

	// for each edge (left, bottom, right, top)
	for (k = 0; k < 4; k++) {
		edge = edges[k];
		clippedPoints = [];

		for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			a = points[i];
			b = points[j];

			// if a is inside the clip window
			if (!(a._code & edge)) {
				// if b is outside the clip window (a->b goes out of screen)
				if (b._code & edge) {
					p = lu._getEdgeIntersection(b, a, edge, bounds, round);
					p._code = lu._getBitCode(p, bounds);
					clippedPoints.push(p);
				}
				clippedPoints.push(a);

			// else if b is inside the clip window (a->b enters the screen)
			} else if (!(b._code & edge)) {
				p = lu._getEdgeIntersection(b, a, edge, bounds, round);
				p._code = lu._getBitCode(p, bounds);
				clippedPoints.push(p);
			}
		}
		points = clippedPoints;
	}

	return points;
};

L.PolyUtil.rectanglesToPolygons = function (rectangles, docLayer, dontConvert) {
	// algorithm found here http://stackoverflow.com/questions/13746284/merging-multiple-adjacent-rectangles-into-one-polygon
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

	var points = {};
	for (i = 0; i < rectangles.length; i++) {
		for (j = 0; j < rectangles[i].length; j++) {
			if (points[rectangles[i][j]]) {
				delete points[rectangles[i][j]];
			}
			else {
				points[rectangles[i][j]] = rectangles[i][j];
			}
		}
	}

	function getKeys(points) {
		var keys = [];
		for (var key in points) {
			if (Object.prototype.hasOwnProperty.call(points, key)) {
				keys.push(key);
			}
		}
		return keys;
	}

	function xThenY(aStr, bStr) {
		var a = aStr.match(/\d+/g);
		a[0] = parseInt(a[0]);
		a[1] = parseInt(a[1]);
		var b = bStr.match(/\d+/g);
		b[0] = parseInt(b[0]);
		b[1] = parseInt(b[1]);

		if (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) {
			return -1;
		}
		else if (a[0] === b[0] && a[1] === b[1]) {
			return 0;
		}
		else {
			return 1;
		}
	}

	function yThenX(aStr, bStr) {
		var a = aStr.match(/\d+/g);
		a[0] = parseInt(a[0]);
		a[1] = parseInt(a[1]);
		var b = bStr.match(/\d+/g);
		b[0] = parseInt(b[0]);
		b[1] = parseInt(b[1]);

		if (a[1] < b[1] || (a[1] === b[1] && a[0] < b[0])) {
			return -1;
		}
		else if (a[0] === b[0] && a[1] === b[1]) {
			return 0;
		}
		else {
			return 1;
		}
	}

	var sortX = getKeys(points).sort(xThenY);
	var sortY = getKeys(points).sort(yThenX);

	var edgesH = {};
	var edgesV = {};

	var len = getKeys(points).length;
	i = 0;
	while (i < len) {
		var currY = points[sortY[i]].y;
		while (i < len && points[sortY[i]].y === currY) {
			edgesH[sortY[i]] = sortY[i + 1];
			edgesH[sortY[i + 1]] = sortY[i];
			i += 2;
		}
	}

	i = 0;
	while (i < len) {
		var currX = points[sortX[i]].x;
		while (i < len && points[sortX[i]].x === currX) {
			edgesV[sortX[i]] = sortX[i + 1];
			edgesV[sortX[i + 1]] = sortX[i];
			i += 2;
		}
	}

	var polygons = [];
	var edgesHKeys = getKeys(edgesH);
	while (edgesHKeys.length > 0) {
		var p = [[edgesHKeys[0], 0]];
		while (true) {
			var curr = p[p.length - 1][0];
			var e = p[p.length - 1][1];
			if (e === 0) {
				var nextVertex = edgesV[curr];
				delete edgesV[curr];
				p.push([nextVertex, 1]);
			}
			else {
				nextVertex = edgesH[curr];
				delete edgesH[curr];
				p.push([nextVertex, 0]);
			}
			if (p[p.length - 1][0] === p[0][0] && p[p.length - 1][1] === p[0][1]) {
				p.pop();
				break;
			}
		}
		var polygon = [];
		for (i = 0; i < p.length; i++) {
			if (!dontConvert)
				polygon.push(docLayer._twipsToLatLng(points[p[i][0]]));
			else
				polygon.push(points[p[i][0]]);
			delete edgesH[p[i][0]];
			delete edgesV[p[i][0]];
		}

		if (!dontConvert)
			polygon.push(docLayer._twipsToLatLng(points[p[0][0]]));
		else
			polygon.push(points[p[0][0]]);

		edgesHKeys = getKeys(edgesH);
		polygons.push(polygon);
	}
	return polygons;
};
