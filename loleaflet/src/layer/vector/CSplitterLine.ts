/* eslint-disable */

/*
 * CSplitterLine is a CRectangle to be used to show the splits when there are freeze-panes.
 */

class CSplitterLine extends CRectangle {

	private isHoriz: boolean = true; // splitter divides X axis (vertical line) ?
	private map: any;
	private origOpacity: number;
	private inactive: boolean;

	constructor(map: any, options: any) {
		super(new CBounds(), options);

		this.fixed = true;
		this.stroke = false;
		this.fill = true;
		this.opacity = 0;

		// Splitters should always be on top.
		this.zIndex = Infinity;

		if (options.isHoriz !== undefined)
			this.isHoriz = options.isHoriz;

		this.map = map;

		// preserve original opacity.
		this.origOpacity = this.fillOpacity;

		this.onPositionChange();
	}

	onPositionChange() {
		var newBounds = this.computeBounds();
		this.fillOpacity = this.inactive ? 0 : this.origOpacity;
		this.setBounds(newBounds);
	}

	private computeBounds(): CBounds {
		var docLayer = this.map._docLayer;
		var mapSize = this.map.getPixelBoundsCore().getSize();
		var splitPos = docLayer._painter.getSplitPos();

		var thickdown = Math.floor(this.thickness / 2);
		var thickup = Math.ceil(this.thickness / 2);
		var start = new CPoint(
			(this.isHoriz ? splitPos.x : 0) - thickdown,
			(this.isHoriz ? 0 : splitPos.y) - thickdown)
			._round();
		var end = new CPoint(
			(this.isHoriz ? splitPos.x : mapSize.x) + thickup,
			(this.isHoriz ? mapSize.y : splitPos.y) + thickup)
			._round();

		this.inactive = this.isHoriz ? !splitPos.x : !splitPos.y;
		return new CBounds(start, end);
	}
}
