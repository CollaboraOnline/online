/* eslint-disable */

// Below classes are for managing the canvas layout.
/*
	Potential values are separated with '|'
	All pixels are in core pixels.
 	Supports multi touch with 2 fingers.
 	This class uses only native events. There is: No timer for anything & no longpress for desktop & no doubleclick for touch screen & no wheel for touchscreen etc.

	New section's options:
	name: 'tiles' | 'row headers' | 'column headers' | 'markers & cursor' | 'shapes' | 'scroll' etc.
	anchor: 'top left' | 'top right' | 'bottom left' | 'bottom right' (Examples: For row & column headers, anchor will be 'top left'; If we would want to draw something sticked to bottom, it would be 'bottom left' or 'bottom right').
	position: [0, 0] | [10, 50] | [x, y] // Related to anchor. Example 'bottom right': P(0, 0) is bottom right etc. myTopLeft is updated according to position and anchor.
	size: [100, 100] | [10, 20] | [maxX, maxY] // This doesn't restrict the drawable area, that is up to implementation. Size is not important for expanded directions. Expandable size is assigned after calculations.
	zIndex: Elements with highest zIndex will be drawn on top.
	expand: '' | 'right' | 'left' | 'top' | 'bottom' | 'left right top bottom' (any combination)
	interactable: true | false // If false, only general events will be fired (onDraw, newDocumentTopLeft, onResize). Example: editing mode, background drawings etc.
	drawingOrder:

	Drawing order feature is tricky, let's say you want something like this:

	--------------------
	|     top bar      |
	--------------------
	--------- ----------
	| left  | | tiles  |
	| bar   | | area   |
	--------- ----------

	Top bar's height will be static most probably. It needs to be drawn first, so it can be expanded to right.
	If top bar is drawn after tiles area, since "tiles area" will most probably be expanded to all directions, it will leave no space for top bar.
	So, tiles area will be drawn last.
	For above situation, drawing orders would be (with the same zIndex):
	* top bar -> 1
	* left bar -> 2
	* tiles area -> 3

	And "expand" properties would be like below:
		top bar: 'right' from position (0, 0)
		left bar: 'top bottom' from position (0, 200) -> So it will go up and find where top bar ends, then go down and find where canvas ends.
		tiles area: 'top bottom left right' from position like (300, 300) -> So it won't overlap with resulting positions of others (or it can stuck inside one of them).

	Expandable sections' dimensions are calculated according to other sections with the same zIndex.

	For below events, reDraw is "not" triggered, sections should call requestReDraw if they want a re-draw.
	* onMouseMove
	* onMouseDown
	* onMouseUp (when not dragging)
	* onMultiTouchStart
	* onMultiTouchMove
	* onMultiTouchEnd
	* onLongPress (available as touch event)
	* onMouseWheel
*/

// This class will be used internally by CanvasSectionContainer.
class CanvasSectionObject {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null; // Document top left will be updated by container.
	containerObject: CanvasSectionContainer = null;
	dpiScale: number = null;
	name: string = null;
	anchor: Array<string> = new Array(0);
	position: Array<number> = new Array(0);
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	drawingOrder: number = null;
	zIndex: number = null;
	interactable: boolean = true;
	myProperties: any = {};
	onMouseMove: Function; // Parameters: Point [x, y], DragDistance [x, y] (null when not dragging)
	onMouseDown: Function; // Parameters: Point [x, y]
	onMouseUp: Function; // Parameters: Point [x, y]
	onClick: Function; // Parameters: Point [x, y]
	onDoubleClick: Function; // Parameters: Point [x, y]
	onMouseWheel: Function; // Parameters: Point [x, y], DeltaY
	onLongPress: Function; // Parameters: Point [x, y]
	onMultiTouchStart: Function; // Parameters: null
	onMultiTouchMove: Function; // Parameters: Point [x, y], DragDistance [x, y]
	onMultiTouchEnd: Function; // Parameters: null
	onResize: Function; // Parameters: null (Section's size is up to date when this callback is called.)
	onDraw: Function; // Parameters: null
	onNewDocumentTopLeft: Function; // Parameters: Size [x, y]

