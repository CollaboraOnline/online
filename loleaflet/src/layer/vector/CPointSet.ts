/* eslint-disable */

/*
 * CPointSet is a recursive datastructure used to represent a set of points connected by lines.
 * This is used by CPolyline and hence CPolygon classes to represent set of disconnected/disjoint
 * open/closed polygons respectively.
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

	empty(): boolean {
		return (
			(this.points === undefined && this.pointSets === undefined) ||
			(this.pointSets === undefined && this.points.length == 0));
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