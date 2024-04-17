/*
 * CPolygon implements polygon vector layer (closed polyline with a fill inside).
 * This is used to draw overlays like cell-selections (self or views) with multi-selection support.
 */

class CPolygon extends CPolyline {

	constructor(pointSet: CPointSet, options: any) {
		super(pointSet, options);
		if (options.fill === undefined)
			this.fill = true;
	}

	getCenter(): cool.Point {
		var i: number;
		var j: number;
		var len: number;
		var p1: cool.Point;
		var p2: cool.Point;
		var f: number;
		var area: number;
		var x: number;
		var y: number;
		var points = this.rings[0];

		// polygon centroid algorithm; only uses the first ring if there are multiple

		area = x = y = 0;

		for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			p1 = points[i];
			p2 = points[j];

			f = p1.y * p2.x - p2.y * p1.x;
			x += (p1.x + p2.x) * f;
			y += (p1.y + p2.y) * f;
			area += f * 3;
		}

		return new cool.Point(x / area, y / area);
	}

	updatePath(paintArea?: cool.Bounds, paneBounds?: cool.Bounds, freezePane?: { freezeX: boolean, freezeY: boolean }) {

		this.parts = this.rings;

		// remove last point in the rings/parts if it equals first one
		for (var i = 0, len = this.rings.length; i < len; i++) {
			var ring = this.rings[i];
			var ringlen = ring.length;
			if (ring.length >= 2 && ring[0].equals(ring[ringlen - 1])) {
				ring.pop();
			}
		}

		this.simplifyPoints();
		this.renderer.updatePoly(this, true /* closed? */, paintArea, paneBounds, freezePane);
	}

	anyRingBoundContains(corePxPoint: cool.Point): boolean {
		for (var i = 0; i < this.rings.length; ++i) {
			var ringBound = new cool.Bounds(undefined);
			var ring = this.rings[i];
			for (var pointIdx = 0; pointIdx < ring.length; ++pointIdx) {
				ringBound.extend(ring[pointIdx]);
			}

			if (ring.length && ringBound.contains(corePxPoint))
				return true;
		}

		return false;
	}
}