	constructor (options: any) {
		this.name = options.name;
		this.anchor = options.anchor.split(' ');
		this.position = options.position;
		this.size = options.size;
		this.expand = options.expand.split(' ');
		this.drawingOrder = options.drawingOrder;
		this.zIndex = options.zIndex;
		this.interactable = options.interactable;
		this.myProperties = options.myProperties;
		this.onMouseMove = options.onMouseMove;
		this.onMouseDown = options.onMouseDown;
		this.onMouseUp = options.onMouseUp;
		this.onClick = options.onClick;
		this.onDoubleClick = options.onDoubleClick;
		this.onMouseWheel = options.onMouseWheel;
		this.onLongPress = options.onLongPress;
		this.onMultiTouchStart = options.onMultiTouchStart;
		this.onMultiTouchMove = options.onMultiTouchMove;
		this.onMultiTouchEnd = options.onMultiTouchEnd;
		this.onResize = options.onResize;
		this.onDraw = options.onDraw;
		this.onNewDocumentTopLeft = options.onNewDocumentTopLeft;
	}
}

class CanvasSectionContainer {
	/*
		All events will be cached by this class and propagated to sections.
		This class should work also mouse & touch enabled (at the same time) devices. Users should be able to use both.
	*/

	private dpiScale: number = window.devicePixelRatio;
	private sections: Array<any> = new Array(0);
	private documentTopLeft: Array<number> = [0, 0];
	private canvas: HTMLCanvasElement;
	private context: CanvasRenderingContext2D;
	private right: number;
	private bottom: number;
	private positionOnMouseDown: Array<number> = null;
	private positionOnMouseUp: Array<number> = null;
	private positionOnClick: Array<number> = null;
	private positionOnDoubleClick: Array<number> = null;
	private mousePosition: Array<number> = null;
	private dragDistance: Array<number> = null;
	private draggingSomething: boolean = false; // This will be managed by container, used by sections.
	private sectionOnMouseDown: string = null; // (Will contain section name) When dragging, user can leave section borders, dragging will continue. Target section will be informed.
	private draggingTolerance: number = 5; // This is for only desktop, mobile browsers seem to distinguish dragging and clicking nicely.
	private multiTouch: boolean = false;
	private potentialLongPress: boolean = false;

	constructor (canvasDOMElement: HTMLCanvasElement) {
		this.canvas = canvasDOMElement;
		this.context = canvasDOMElement.getContext('2d');
		this.canvas.onmousemove = this.onMouseMove.bind(this)
		this.canvas.onmousedown = this.onMouseDown.bind(this);
		this.canvas.onmouseup = this.onMouseUp.bind(this);
		this.canvas.onclick = this.onClick.bind(this);
		this.canvas.ondblclick = this.onDoubleClick.bind(this);
		this.canvas.onwheel = this.onMouseWheel.bind(this);
		this.canvas.onmouseleave = this.onMouseLeave.bind(this);
		this.canvas.ontouchstart = this.onTouchStart.bind(this);
		this.canvas.ontouchmove = this.onTouchMove.bind(this);
		this.canvas.ontouchend = this.onTouchEnd.bind(this);
		this.canvas.ontouchcancel = this.onTouchCancel.bind(this);
		this.canvas.onresize = this.onResize.bind(this);
	}

	private clearMousePositions () {
		this.positionOnClick = this.positionOnDoubleClick = this.positionOnMouseDown = this.positionOnMouseUp = this.dragDistance = this.sectionOnMouseDown = null;
		this.draggingSomething = false;
	}

	private convertPositionToSectionLocale (section: CanvasSectionObject, point: Array<number>): Array<number> {
		return [point[0] - section.myTopLeft[0], point[1] - section.myTopLeft[1]];
	}

