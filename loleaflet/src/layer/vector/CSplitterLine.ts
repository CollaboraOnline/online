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

		this.fixed = true;

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
		var mapSize = this.map.getPixelBoundsCore().getSize();
		var splitPos = docLayer._painter.getSplitPos();

		var start = new CPoint(
			this.isHoriz ? splitPos.x : 0,
			this.isHoriz ? 0 : splitPos.y)._round();
		var end = new CPoint(
			this.isHoriz ? splitPos.x : mapSize.x,
			this.isHoriz ? mapSize.y : splitPos.y)._round();

		this.inactive = this.isHoriz ? !splitPos.x : !splitPos.y;
		return CPointSet.fromPointArray([start, end]);
	}
}
