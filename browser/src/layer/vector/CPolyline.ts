import { CPath } from './CPath';
import { CPointSet } from './CPointSet';
import { Bounds } from '../../geometry/Bounds';
import { Point } from '../../geometry/Point';
import { CLineUtil } from './CLineUtil';

/*
 * CPolyline implements polyline vector layer (a set of points connected with lines).
 * This class implements basic line drawing and CPointSet datastructure which is to be used
 * by the subclass CPolygon for drawing of overlays like cell-selections, cell-cursors etc.
 */

export class CPolyline extends CPath {

	// how much to simplify the polyline on each zoom level
	// more = better performance and smoother look, less = more accurate
	private smoothFactor: number = 1.0;
	protected noClip: boolean = false;
	private pointSet: CPointSet;
	private bounds: Bounds;
	protected rings: Array<Array<Point>>;
	protected parts: Array<Array<Point>>;

	constructor(pointSet: CPointSet, options: any) {
		super(options);
		this.smoothFactor = options.smoothFactor !== undefined ? options.smoothFactor : this.smoothFactor;
		this.setPointSet(pointSet);
	}

	getPointSet(): CPointSet {
		return this.pointSet;
	}

	setPointSet(pointSet: CPointSet) {
		var oldBounds: Bounds;
		if (this.bounds)
			oldBounds = this.bounds.clone();
		else
			oldBounds = new Bounds(undefined);

		this.pointSet = pointSet;
		this.updateRingsBounds();
		if (this.pointSet.empty()) {
			this.closePopup({});
		}

		if (this.renderer)
			this.renderer.setPenOnOverlay();

		return this.redraw(oldBounds);
	}

	updateRingsBounds() {
		this.rings = new Array<Array<Point>>();
		var bounds = this.bounds = new Bounds(undefined);

		if (this.pointSet.empty()) {
			return;
		}

		CPolyline.calcRingsBounds(this.pointSet, this.rings, (pt: Point) => {
			bounds.extend(pt);
		});
	}

	// Converts the point-set datastructure into an array of point-arrays each of which is called a 'ring'.
	// While doing that it also computes the bounds too.
	private static calcRingsBounds(pset: CPointSet, rings: Array<Array<Point>>, updateBounds: (pt: Point) => void) {
		if (pset.isFlat()) {
			var srcArray = pset.getPointArray();
			if (srcArray === undefined) {
				rings.push([]);
				return;
			}
			var array = Array<Point>(srcArray.length);
			srcArray.forEach((pt: Point, index: number) => {
				array[index] = pt.clone();
				updateBounds(pt);
			});

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

	private static getPoints(pset: CPointSet): Array<Point> {
		if (pset.isFlat()) {
			var parray = pset.getPointArray();
			return parray === undefined ? [] : parray;
		}

		var psetArray = pset.getSetArray();
		if (psetArray && psetArray.length) {
			return CPolyline.getPoints(psetArray[0]);
		}

		return [];
	}

	getCenter(): Point {
		var i: number;
		var halfDist: number;
		var segDist: number;
		var dist: number;
		var p1: Point;
		var p2: Point;
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
				return new Point(
					p2.x - ratio * (p2.x - p1.x),
					p2.y - ratio * (p2.y - p1.y)
				);
			}
		}
	}

	getBounds(): Bounds {
		return this.bounds;
	}

	getHitBounds(): Bounds {
		if (!this.bounds.isValid())
			return this.bounds;

		// add clicktolerance for hit detection/etc.
		var w = this.clickTolerance();
		var p = new Point(w, w);
		return new Bounds(this.bounds.getTopLeft().subtract(p), this.bounds.getBottomRight().add(p));
	}

	updatePath(paintArea?: Bounds, paneBounds?: Bounds) {
		this.clipPoints(paintArea);
		this.simplifyPoints();

		this.renderer.updatePoly(this, false /* closed? */, paintArea, paneBounds);
	}

	// clip polyline by renderer bounds so that we have less to render for performance
	clipPoints(paintArea?: Bounds) {
		if (this.noClip) {
			this.parts = this.rings;
			return;
		}

		this.parts = new Array<Array<Point>>();

		var parts = this.parts;
		var bounds = paintArea ? paintArea : this.renderer.getBounds();
		var i: number;
		var j: number;
		var k: number;
		var len: number;
		var len2: number;
		var segment: Array<Point>;
		var points: Array<Point>;

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

	getParts(): Array<Array<Point>> {
		return this.parts;
	}

	empty(): boolean {
		return this.pointSet.empty();
	}
}
