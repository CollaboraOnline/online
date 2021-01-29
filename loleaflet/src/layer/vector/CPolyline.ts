/* eslint-disable */
/// <reference path="CLineUtil.ts" />

/*
 * CPolyline implements polyline vector layer (a set of points connected with lines)
 */

class CPointSet {
	private points: Array<CPoint>;
	private pointSets: Array<CPointSet>;

	static fromPointArray(array: Array<CPoint>) {
		var ps = new CPointSet();
		ps.points = array;
		return ps;
	}

	static fromSetArray(array: Array<CPointSet>) {
		var ps = new CPointSet();
		ps.pointSets = array;
		return ps;
	}

	isFlat(): boolean {
		return this.points !== undefined;
	}

	getPointArray(): Array<CPoint> {
		return this.points;
	}

	getSetArray(): Array<CPointSet> {
		return this.pointSets;
	}

	setPointArray(array: Array<CPoint>) {
		this.points = array;
		this.pointSets = undefined;
	}

	setSetArray(array: Array<CPointSet>) {
		this.points = undefined;
		this.pointSets = array;
	}
};

class CPolyline extends CPath {

	// how much to simplify the polyline on each zoom level
	// more = better performance and smoother look, less = more accurate
	private smoothFactor: number = 1.0;
	protected noClip: boolean = false;
	private pointSet: CPointSet;
	private bounds: CBounds;
	protected rings: Array<Array<CPoint>>;
	protected parts: Array<Array<CPoint>>;

	constructor(pointSet: CPointSet, options: any) {
		super(options);
		this.smoothFactor = options.smoothFactor !== undefined ? options.smoothFactor : this.smoothFactor;
		this.setPointSet(pointSet);
	}

	getPointSet(): CPointSet {
		return this.pointSet;
	}

	setPointSet(pointSet: CPointSet) {
		this.pointSet = pointSet;
		this.updateRingsBounds();
		return this.redraw();
	}

	updateRingsBounds() {
		this.rings = new Array<Array<CPoint>>();
		var bounds = this.bounds = new CBounds();

		CPolyline.calcRingsBounds(this.pointSet, this.rings, (pt: CPoint) => {
			bounds.extend(pt);
		});
	}

	// Converts the point-set datastructure into an array of point-arrays each of which is called a 'ring'.
	// While doing that it also computes the bounds too.
	private static calcRingsBounds(pset: CPointSet, rings: Array<Array<CPoint>>, updateBounds: (pt: CPoint) => void) {
		if (pset.isFlat()) {
			var srcArray = pset.getPointArray();
			var array = Array<CPoint>(srcArray.length);
			srcArray.forEach((pt: CPoint, index: number) => {
				array[index] = pt.clone();
				updateBounds(pt);
			})

			rings.push(array);
			return;
		}

		var psetArray = pset.getSetArray();
		if (psetArray) {
			psetArray.forEach((psetNext: CPointSet) => {
				CPolyline.calcRingsBounds(psetNext, rings, updateBounds);
			});
		}
	}

	private static getPoints(pset: CPointSet): Array<CPoint> {
		if (pset.isFlat()) {
			return pset.getPointArray();
		}

		var psetArray = pset.getSetArray();
		if (psetArray && psetArray.length) {
			return CPolyline.getPoints(psetArray[0]);
		}

		return [];
	}

	getCenter(): CPoint {
		var i: number;
		var halfDist: number;
		var segDist: number;
		var dist: number;
		var p1: CPoint;
		var p2: CPoint;
		var ratio: number;
		var points = CPolyline.getPoints(this.pointSet);
		var len = points.length;

		// polyline centroid algorithm; only uses the first ring if there are multiple

		for (i = 0, halfDist = 0; i < len - 1; i++) {
			halfDist += points[i].distanceTo(points[i + 1]) / 2;
		}

		for (i = 0, dist = 0; i < len - 1; i++) {
			p1 = points[i];
			p2 = points[i + 1];
			segDist = p1.distanceTo(p2);
			dist += segDist;

			if (dist > halfDist) {
				ratio = (dist - halfDist) / segDist;
				return new CPoint(
					p2.x - ratio * (p2.x - p1.x),
					p2.y - ratio * (p2.y - p1.y)
				);
			}
		}
	}

	getBounds(): CBounds {
		return this.bounds;
	}

	getHitBounds(): CBounds {
		// add clicktolerance for hit detection/etc.
		var w = this.clickTolerance();
		var p = new CPoint(w, w);
		return new CBounds(this.bounds.getTopLeft().subtract(p), this.bounds.getBottomRight().add(p));
	}

	updatePath(paintArea?: CBounds, paneXFixed?: boolean, paneYFixed?: boolean) {
		this.clipPoints(paintArea);
		this.simplifyPoints();

		this.renderer.updatePoly(this, false /* closed? */, paneXFixed, paneYFixed);
	}

	// clip polyline by renderer bounds so that we have less to render for performance
	clipPoints(paintArea?: CBounds) {
		if (this.noClip) {
			this.parts = this.rings;
			return;
		}

		this.parts = new Array<Array<CPoint>>();

		var parts = this.parts;
		var bounds = paintArea ? paintArea : this.renderer.getBounds();
		var i: number;
		var j: number;
		var k: number;
		var len: number;
		var len2: number;
		var segment: Array<CPoint>;
		var points: Array<CPoint>;

		for (i = 0, k = 0, len = this.rings.length; i < len; i++) {
			points = this.rings[i];

			for (j = 0, len2 = points.length; j < len2 - 1; j++) {
				segment = CLineUtil.clipSegment(points[j], points[j + 1], bounds, j != 0, true);

				if (!segment.length) { continue; }

				parts[k] = parts[k] || [];
				parts[k].push(segment[0]);

				// if segment goes out of screen, or it's the last one, it's the end of the line part
				if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
					parts[k].push(segment[1]);
					k++;
				}
			}
		}
	}

	// simplify each clipped part of the polyline for performance
	simplifyPoints() {
		var parts = this.parts;
		var tolerance = this.smoothFactor;

		for (var i: number = 0, len = parts.length; i < len; i++) {
			parts[i] = CLineUtil.simplify(parts[i], tolerance);
		}
	}

	getParts(): Array<Array<CPoint>> {
		return this.parts;
	}

	empty(): boolean {
		// Overridden in implementations.
		return this.parts.length > 0;
	}
};