	private convertPositionToCanvasLocale (e: any): Array<number> {
		var rect: any = this.canvas.getBoundingClientRect();
		var x: number, y: number;

		if (e.touches !== undefined && e.touches.length > 0) {
			x = e.touches[0].clientX - rect.left;
			y = e.touches[0].clientY - rect.top;
		}
		else if (e.changedTouches !== undefined && e.changedTouches.length > 0) {
			x = e.changedTouches[0].clientX - rect.left;
			y = e.changedTouches[0].clientY - rect.top;
		}
		else {
			x = e.clientX - rect.left;
			y = e.clientY - rect.top;
		}
		return [Math.round(x * this.dpiScale), Math.round(y * this.dpiScale)];
	}

	private convertPointToCanvasLocale (point: Array<number>): Array<number> {
		var rect: any = this.canvas.getBoundingClientRect();
		var x: number, y: number;

		x = point[0] - rect.left;
		y = point[1] - rect.top;

		return [Math.round(x * this.dpiScale), Math.round(y * this.dpiScale)];
	}

	private getSectionWithName (name: string): CanvasSectionObject {
		if (name) {
			for (var i: number = 0; i < this.sections.length; i++) {
				if (this.sections[i].name === name) {
					return this.sections[i];
				}
			}
			return null;
		}
		else {
			return null;
		}
	}

	getDocumentTopLeft (): Array<number> {
		return [this.documentTopLeft[0], this.documentTopLeft[1]];
	}

