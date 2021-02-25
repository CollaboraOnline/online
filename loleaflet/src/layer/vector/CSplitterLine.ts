/* eslint-disable */

/*
 * CSplitterLine is a CRectangle to be used to show the splits when there are freeze-panes.
 */

class CSplitterLine extends CPolyline {

	private isHoriz: boolean = true; // splitter divides X axis (vertical line) ?
	private map: any;
	private origOpacity: number;
	private inactive: boolean;

	constructor(map: any, options: any) {
		super(new CPointSet(), options);

		// Splitters should always be on top.
		this.zIndex = Infinity;

		if (options.isHoriz !== undefined)
			this.isHoriz = options.isHoriz;

		this.map = map;

		// preserve original opacity.
		this.origOpacity = this.opacity;

		this.onPositionChange();
	}

	onPositionChange() {
		var newPointSet = this.computePointSet();
		this.opacity = this.inactive ? 0 : this.origOpacity;
		this.setPointSet(newPointSet);
	}

	private computePointSet(): CPointSet {
		var docLayer = this.map._docLayer;
		var viewBounds = this.map.getPixelBoundsCore();
		var docSize = docLayer.getMaxDocSize();
		var splitPos = docLayer._painter.getSplitPos();

		// The part of splitter line inside the frozen pane.
		var l1Start = new CPoint(
			this.isHoriz ? splitPos.x : 0,
			this.isHoriz ? 0 : splitPos.y);
		var l1End = new CPoint(
			this.isHoriz ? splitPos.x : docSize.x,
			this.isHoriz ? docSize.y : splitPos.y);

		// The part of splitter line inside the free pane.
		var l2Start = new CPoint(
			this.isHoriz ? splitPos.x + viewBounds.min.x : 0,
			this.isHoriz ? 0 : splitPos.y + viewBounds.min.y);
		var l2End = new CPoint(
			this.isHoriz ? splitPos.x + viewBounds.min.x : docSize.x,
			this.isHoriz ? docSize.y : splitPos.y + viewBounds.min.y);

		this.inactive = this.isHoriz ? !splitPos.x : !splitPos.y;
		return CPointSet.fromSetArray([
			CPointSet.fromPointArray([l1Start, l1End]),
			CPointSet.fromPointArray([l2Start, l2End]),
		]);
	}
}
