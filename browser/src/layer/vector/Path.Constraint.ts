declare var L: any;

namespace cool {

export class Constraint {
	/**
	* Near means within +/- PI / 8 since we do diagonals
	*/
	public static angleNear (angle: number, near: number): boolean {
		return Math.abs(near - angle) < (Math.PI / 8);
	}

	/**
	* Will recalculate delta based on a shift constraint
	*/
	public static shiftConstraint (delta: Point): Point {
		var angle = delta.angleOf();

		if (Constraint.angleNear(angle, 0) || Constraint.angleNear(angle, Math.PI)) {
			// Snap back the y to 0
			return new Point(delta.x, 0);
		} else if (Constraint.angleNear(angle, Math.PI / 2) ||
			Constraint.angleNear(angle, -Math.PI / 2)) {

			// Snap back the x to 0
			return new Point(0, delta.y);
		} else {
			var deltaD = (Math.abs(delta.x) + Math.abs(delta.y)) / 2;
			if (Constraint.angleNear(angle, Math.PI / 4)) {
				return new Point(deltaD, deltaD);
			} else if (Constraint.angleNear(angle, -Math.PI / 4)) {
				return new Point(deltaD, -deltaD);
			} else if (Constraint.angleNear(angle, Math.PI * 0.75)) {
				return new Point(-deltaD, deltaD);
			} else {
				return new Point(-deltaD, -deltaD);
			}
		}
	}
}

}

L.Constraint = cool.Constraint;