	setDocumentTopLeft (point: Array<number>) {
		this.documentTopLeft[0] = point[0];
		this.documentTopLeft[1] = point[1];
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].onNewDocumentTopLeft(this.getDocumentTopLeft());
		}
		this.drawSections();
	}

	requestReDraw() {
		this.drawSections();
	}

	private onClick (e: MouseEvent) {
		if (!this.draggingSomething) { // Prevent click event after dragging.
			this.positionOnClick = this.convertPositionToCanvasLocale(e);

			var s1 = this.findSectionContainingPoint(this.positionOnMouseDown);
			var s2 = this.findSectionContainingPoint(this.positionOnMouseUp);
			if (s1 && s2 && s1 == s2) {
				var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnClick);
				if (section.interactable) {
					section.onClick(this.convertPositionToSectionLocale(section, this.positionOnClick));
				}
			}
			this.clearMousePositions(); // Drawing takes place after cleaning mouse positions. Sections should overcome this evil.
			this.drawSections();
		}
		else {
			this.clearMousePositions();
		}
	}

	private onDoubleClick (e: MouseEvent) {
		this.positionOnDoubleClick = this.convertPositionToCanvasLocale(e);

		var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnDoubleClick);
		if (section && section.interactable) {
			section.onDoubleClick(this.convertPositionToSectionLocale(section, this.positionOnDoubleClick));
		}
		this.clearMousePositions();
		this.drawSections();
	}

	private onMouseMove (e: MouseEvent) {
		if (!this.potentialLongPress) {
			this.mousePosition = this.convertPositionToCanvasLocale(e);
			if (this.positionOnMouseDown !== null && !this.draggingSomething) {
				var dragDistance = [this.mousePosition[0] - this.positionOnMouseDown[0], this.mousePosition[1] - this.positionOnMouseDown[1]];
				if (dragDistance[0] >= this.draggingTolerance || dragDistance[1] >= this.draggingTolerance) {
					this.draggingSomething = true;
				}
			}

			var section: CanvasSectionObject;

			if (this.draggingSomething) {
				this.dragDistance = [this.mousePosition[0] - this.positionOnMouseDown[0], this.mousePosition[1] - this.positionOnMouseDown[1]];
				section = this.getSectionWithName(this.sectionOnMouseDown);
			}
			else {
				section = this.findSectionContainingPoint(this.mousePosition);
			}

			if (section) {
				section.onMouseMove(this.convertPositionToSectionLocale(section, this.mousePosition), this.dragDistance);
			}
		}
		else {
			this.mousePosition = this.convertPositionToCanvasLocale(e);
			var section: CanvasSectionObject = this.findSectionContainingPoint(this.mousePosition);
			if (section) {
				section.onLongPress(this.convertPositionToSectionLocale(section, this.mousePosition));
			}
			this.potentialLongPress = false;
		}
	}

	private onMouseDown (e: MouseEvent) { // Ignore this event, just rely on this.draggingSomething variable.
		this.clearMousePositions();
		this.positionOnMouseDown = this.convertPositionToCanvasLocale(e);

		var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnMouseDown);
		if (section) {
			this.sectionOnMouseDown = section.name;
			section.onMouseDown(this.convertPositionToSectionLocale(section, this.positionOnMouseDown));
		}
	}

	private onMouseUp (e: MouseEvent) { // Should be ignored unless this.draggingSomething = true.
		this.positionOnMouseUp = this.convertPositionToCanvasLocale(e);

		if (!this.draggingSomething) {
			var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnMouseUp);
			if (section) {
				section.onMouseUp(this.convertPositionToSectionLocale(section, this.positionOnMouseUp));
			}
		}
		else {
			var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
			if (section) {
				section.onMouseUp(this.convertPositionToSectionLocale(section, this.positionOnMouseUp));
				this.drawSections();
			}
		}
	}

	private onMouseWheel (e: WheelEvent) {
		var point = this.convertPositionToCanvasLocale(e);
		var delta = e.deltaY;
		var section: CanvasSectionObject = this.findSectionContainingPoint(point);
		if (section)
			section.onMouseWheel(this.convertPositionToSectionLocale(section, point), delta);
	}

	onMouseLeave (e: MouseEvent) {
		this.clearMousePositions();
		this.mousePosition = null; // This variable is set to null if only mouse is outside canvas area.
		this.drawSections();
	}

	onTouchStart (e: TouchEvent) { // Should be ignored unless this.draggingSomething = true.
		if (e.touches.length === 1) {
			this.clearMousePositions();
			this.potentialLongPress = true;
			this.positionOnMouseDown = this.convertPositionToCanvasLocale(e);

			var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnMouseDown);
			if (section) {
				this.sectionOnMouseDown = section.name;
				section.onMouseDown(this.convertPositionToSectionLocale(section, this.positionOnMouseDown));
			}
		}
		else if (!this.multiTouch) {
			this.potentialLongPress = false;
			this.multiTouch = true;
			var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
			if (section)
				section.onMultiTouchStart();
		}
	}

	private onTouchMove (e: TouchEvent) {
		this.potentialLongPress = false;
		if (!this.multiTouch) {
			this.mousePosition = this.convertPositionToCanvasLocale(e);
			this.draggingSomething = true;
			this.dragDistance = [this.mousePosition[0] - this.positionOnMouseDown[0], this.mousePosition[1] - this.positionOnMouseDown[1]];

			var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
			if (section) {
				section.onMouseMove(this.convertPositionToSectionLocale(section, this.mousePosition), this.dragDistance);
				this.drawSections();
			}
		}
		else if (e.touches.length === 2) {
			var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
			if (section) {
				var diffX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
				var diffY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
				var center = [(e.touches[0].clientX + e.touches[1].clientX) * 0.5, (e.touches[0].clientY + e.touches[1].clientY) * 0.5];
				var distance = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));
				center = this.convertPointToCanvasLocale(center);
				section.onMultiTouchMove(this.convertPositionToSectionLocale(section, center), distance);
			}
		}
	}

	private onTouchEnd (e: TouchEvent) { // Should be ignored unless this.draggingSomething = true.
		this.potentialLongPress = false;
		if (!this.multiTouch) {
			this.positionOnMouseUp = this.convertPositionToCanvasLocale(e);
			if (!this.draggingSomething) {
				var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnMouseUp);
				if (section)
					section.onMouseUp(this.convertPositionToSectionLocale(section, this.positionOnMouseUp));

				this.clearMousePositions();
			}
			else {
				var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
				if (section) {
					section.onMouseUp(this.convertPositionToSectionLocale(section, this.positionOnMouseUp));
					this.clearMousePositions();
					this.drawSections();
				}
				else {
					this.clearMousePositions();
				}
			}
		}
		else {
			if (e.touches.length === 0) {
				this.multiTouch = false;
				var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
				if (section) {
					section.onMultiTouchEnd();
				}
			}
		}
	}

	private onTouchCancel (e: TouchEvent) {
		this.clearMousePositions();
		this.potentialLongPress = false;
	}

	onResize (e: Event) {
		this.clearMousePositions();
		var width = window.innerWidth - 10;
		var height = window.innerHeight - 100;
		this.canvas.style.width = width + 'px';
		this.canvas.style.height = height + 'px';
		this.canvas.width = (width) * this.dpiScale;
		this.canvas.height = (height) * this.dpiScale;
		this.right = this.canvas.width;
		this.bottom = this.canvas.height;
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].dpiScale = this.dpiScale;
		}

		this.reNewAllSections();
	}

	findSectionContainingPoint (point: Array<number>): any {
		for (var i: number = this.sections.length - 1; i > -1; i--) { // Search from top to bottom. Top section will be sent as target section.
			if (this.sections[i].interactable && this.doesSectionIncludePoint(this.sections[i], point))
				return this.sections[i];
		}

		return null;
	}

	doesSectionIncludePoint (section: any, point: Array<number>): boolean { // No ray casting here, it is a rectangle.
		return ((point[0] >= section.myTopLeft[0] && point[0] <= section.myTopLeft[0] + section.size[0]) && (point[1] >= section.myTopLeft[1] && point[1] <= section.myTopLeft[1] + section.size[1]));
	}

	private doSectionsIntersectOnYAxis (section1: any, section2: any): boolean {
		var y11 = section1.myTopLeft[1];
		var y12 = section1.myTopLeft[1] + section1.size[1];

		var y21 = section2.myTopLeft[1];
		var y22 = section2.myTopLeft[1] + section2.size[1];

		if (((y11 >= y21 && y11 <= y22) || (y12 >= y21 && y12 <= y22)) || ((y21 >= y11 && y21 <= y12) || (y22 >= y11 && y22 <= y12)))
			return true;
		else
			return false;
	}

	private doSectionsIntersectOnXAxis (section1: any, section2: any): boolean {
		var x11 = section1.myTopLeft[0];
		var x12 = section1.myTopLeft[0] + section1.size[0];

		var x21 = section2.myTopLeft[0];
		var x22 = section2.myTopLeft[0] + section2.size[0];

		if (((x11 >= x21 && x11 < x22) || (x12 >= x21 && x12 <= x22)) || ((x21 >= x11 && x21 <= x12) || (x22 >= x11 && x22 <= x12)))
			return true;
		else
			return false;
	}

	// Find the left most point from a position with same zIndex.
	private hitLeft (section: CanvasSectionObject): number {
		var maxX = -1;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
				var currentLeft = this.sections[i].myTopLeft[0] + this.sections[i].size[0];
				if (currentLeft > maxX && currentLeft < section.myTopLeft[0]) {
					if (this.doSectionsIntersectOnYAxis(this.sections[i], section)) {
						maxX = currentLeft;
					}
				}
			}
		}
		if (maxX === -1)
			return 0; // There is nothing on the left of this section.
		else
			return maxX + 1; // Don't overlap with the section on the left.
	}

	// Find the right most point from a position with same zIndex.
	private hitRight (section: CanvasSectionObject): number {
		var minX = Infinity;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
				var currentRight = this.sections[i].myTopLeft[0];
				if (currentRight < minX && currentRight > section.myTopLeft[0]) {
					if (this.doSectionsIntersectOnYAxis(this.sections[i], section)) {
						minX = currentRight;
					}
				}
			}
		}

		if (minX === Infinity)
			return this.right; // There is nothing on the right of this section.
		else
			return minX - 1; // Don't overlap with the section on the right.
	}

	// Find the top most point from a position with same zIndex.
	private hitTop (section: CanvasSectionObject): number {
		var maxY = -1;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
				var currentTop =  this.sections[i].myTopLeft[1] + this.sections[i].size[1];
				if (currentTop > maxY && currentTop < section.myTopLeft[1]) {
					if (this.doSectionsIntersectOnXAxis(this.sections[i], section)) {
						maxY = currentTop;
					}
				}
			}
		}
		if (maxY === -1)
			return 0; // There is nothing on the left of this section.
		else
			return maxY + 1; // Don't overlap with the section on the top.
	}

	// Find the bottom most point from a position with same zIndex.
	private hitBottom (section: CanvasSectionObject): number {
		var minY = Infinity;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
				var currentBottom =  this.sections[i].myTopLeft[1];
				if (currentBottom < minY && currentBottom > section.myTopLeft[1]) {
					if (this.doSectionsIntersectOnXAxis(this.sections[i], section)) {
						minY = currentBottom;
					}
				}
			}
		}
		if (minY === Infinity)
			return this.bottom; // There is nothing on the left of this section.
		else
			return minY - 1; // Don't overlap with the section on the bottom.
	}

	reNewAllSections() {
		this.orderSections();
		this.locateSections();
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].onResize();
		}
		this.drawSections();
	}

	private locateSections () {
		for (var i: number = 0; i < this.sections.length; i++) {
			var section: CanvasSectionObject = this.sections[i];
			section.myTopLeft = null;
			var x = section.anchor[1] === 'left' ? section.position[0]: (this.right - (section.position[0] + section.size[0]));
			var y = section.anchor[0] === 'top' ? section.position[1]: (this.bottom - (section.position[1] + section.size[1]));
			section.myTopLeft = [x, y];
			if (section.expand[0] !== '') {
				if (section.expand.includes('left') || section.expand.includes('right'))
					section.size[0] = 0;
				if (section.expand.includes('top') || section.expand.includes('bottom'))
					section.size[1] = 0;
			}
		}

		// We have initial positions, now we'll expand them.
		for (var i: number = 0; i < this.sections.length; i++) {
			var section: CanvasSectionObject = this.sections[i];
			if (section.expand) {
				if (section.expand.includes('left')) {
					var initialX = section.myTopLeft[0];
					section.myTopLeft[0] = this.hitLeft(section);
					section.size[0] = initialX - section.myTopLeft[0];
				}

				if (section.expand.includes('right')) {
					section.size[0] = this.hitRight(section) - section.myTopLeft[0];
				}

				if (section.expand.includes('top')) {
					var initialY = section.myTopLeft[1];
					section.myTopLeft[1] = this.hitTop(section);
					section.size[1] = initialY - section.myTopLeft[1];
				}

				if (section.expand.includes('bottom')) {
					section.size[1] = this.hitBottom(section) - section.myTopLeft[1];
				}
			}
		}
	}

	private orderSections () {
		// According to zIndex. Section with the highest zIndex will be drawn on top.
		for (var i: number = 0; i < this.sections.length - 1; i++) {
			for (var j = i + 1; j < this.sections.length; j++) {
				if (this.sections[i].zIndex > this.sections[j].zIndex) {
					var temp = this.sections[i];
					this.sections[i] = this.sections[j];
					this.sections[j] = temp;
				}
			}
		}

		// According to drawing order. Section with the highest drawing order will be drawn last.
		for (var i: number = 0; i < this.sections.length - 1; i++) {
			var zIndex = this.sections[i].zIndex;
			while (i < this.sections.length - 1 && zIndex === this.sections[i + 1].zIndex) {
				if (this.sections[i].drawingOrder > this.sections[i + 1].drawingOrder) {
					var temp = this.sections[i + 1];
					this.sections[i + 1] = this.sections[i];
					this.sections[i] = temp;
				}
				i++;
			}
		}
	}

	private drawSectionBorders () {
		this.context.lineWidth = 2 * this.dpiScale;
		this.context.strokeStyle = 'blue';
		for (var i: number = 0; i < this.sections.length; i++) {
			var section = this.sections[i];

			var xStart = section.myTopLeft[0];
			var xEnd = xStart + section.size[0];

			var yStart = section.myTopLeft[1];
			var yEnd = yStart + section.size[1];

			this.context.beginPath();
			this.context.moveTo(xStart, yStart);
			this.context.lineTo(xEnd, yStart);
			this.context.stroke();
			this.context.beginPath();
			this.context.moveTo(xEnd, yStart);
			this.context.lineTo(xEnd, yEnd);
			this.context.stroke();
			this.context.beginPath();
			this.context.moveTo(xEnd, yEnd);
			this.context.lineTo(xStart, yEnd);
			this.context.stroke();
			this.context.beginPath();
			this.context.moveTo(xStart, yEnd);
			this.context.lineTo(xStart, yStart);
			this.context.stroke();
		}
	}

	private drawSections () {
		this.context.fillStyle = "white";
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.context.font = String(20 * this.dpiScale) + "px Verdana";
		for (var i: number = 0; i < this.sections.length; i++) {
			this.context.translate(this.sections[i].myTopLeft[0], this.sections[i].myTopLeft[1]);
			this.sections[i].onDraw();
			this.context.translate(-this.sections[i].myTopLeft[0], -this.sections[i].myTopLeft[1]);
		}

		this.drawSectionBorders();
	}

	doesSectionExist (name: string): boolean {
		if (name && typeof name === 'string') {
			for (var i: number = 0; i < this.sections.length; i++) {
				if (this.sections[i].name === name) {
					return true;
				}
			}
			return false;
		}
		else {
			return false;
		}
	}

	private newSectionChecks (options: any): boolean {
		if (options.name !== undefined && typeof options.name === 'string' && options.name !== '') {
			if (this.doesSectionExist(options.name)) {
				console.error('There is a section with the same name. Use doesSectionExist for existancy checks.');
				return false;
			}
		}
		else {
			console.error('Sections should have a "name" property.');
			return false;
		}

		if (
			options.anchor === undefined
			|| options.position === undefined
			|| options.size === undefined
			|| options.expand === undefined
			|| options.drawingOrder === undefined
			|| options.zIndex === undefined
			|| options.interactable === undefined
			|| options.myProperties === undefined
			|| options.onMouseMove === undefined
			|| options.onMouseDown === undefined
			|| options.onMouseUp === undefined
			|| options.onClick === undefined
			|| options.onDoubleClick === undefined
			|| options.onMouseWheel === undefined
			|| options.onLongPress === undefined
			|| options.onMultiTouchStart === undefined
			|| options.onMultiTouchMove === undefined
			|| options.onMultiTouchEnd === undefined
			|| options.onResize === undefined
			|| options.onNewDocumentTopLeft === undefined
			|| options.onDraw === undefined
		) {
				console.error('Section has missing properties. See "newSectionChecks" function.');
				return false;
		}

		return true;
	}

	addSection (options: any) {
		if (this.newSectionChecks(options)) {
			// Every section can draw from Point(0, 0), their drawings will be translated to myTopLeft position.
			var newSection: CanvasSectionObject = new CanvasSectionObject(options);

			newSection.context = this.context;
			newSection.documentTopLeft = this.documentTopLeft;
			newSection.containerObject = this;
			newSection.dpiScale = this.dpiScale;

			this.sections.push(newSection);
			this.reNewAllSections();

			return true;
		}
		else {
			return false;
		}
	}

	removeSection (name: string) {
		var found = false;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].name === name) {
				this.sections.splice(i, 1);
				found = true;
				break;
			}
		}

		if (found) {
			this.reNewAllSections();
			return true;
		}
		else {
			return false;
		}
	}
}