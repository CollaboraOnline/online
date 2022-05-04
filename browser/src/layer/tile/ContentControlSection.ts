declare var L: any;
declare var app: any;

app.definitions.ContentControlSection =

class ContentControlSection {
    context: CanvasRenderingContext2D = null;
    processingOrder: number = L.CSections.ContentControl.processingOrder;
	drawingOrder: number = L.CSections.ContentControl.drawingOrder;
	zIndex: number = L.CSections.ContentControl.zIndex;
    name: string = L.CSections.ContentControl.name;
	interactable: boolean = false;
    documentObject: boolean = true;
	sectionProperties: any = {};
	myTopLeft: Array<number> = [0, 0];
	position: Array<number> = [0, 0];
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	anchor: Array<any> = new Array(0);

	// Implemented by section container. Document objects only.
	setPosition: (x: number, y: number) => void;

	public onInitialize() {
		this.sectionProperties.rectangles = [];
		this.sectionProperties.strokeStyle = '#000000';
	}

	constructor() {
		this.sectionProperties.rectangles = null;
		this.sectionProperties.strokeStyle = null;
	}

	drawContentControl(json: any) {
		if (json.action === 'show')	{
			//convert string to number coordinates
			var matches = json.rectangles.match(/\d+/g);
			this.sectionProperties.rectangles = [];
			if (matches !== null) {
				for (var i: number = 0; i < matches.length; i += 4) {
					this.sectionProperties.rectangles.push([parseInt(matches[i]), parseInt(matches[i + 1]), parseInt(matches[i + 2]), parseInt(matches[i + 3])]);
				}
			}
		} else if (json.action === 'hide') {
			this.sectionProperties.rectangles = [];
		}
		app.sectionContainer.requestReDraw();
	}

	private setPositionAndSize () {
		var rectangles = this.sectionProperties.rectangles;
		var xMin: number = Infinity, yMin: number = Infinity, xMax: number = 0, yMax: number = 0;
		for (var i = 0; i < rectangles.length; i++) {
			if (rectangles[i][0] < xMin)
				xMin = rectangles[i][0];

			if (rectangles[i][1] < yMin)
				yMin = rectangles[i][1];

			if (rectangles[i][0] + rectangles[i][2] > xMax)
				xMax = rectangles[i][0] + rectangles[i][2];

			if (rectangles[i][1] + rectangles[i][3] > yMax)
				yMax = rectangles[i][1] + rectangles[i][3];
		}
		// Rectangles are in twips. Convert them to core pixels.
		var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
		xMin = Math.round(xMin * ratio);
		yMin = Math.round(yMin * ratio);
		xMax = Math.round(xMax * ratio);
		yMax = Math.round(yMax * ratio);

		this.setPosition(xMin, yMin); // This function is added by section container.
		this.size = [xMax - xMin, yMax - yMin];
		if (this.size[0] < 5)
			this.size[0] = 5;
	}

	public onResize () {
		this.setPositionAndSize();
	}

	public onDraw() {
		var rectangles = this.sectionProperties.rectangles;

		for (var i: number = 0; i < rectangles.length; i++) {
			var xMin: number = rectangles[i][0];
			var yMin: number = rectangles[i][1];
			var xMax: number = rectangles[i][0] + rectangles[i][2];
			var yMax: number = rectangles[i][1] + rectangles[i][3];

			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			xMin = Math.round(xMin * ratio);
			yMin = Math.round(yMin * ratio);
			xMax = Math.round(xMax * ratio);
			yMax = Math.round(yMax * ratio);

			this.context.strokeStyle = this.sectionProperties.strokeStyle;
			this.context.strokeRect(xMin - this.position[0], yMin - this.position[1], xMax - xMin, yMax - yMin);
		}
	}

	public onNewDocumentTopLeft () {
		this.setPositionAndSize();
	}
};
