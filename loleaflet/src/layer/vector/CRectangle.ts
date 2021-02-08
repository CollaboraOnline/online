/* eslint-disable */

/*
 * CRectangle extends CPolygon and creates a rectangle of given bounds.
 * This is used for drawing of the self and view cell-cursor on the canvas.
 */

class CRectangle extends CPolygon {

	constructor(bounds: CBounds, options: any) {
		super(CRectangle.boundsToPointSet(bounds), options);
	}

	setBounds(bounds: CBounds) {
		this.setPointSet(CRectangle.boundsToPointSet(bounds));
	}

	private static boundsToPointSet(bounds: CBounds): CPointSet {
		return CPointSet.fromPointArray([bounds.getTopLeft(), bounds.getTopRight(), bounds.getBottomRight(), bounds.getBottomLeft(), bounds.getTopLeft()]);
	}
}
