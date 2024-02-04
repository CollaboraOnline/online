/*
 * CPointSet is a recursive datastructure used to represent a set of points connected by lines.
 * This is used by CPolyline and hence CPolygon classes to represent set of disconnected/disjoint
 * open/closed polygons respectively.
 */

import { Bounds } from '../../geometry/Bounds';
import { Point } from '../../geometry/Point';

export class CPointSet {
	private points: Array<Point>;
	private pointSets: Array<CPointSet>;

	static fromPointArray(array: Array<Point>) {
		var ps = new CPointSet();
		ps.points = array;
		return ps;
	}

	static fromSetArray(array: Array<CPointSet>) {
		var ps = new CPointSet();
		ps.pointSets = array;
		return ps;
	}

	static fromBounds(bounds: Bounds) {
		var ps = new CPointSet();
		ps.points = [
			bounds.getTopLeft(),
			bounds.getTopRight(),
			bounds.getBottomRight(),
			bounds.getBottomLeft()];
		return ps;
	}

	isFlat(): boolean {
		return this.points !== undefined;
	}

	empty(): boolean {
		return (
			(this.points === undefined && this.pointSets === undefined) ||
			(this.pointSets === undefined && this.points.length == 0));
	}

	getPointArray(): Array<Point> {
		return this.points;
	}

	getSetArray(): Array<CPointSet> {
		return this.pointSets;
	}

	setPointArray(array: Array<Point>) {
		this.points = array;
		this.pointSets = undefined;
	}

	setSetArray(array: Array<CPointSet>) {
		this.points = undefined;
		this.pointSets = array;
	}

	// This is used in CCellSelection to draw multiple polygons based on a "inner" point-set
	// where we need to apply an additive offset to each point in the pointSet w.r.t each polygon's centroid.
	applyOffset(offset: Point, centroidSymmetry: boolean = false, preRound: boolean = true) {
		CPointSet.applyOffsetImpl(this, offset, centroidSymmetry, preRound);
	}

	clone(): CPointSet {
		return CPointSet.cloneImpl(this);
	}

	private static cloneImpl(source: CPointSet): CPointSet {
		const newPointSet = new CPointSet();

		if (source.points) {
			newPointSet.points = [];
			source.points.forEach(function(point) {
				newPointSet.points.push(point.clone());
			});
		} else if (source.pointSets) {
			newPointSet.pointSets = [];
			source.pointSets.forEach(function (childPointSet) {
				const clonedChild = CPointSet.cloneImpl(childPointSet);
				newPointSet.pointSets.push(clonedChild);
			});
		}

		return newPointSet;
	}

	private static applyOffsetImpl(pointSet: CPointSet, offset: Point, centroidSymmetry: boolean, preRound: boolean) {
		if (pointSet.empty())
			return;

		if (pointSet.isFlat()) {
			const refPoint = new Point(Infinity, Infinity);
			if (centroidSymmetry) {
				refPoint.x = 0;
				refPoint.y = 0;
				// Compute centroid for this set of points.
				pointSet.points.forEach(function (point) {
					refPoint._add(point);
				});
				refPoint._divideBy(pointSet.points.length);
			}
			pointSet.points.forEach(function (point, index) {
				if (preRound)
					pointSet.points[index]._round();

				if (point.x < refPoint.x)
					pointSet.points[index].x -= offset.x;
				else
					pointSet.points[index].x += offset.x;

				if (point.y < refPoint.y)
					pointSet.points[index].y -= offset.y;
				else
					pointSet.points[index].y += offset.y;
			});

			return;
		}

		// not flat so recurse.
		pointSet.pointSets.forEach(function(childPointSet) {
			CPointSet.applyOffsetImpl(childPointSet, offset, centroidSymmetry, preRound);
		});
	}
}
