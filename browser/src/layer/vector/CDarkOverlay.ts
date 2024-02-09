/*
 * CDarkOverlay is used to render a dark overlay around an OLE object when selected
 */

import { Bounds } from '../../geometry/Bounds';
import { Point } from '../../geometry/Point';
import { CPointSet } from './CPointSet';
import { CPathGroup } from './CPath';
import { CRectangle } from './CRectangle';

export class CDarkOverlay extends CPathGroup {

	private rectangles: CRectangle[] = [];
	private options: any;

	constructor(pointSet: CPointSet, options: any) {
		super([]);
		this.options = options;
		this.rectangles = this.createRectangles(4);
		this.setPointSet(pointSet);
	}

	private setPointSet(pointSet: CPointSet) {
		var points = pointSet.getPointArray();
		if (!points) {
			for (var i = 0; i < this.rectangles.length; i++) {
				this.rectangles[i].setBounds(
					new Bounds(new Point(0, 0), new Point(0, 1)));
				this.push(this.rectangles[i]);
			}
			return;
		}

		var rectangleBounds = this.invertOleBounds(new Bounds(points[0], points[2]));

		for (var i = 0; i < this.rectangles.length; i++) {
			this.rectangles[i].setBounds(rectangleBounds[i]);
			this.push(this.rectangles[i]);
		}
	}

	private invertOleBounds(oleBounds: Bounds): Bounds[] {
		var rectanglesBounds: Bounds[] = [];

		var minWidth = 0;
		var minHeight = 0;
		var fullWidth = 1000000;
		var fullHeight = 1000000;

		rectanglesBounds.push(new Bounds(new Point(minWidth, minHeight), new Point(fullWidth, oleBounds.min.y)));
		rectanglesBounds.push(new Bounds(new Point(minWidth, oleBounds.min.y), oleBounds.getBottomLeft()));
		rectanglesBounds.push(new Bounds(oleBounds.getTopRight(), new Point(fullWidth, oleBounds.max.y)));
		rectanglesBounds.push(new Bounds(new Point(minWidth, oleBounds.max.y), new Point(fullWidth, fullHeight)));

		return rectanglesBounds;
	}

	private createRectangles(quantity: number): CRectangle[] {
		var rectangles: CRectangle[] = [];
		for (var i = 0; i < quantity; i++) {
			rectangles.push(
				new CRectangle(new Bounds(
					new Point(0, 0), new Point(0, 1)
				), this.options));
		}

		return rectangles;
	}
}
