/* eslint-disable */

// Below classes are for managing the canvas layout.
/*
	Potential values are separated with '|'
	All pixels are in core pixels.
 	Supports multi touch with 2 fingers.
 	This class uses only native events. There is: No timer for anything & no longpress for desktop & no doubleclick for touch screen & no wheel for touchscreen etc.

	Propagated events:  All events are propagated between "bound sections".
						If 2 sections overlap but not bound, only top section gets the event.

	lowestPropagatedBoundSection:
			This property applies to bound sections.
			Bound sections are like layers. They overlap entirely.
			Every bound section should share same zIndex unless there is a very good reason for different zIndex values.
			To make a section "bound" to another, one can use "boundToSection" property (section name - string).
			When 2 or more sections overlap, the top section will get the event first.
			If a section handles the event and calls stopPropagating function, the sections after that section won't get the event.
			Example scenario:
				Event: drag
				Top section handles event.
				Middle section handles event then calls "stopPropagating" function. From this point, top section still handles the event until the end of the event.
				Bottom section doesn't get the event.

			If stopPropagating function is called, it is valid until the end of the event. So for events like dragging, calling
			the function only once is enough. When the event is lasted, lowestPropagatedBoundSection variable is set to null automatically.

	New section's options:
	name: 'tiles' | 'row headers' | 'column headers' | 'markers & cursor' | 'shapes' | 'scroll' etc.
	anchor: 'top left' | 'top right' | 'bottom left' | 'bottom right' (Examples: For row & column headers, anchor will be 'top left'; If we would want to draw something sticked to bottom, it would be 'bottom left' or 'bottom right').
		One can also anchor sections to other sections' edges.
		Order is important, first variables are related to top or bottom, next ones are related to left or right.
		Examples:
		1- [["column header", "bottom", "some section name", "top", "top"], "left"]
			^ If "column header" section exists, its bottom will be section's top
			If "some section name" exists, its top will be section's top.
			If none of them exists, canvas's top will be used as anchor.
			Canvas's left will be used as horizontal anchor.
		2- [["column header", "bottom", "ruler", "bottom", "top"], ["row header", "right", "left"]]

	position: [0, 0] | [10, 50] | [x, y] // Related to anchor. Example 'bottom right': P(0, 0) is bottom right etc. myTopLeft is updated according to position and anchor.
	size: [100, 100] | [10, 20] | [maxX, maxY] // This doesn't restrict the drawable area, that is up to implementation. Size is not important for expanded directions. Expandable size is assigned after calculations.
	zIndex: Elements with highest zIndex will be drawn on top.
	expand: '' | 'right' | 'left' | 'top' | 'bottom' | 'left right top bottom' (any combination)
	interactable: true | false // If false, only general events will be fired (onDraw, newDocumentTopLeft, onResize). Example: editing mode, background drawings etc.
	drawingOrder: Sections with the same zIndex value are drawn according to their drawing order values.
		Section with the highest drawing order is drawn on top (for specific zIndex).
		So, in terms of being drawn on top, priority is: zIndex > drawingOrder.
	processingOrder:

	Processing order feature is tricky, let's say you want something like this:

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
	For above situation, processing orders would be (with the same zIndex):
	* top bar -> 1
	* left bar -> 2
	* tiles area -> 3

	And "expand" properties would be like below:
		top bar: 'right' from position (0, 0)
		left bar: 'top bottom' from position (0, 200) -> So it will go up and find where top bar ends, then go down and find where canvas ends.
		tiles area: 'top bottom left right' from position like (300, 300) -> So it won't overlap with resulting positions of others (or it can stuck inside one of them).

	Expandable sections' dimensions are calculated according to other sections with the same zIndex.

	Below events trigger a redraw:
	* Adding a new section.
	* Click.
	* Double click.
	* Renewing all sections (optional redraw).
	* Requesting a redraw.

	Every section has a "section" property inside "sectionProperties".

	parentSectionName property (parameter of addSection): New section is added and its size and myTopLeft properties are mirrored from its parent section.
		All other properties and behaviours are the same with any section.


	Event handling:
		Mouse event combinations:
			mouse down + mouse up + click
			mouse down + mouse up + click + mouse down + mouse up + click + double click
			mouse move (if mouse is down, "draggingSomething" = true)
			mouse down + mouse move (dragging) + mouse up
			mouse wheel
			mouse enter
			mouse leave

		Touch event combinations:
			mouse down + mouse up + click
			mouse down + long press + mouse up
			mouse down + mouse move (it means dragging, "draggingSomething" = true) + mouse up // There is no "mouse move" event without dragging (for touch events)
			mouse down + multi touch start + multi touch move + multi touch end
*/

// This class will be used internally by CanvasSectionContainer.
class CanvasSectionObject {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null; // Document top left will be updated by container.
	containerObject: CanvasSectionContainer = null;
	dpiScale: number = null;
	name: string = null;
	backgroundColor: string = null; // Defult is null (container's background color will be used).
	borderColor: string = null; // Default is null (no borders).
	boundToSection: string = null;
	anchor: Array<string> = new Array(0);
	position: Array<number> = new Array(0);
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	isLocated: boolean = false; // location and size of the section computed yet ?
	processingOrder: number = null;
	drawingOrder: number = null;
	zIndex: number = null;
	interactable: boolean = true;
	sectionProperties: any = {};
	onInitialize: Function; // Paramaters: null (use sectionProperties).
	onMouseMove: Function; // Parameters: Point [x, y], DragDistance [x, y] (null when not dragging), e (native event object)
	onMouseDown: Function; // Parameters: Point [x, y], e (native event object)
	onMouseUp: Function; // Parameters: Point [x, y], e (native event object)
	onMouseEnter: Function; // Parameters: Point [x, y], e (native event object)
	onMouseLeave: Function; // Parameters: Point [x, y], e (native event object)
	onClick: Function; // Parameters: Point [x, y], e (native event object)
	onDoubleClick: Function; // Parameters: Point [x, y], e (native event object)
	onContextMenu: Function;
	onMouseWheel: Function; // Parameters: Point [x, y], DeltaY, e (native event object)
	onLongPress: Function; // Parameters: Point [x, y], e (native event object)
	onMultiTouchStart: Function; // Parameters: e (native event object)
	onMultiTouchMove: Function; // Parameters: Point [x, y], DragDistance [x, y], e (native event object)
	onMultiTouchEnd: Function; // Parameters: e (native event object)
	onResize: Function; // Parameters: null (Section's size is up to date when this callback is called.)
	onDraw: Function; // Parameters: null
	onNewDocumentTopLeft: Function; // Parameters: Size [x, y]
	onRemove: Function; // This Function is called right before section is removed.
	setDrawingOrder: Function; // Parameters: integer. Do not implement this. This function is added by section container.
	setZIndex: Function; // Parameters: integer. Do not implement this. This function is added by section container.
	bindToSection: Function; // Parameters: string. Do not implement this. This function is added by section container.
	boundsList: Array<CanvasSectionObject>; // The sections those this section can propagate events to. Updated by container.
	stopPropagating: Function; // Do not implement this. This function is added by section container.

	constructor (options: any) {
		this.name = options.name;
		this.backgroundColor = options.backgroundColor ? options.backgroundColor: null;
		this.borderColor = options.borderColor ? options.borderColor: null;
		this.anchor = typeof options.anchor === 'string' ? options.anchor.split(' '): options.anchor;
		this.position = options.position;
		this.size = options.size;
		this.expand = options.expand.split(' ');
		this.processingOrder = options.processingOrder;
		this.drawingOrder = options.drawingOrder;
		this.zIndex = options.zIndex;
		this.interactable = options.interactable;
		this.sectionProperties = options.sectionProperties ? options.sectionProperties: {};
		this.onInitialize = options.onInitialize ? options.onInitialize: function() {};
		this.onMouseMove = options.onMouseMove ? options.onMouseMove: function() {};
		this.onMouseDown = options.onMouseDown ? options.onMouseDown: function() {};
		this.onMouseUp = options.onMouseUp ? options.onMouseUp: function() {};
		this.onMouseEnter = options.onMouseEnter ? options.onMouseEnter: function() {};
		this.onMouseLeave = options.onMouseLeave ? options.onMouseLeave: function() {};
		this.onClick = options.onClick ? options.onClick: function() {};
		this.onDoubleClick = options.onDoubleClick ? options.onDoubleClick: function() {};
		this.onContextMenu = options.onContextMenu ? options.onContextMenu: function() {};
		this.onMouseWheel = options.onMouseWheel ? options.onMouseWheel: function() {};
		this.onLongPress = options.onLongPress ? options.onLongPress: function() {};
		this.onMultiTouchStart = options.onMultiTouchStart ? options.onMultiTouchStart: function() {};
		this.onMultiTouchMove = options.onMultiTouchMove ? options.onMultiTouchMove: function() {};
		this.onMultiTouchEnd = options.onMultiTouchEnd ? options.onMultiTouchEnd: function() {};
		this.onResize = options.onResize ? options.onResize: function() {};
		this.onDraw = options.onDraw ? options.onDraw: function() {};
		this.onNewDocumentTopLeft = options.onNewDocumentTopLeft ? options.onNewDocumentTopLeft: function() {};
		this.onRemove = options.onRemove ? options.onRemove: function() {};
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
	private sectionUnderMouse: string = null; // For mouse enter & leave events.
	private draggingTolerance: number = 5; // This is for only desktop, mobile browsers seem to distinguish dragging and clicking nicely.
	private multiTouch: boolean = false;
	private touchCenter: Array<number> = null;
	private potentialLongPress: boolean = false;
	private clearColor: string = 'white';
	private touchEventInProgress: boolean = false; // This prevents multiple calling of mouse down and up events.
	public testing: boolean = false; // If this set to true, container will create a div element for every section. So, cypress tests can find where to click etc.
	public lowestPropagatedBoundSection: string = null; // Event propagating to bound sections. The first section which stops propagating and the sections those are on top of that section, get the event.

	constructor (canvasDOMElement: HTMLCanvasElement) {
		this.canvas = canvasDOMElement;
		this.context = canvasDOMElement.getContext('2d');
		this.context.setTransform(1,0,0,1,0,0);
		this.canvas.onmousemove = this.onMouseMove.bind(this)
		this.canvas.onmousedown = this.onMouseDown.bind(this);
		this.canvas.onmouseup = this.onMouseUp.bind(this);
		this.canvas.onclick = this.onClick.bind(this);
		this.canvas.ondblclick = this.onDoubleClick.bind(this);
		this.canvas.oncontextmenu = this.onContextMenu.bind(this);
		this.canvas.onwheel = this.onMouseWheel.bind(this);
		this.canvas.onmouseleave = this.onMouseLeave.bind(this);
		this.canvas.ontouchstart = this.onTouchStart.bind(this);
		this.canvas.ontouchmove = this.onTouchMove.bind(this);
		this.canvas.ontouchend = this.onTouchEnd.bind(this);
		this.canvas.ontouchcancel = this.onTouchCancel.bind(this);
	}

	getContext () {
		return this.context;
	}

	setClearColor (color: string) {
		this.clearColor = color;
	}

	getClearColor () {
		return this.clearColor;
	}

	private clearMousePositions () {
		this.positionOnClick = this.positionOnDoubleClick = this.positionOnMouseDown = this.positionOnMouseUp = this.dragDistance = this.sectionOnMouseDown = null;
		this.touchCenter = null;
		this.draggingSomething = false;
		this.touchEventInProgress = false;
		this.lowestPropagatedBoundSection = null;
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

	getSectionWithName (name: string): CanvasSectionObject {
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
		this.documentTopLeft[0] = Math.round(point[0]);
		this.documentTopLeft[1] = Math.round(point[1]);
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].onNewDocumentTopLeft(this.getDocumentTopLeft());
		}
	}

	private updateBoundSectionList(section: CanvasSectionObject, sectionList: Array<CanvasSectionObject> = null): Array<CanvasSectionObject>{
		if (sectionList === null)
			sectionList = new Array(0);

		sectionList.push(section);

		var tempSectionList: Array<CanvasSectionObject> = new Array(0);

		if (section.boundToSection) {
			var tempSection = this.getSectionWithName(section.boundToSection);
			if (tempSection && tempSection.isLocated) {
				if (tempSection.zIndex < section.zIndex || (tempSection.zIndex === section.zIndex && tempSection.drawingOrder < section.drawingOrder)) {
					tempSectionList.push(tempSection);
				}
			}
		}

		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].isLocated && this.sections[i].boundToSection === section.name) {
				if (this.sections[i].zIndex < section.zIndex || (this.sections[i].zIndex === section.zIndex && this.sections[i].drawingOrder < section.drawingOrder)) {
					tempSectionList.push(this.sections[i]);
				}
			}
		}

		for (var i: number = 0; i < tempSectionList.length; i++) {
			this.updateBoundSectionList(tempSectionList[i], sectionList);
		}

		return sectionList;
	}

	private orderBoundsList(section: CanvasSectionObject) {
		// According to zIndex & drawingOrder.
		for (var i: number = 0; i < section.boundsList.length - 1; i++) {
			for (var j = i + 1; j < section.boundsList.length; j++) {
				if (section.boundsList[i].zIndex > section.boundsList[j].zIndex
					|| (section.boundsList[i].zIndex === section.boundsList[j].zIndex && section.boundsList[i].drawingOrder > section.boundsList[j].drawingOrder)) {
					var temp = section.boundsList[i];
					section.boundsList[i] = section.boundsList[j];
					section.boundsList[j] = temp;
				}
			}
		}
	}

	private updateBoundSectionLists() {
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].boundsList = null;
			this.sections[i].boundsList = this.updateBoundSectionList(this.sections[i]);
			this.orderBoundsList(this.sections[i]);
		}
	}

	requestReDraw() {
		this.drawSections();
	}

	private propagateOnClick(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onClick(position, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnDoubleClick(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onDoubleClick(position, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMouseLeave(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMouseLeave(position, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMouseEnter(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMouseEnter(position, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMouseMove(section: CanvasSectionObject, position: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMouseMove(position, dragDistance, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnLongPress(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onLongPress(position, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMouseDown(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMouseDown(position, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMouseUp(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMouseUp(position, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnContextMenu(section: CanvasSectionObject) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onContextMenu();

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMouseWheel(section: CanvasSectionObject, position: Array<number>, deltaY: number, e: MouseEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMouseWheel(position, deltaY, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMultiTouchStart(section: CanvasSectionObject, e: TouchEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMultiTouchStart(e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMultiTouchMove(section: CanvasSectionObject, position: Array<number>, distance: number, e: TouchEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMultiTouchMove(position, distance, e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMultiTouchEnd(section: CanvasSectionObject, e: TouchEvent) {
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMultiTouchEnd(e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private onClick (e: MouseEvent) {
		if (!this.draggingSomething) { // Prevent click event after dragging.
			this.positionOnClick = this.convertPositionToCanvasLocale(e);

			var s1 = this.findSectionContainingPoint(this.positionOnMouseDown);
			var s2 = this.findSectionContainingPoint(this.positionOnMouseUp);
			if (s1 && s2 && s1 == s2) { // Allow click event if only mouse was above same section while clicking.
				var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnClick);
				if (section) { // "interactable" property is also checked inside function "findSectionContainingPoint".
					this.propagateOnClick(section, this.convertPositionToSectionLocale(section, this.positionOnClick), e);
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
		if (section) {
			this.propagateOnDoubleClick(section, this.convertPositionToSectionLocale(section, this.positionOnDoubleClick), e);
		}
		this.clearMousePositions();
		this.drawSections();
	}

	private onMouseMove (e: MouseEvent) {
		if (!this.potentialLongPress) {
			if (!this.touchEventInProgress) {
				this.mousePosition = this.convertPositionToCanvasLocale(e);
				if (this.positionOnMouseDown !== null && !this.draggingSomething) {
					var dragDistance = [this.mousePosition[0] - this.positionOnMouseDown[0], this.mousePosition[1] - this.positionOnMouseDown[1]];
					if (Math.abs(dragDistance[0]) >= this.draggingTolerance || Math.abs(dragDistance[1]) >= this.draggingTolerance) {
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
					if (section.name !== this.sectionUnderMouse) {
						if (this.sectionUnderMouse !== null) {
							var previousSection: CanvasSectionObject = this.getSectionWithName(this.sectionUnderMouse);
							if (previousSection)
								this.propagateOnMouseLeave(previousSection, this.convertPositionToSectionLocale(previousSection, this.mousePosition), e);
						}
						this.sectionUnderMouse = section.name;
						this.propagateOnMouseEnter(section, this.convertPositionToSectionLocale(section, this.mousePosition), e);
					}
					this.propagateOnMouseMove(section, this.convertPositionToSectionLocale(section, this.mousePosition), this.dragDistance, e);
				}
				else if (this.sectionUnderMouse !== null) {
					var previousSection: CanvasSectionObject = this.getSectionWithName(this.sectionUnderMouse);
					if (previousSection)
						this.propagateOnMouseLeave(previousSection, this.convertPositionToSectionLocale(previousSection, this.mousePosition), e);
					this.sectionUnderMouse = null;
				}
			}
		}
		else {
			this.mousePosition = this.convertPositionToCanvasLocale(e);
			var section: CanvasSectionObject = this.findSectionContainingPoint(this.mousePosition);
			if (section) {
				this.propagateOnLongPress(section, this.convertPositionToSectionLocale(section, this.mousePosition), e);
			}
		}
	}

	private onMouseDown (e: MouseEvent) { // Ignore this event, just rely on this.draggingSomething variable.
		if (e.button === 0 && !this.touchEventInProgress) { // So, we only handle left button.
			this.clearMousePositions();
			this.positionOnMouseDown = this.convertPositionToCanvasLocale(e);

			var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnMouseDown);
			if (section) {
				this.sectionOnMouseDown = section.name;
				this.propagateOnMouseDown(section, this.convertPositionToSectionLocale(section, this.positionOnMouseDown), e);
			}
		}
	}

	private onMouseUp (e: MouseEvent) { // Should be ignored unless this.draggingSomething = true.
		if (e.button === 0 && !this.touchEventInProgress) {
			this.positionOnMouseUp = this.convertPositionToCanvasLocale(e);

			if (!this.draggingSomething) {
				var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnMouseUp);
				if (section) {
					this.propagateOnMouseUp(section, this.convertPositionToSectionLocale(section, this.positionOnMouseUp), e);
				}
			}
			else {
				var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
				if (section) {
					this.propagateOnMouseUp(section, this.convertPositionToSectionLocale(section, this.positionOnMouseUp), e);
				}
			}
		}
	}

	private onContextMenu (e: MouseEvent) {
		var mousePosition = this.convertPositionToCanvasLocale(e);
		var section: CanvasSectionObject = this.findSectionContainingPoint(mousePosition);
		if (section) {
			this.propagateOnContextMenu(section);
		}
		if (this.potentialLongPress) {
			// LongPress triggers context menu.
			// We should stop propagating here because we are using different context menu handlers for touch and mouse events.
			// By stopping this event here, we can have real context menus (for mice) and other handlers (for longpress) at the same time (see Control.RowHeader.js).
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
	}

	private onMouseWheel (e: WheelEvent) {
		var point = this.convertPositionToCanvasLocale(e);
		var delta = e.deltaY;
		var section: CanvasSectionObject = this.findSectionContainingPoint(point);
		if (section)
			this.propagateOnMouseWheel(section, this.convertPositionToSectionLocale(section, point), delta, e);
	}

	onMouseLeave (e: MouseEvent) {
		if (this.sectionUnderMouse !== null) {
			var section: CanvasSectionObject = this.getSectionWithName(this.sectionUnderMouse);
			if (section)
				this.propagateOnMouseLeave(section, null, e);
			this.sectionUnderMouse = null;
		}
		this.clearMousePositions();
		this.mousePosition = null; // This variable is set to null if only mouse is outside canvas area.
	}

	onTouchStart (e: TouchEvent) { // Should be ignored unless this.draggingSomething = true.
		if (e.touches.length === 1) {
			this.clearMousePositions();
			this.potentialLongPress = true;
			this.positionOnMouseDown = this.convertPositionToCanvasLocale(e);

			var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnMouseDown);
			if (section) {
				this.sectionOnMouseDown = section.name;
				this.propagateOnMouseDown(section, this.convertPositionToSectionLocale(section, this.positionOnMouseDown), (<MouseEvent><any>e));
			}
		}
		else if (!this.multiTouch) {
			this.potentialLongPress = false;
			this.multiTouch = true;
			var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
			if (section)
				this.propagateOnMultiTouchStart(section, e);
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
				this.propagateOnMouseMove(section, this.convertPositionToSectionLocale(section, this.mousePosition), this.dragDistance, <MouseEvent><any>e);
			}
		}
		else if (e.touches.length === 2) {
			var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
			if (section) {
				var diffX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
				var diffY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
				// Let's keep "touchCenter" variable "static" for now. When we want to allow move & drag at the same time, we should make it dynamic again.
				if (!this.touchCenter) {
					this.touchCenter = [(e.touches[0].clientX + e.touches[1].clientX) * 0.5, (e.touches[0].clientY + e.touches[1].clientY) * 0.5];
					this.touchCenter = this.convertPointToCanvasLocale(this.touchCenter);
				}
				var distance = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));
				this.propagateOnMultiTouchMove(section, this.convertPositionToSectionLocale(section, this.touchCenter), distance, e);
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
					this.propagateOnMouseUp(section, this.convertPositionToSectionLocale(section, this.positionOnMouseUp), <MouseEvent><any>e);
			}
			else {
				var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
				if (section)
					this.propagateOnMouseUp(section, this.convertPositionToSectionLocale(section, this.positionOnMouseUp), <MouseEvent><any>e);
			}
		}
		else {
			if (e.touches.length === 0) {
				this.multiTouch = false;
				var section: CanvasSectionObject = this.getSectionWithName(this.sectionOnMouseDown);
				if (section) {
					this.propagateOnMultiTouchEnd(section, e);
				}
			}
		}
		this.touchEventInProgress = true;
	}

	private onTouchCancel (e: TouchEvent) {
		this.clearMousePositions();
		this.potentialLongPress = false;
	}

	onResize (newWidth: number, newHeight: number) {
		var container: HTMLElement = <HTMLElement>this.canvas.parentNode;
		var cRect: ClientRect =	container.getBoundingClientRect();
		if (!newWidth)
			newWidth = cRect.right - cRect.left;

		if (!newHeight)
			newHeight = cRect.bottom - cRect.top;

		this.dpiScale = window.devicePixelRatio;
		newWidth = Math.floor(newWidth * this.dpiScale);
		newHeight = Math.floor(newHeight * this.dpiScale);

		this.canvas.width = newWidth;
		this.canvas.height = newHeight;

		// CSS pixels can be fractional, but need to round to the same real pixels
		var cssWidth: number = newWidth / this.dpiScale; // NB. beware
		var cssHeight: number = newHeight / this.dpiScale;
		this.canvas.style.width = cssWidth.toFixed(4) + 'px';
		this.canvas.style.height = cssHeight.toFixed(4) + 'px';

		this.clearMousePositions();
		this.right = this.canvas.width;
		this.bottom = this.canvas.height;
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].dpiScale = this.dpiScale;
		}

		this.reNewAllSections();
	}

	findSectionContainingPoint (point: Array<number>): any {
		for (var i: number = this.sections.length - 1; i > -1; i--) { // Search from top to bottom. Top section will be sent as target section.
			if (this.sections[i].isLocated && this.sections[i].interactable && this.doesSectionIncludePoint(this.sections[i], point))
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
		var maxX = -Infinity;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].isLocated && this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
				var currentLeft = this.sections[i].myTopLeft[0] + this.sections[i].size[0];
				if (currentLeft > maxX && currentLeft < section.myTopLeft[0]) {
					if (this.doSectionsIntersectOnYAxis(this.sections[i], section)) {
						maxX = currentLeft;
					}
				}
			}
		}
		if (maxX === -Infinity)
			return 0; // There is nothing on the left of this section.
		else
			return maxX + Math.round(this.dpiScale); // Don't overlap with the section on the left.
	}

	// Find the right most point from a position with same zIndex.
	private hitRight (section: CanvasSectionObject): number {
		var minX = Infinity;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].isLocated && this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
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
			return minX - Math.round(this.dpiScale); // Don't overlap with the section on the right.
	}

	// Find the top most point from a position with same zIndex.
	private hitTop (section: CanvasSectionObject): number {
		var maxY = -Infinity;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].isLocated && this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
				var currentTop =  this.sections[i].myTopLeft[1] + this.sections[i].size[1];
				if (currentTop > maxY && currentTop < section.myTopLeft[1]) {
					if (this.doSectionsIntersectOnXAxis(this.sections[i], section)) {
						maxY = currentTop;
					}
				}
			}
		}
		if (maxY === -Infinity)
			return 0; // There is nothing on the left of this section.
		else
			return maxY + Math.round(this.dpiScale); // Don't overlap with the section on the top.
	}

	// Find the bottom most point from a position with same zIndex.
	private hitBottom (section: CanvasSectionObject): number {
		var minY = Infinity;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].isLocated && this.sections[i].zIndex === section.zIndex && this.sections[i].name !== section.name) {
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
			return minY - Math.round(this.dpiScale); // Don't overlap with the section on the bottom.
	}

	createUpdateDivElements () {
		var bcr: ClientRect = this.canvas.getBoundingClientRect();
		for (var i: number = 0; i < this.sections.length; i++) {
			var section: CanvasSectionObject = this.sections[i];
			var element: HTMLDivElement = <HTMLDivElement>document.getElementById('test-div-' + this.sections[i].name);
			if (!element) {
				element = document.createElement('div');
				element.id = 'test-div-' + this.sections[i].name;
				document.body.appendChild(element);
			}
			element.style.position = 'fixed';
			element.style.zIndex = '0';
			element.style.left = String(bcr.left + Math.round(section.myTopLeft[0] / this.dpiScale)) + 'px';
			element.style.top = String(bcr.top + Math.round(section.myTopLeft[1] / this.dpiScale)) + 'px';
			element.style.width = String(Math.round(section.size[0] / this.dpiScale)) + 'px';
			element.style.height = String(Math.round(section.size[1] / this.dpiScale)) + 'px';
		}
	}

	reNewAllSections(redraw: boolean = true) {
		this.orderSections();
		this.locateSections();
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].onResize();
		}
		this.applyDrawingOrders();
		if (this.testing)
			this.createUpdateDivElements();
		if (redraw)
			this.drawSections();
	}

	private roundPositionAndSize(section: CanvasSectionObject) {
		section.myTopLeft[0] = Math.round(section.myTopLeft[0]);
		section.myTopLeft[1] = Math.round(section.myTopLeft[1]);
		section.size[0] = Math.round(section.size[0]);
		section.size[1] = Math.round(section.size[1]);
	}

	private calculateSectionInitialPosition(section: CanvasSectionObject, index: number): number {
		if (typeof section.anchor[index] === 'string' || section.anchor[index].length === 1) {
			var anchor: string = typeof section.anchor[index] === 'string' ? section.anchor[index]: section.anchor[index][0];
			if (index === 0)
				return anchor === 'top' ? section.position[1]: (this.bottom - (section.position[1] + section.size[1]));
			else
				return anchor === 'left' ? section.position[0]: (this.right - (section.position[0] + section.size[0]));
		}
		else {
			// If we are here, it means section's edge(s) will be snapped to another section's edges.
			// Count should always be an odd number. Because last variable will be used as a fallback to canvas's edges (top, bottom, right or left).
			// See anchor explanation on top of this file.
			// Correct example: ["header", "bottom", "top"] => Look for section "header", if found, use its bottom, if not found, use canvas's top.
			if (section.anchor[index].length % 2 === 0) {
				console.error('Section: ' + section.name + '. Wrong anchor definition.');
				return 0;
			}
			else {
				var count: number = section.anchor[index].length;
				var targetSection: CanvasSectionObject = null;
				var targetEdge: string = null;
				for (var i: number = 0; i < count - 1; i++) {
					targetSection = this.getSectionWithName(section.anchor[index][i]);
					if (targetSection) {
						targetEdge = section.anchor[index][i + 1];
						break;
					}
				}

				if (targetSection) {
					// So, we have target section, we will use its position. Is it located?
					if (!targetSection.isLocated) {
						console.error('Section: ' + section.name + '. Target section for anchor should be located before this section.'
							+ ' It means that target section\'s (if zIndex is the same) processing order should be less or its zIndex should be less than this section.');
						return 0;
					}
					else {
						if (targetEdge === 'top')
							return targetSection.myTopLeft[1] - Math.round(this.dpiScale);
						else if (targetEdge === 'bottom')
							return targetSection.myTopLeft[1] + targetSection.size[1] + Math.round(this.dpiScale);
						else if (targetEdge === 'left')
							return targetSection.myTopLeft[0] - Math.round(this.dpiScale);
						else if (targetEdge === 'right')
							return targetSection.myTopLeft[0] + targetSection.size[0] + Math.round(this.dpiScale);
					}
				}
				else {
					// No target section is found. Use fallback.
					var anchor: string = section.anchor[index][count - 1];
					if (index === 0)
						return anchor === 'top' ? section.position[1]: (this.bottom - (section.position[1] + section.size[1]));
					else
						return anchor === 'left' ? section.position[0]: (this.right - (section.position[0] + section.size[0]));
				}
			}
		}
	}

	private expandSection(section: CanvasSectionObject) {
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

	private locateSections () {
		// Reset some values.
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].isLocated = false;
			this.sections[i].myTopLeft = null;
		}

		for (var i: number = 0; i < this.sections.length; i++) {
			var section: CanvasSectionObject = this.sections[i];
			if (!section.boundToSection) {
				section.myTopLeft = [this.calculateSectionInitialPosition(section, 1), this.calculateSectionInitialPosition(section, 0)];

				if (section.expand[0] !== '')
					this.expandSection(section);

				this.roundPositionAndSize(section);
				section.isLocated = true;
			}
			else {
				var parentSection = this.getSectionWithName(section.boundToSection);
				if (parentSection) {
					section.myTopLeft = [0, 0];
					section.size = [0, 0];
					section.size[0] = parentSection.size[0];
					section.size[1] = parentSection.size[1];

					section.myTopLeft[0] = parentSection.myTopLeft[0];
					section.myTopLeft[1] = parentSection.myTopLeft[1];

					this.roundPositionAndSize(section);
					section.isLocated = true;
				}
			}
		}
	}

	private orderSections () {
		// According to zIndex & processing order.
		for (var i: number = 0; i < this.sections.length - 1; i++) {
			for (var j = i + 1; j < this.sections.length; j++) {
				if (this.sections[i].zIndex > this.sections[j].zIndex
					|| (this.sections[i].zIndex === this.sections[j].zIndex && this.sections[i].processingOrder > this.sections[j].processingOrder)) {
					var temp = this.sections[i];
					this.sections[i] = this.sections[j];
					this.sections[j] = temp;
				}
			}
		}
	}

	private applyDrawingOrders () {
		// According to drawing order. Section with the highest drawing order will be drawn on top (inside same zIndex).
		for (var i: number = 0; i < this.sections.length - 1; i++) {
			var zIndex = this.sections[i].zIndex;
			for (var j: number = i + 1; j < this.sections.length && this.sections[j].zIndex === zIndex; j++) {
				if (this.sections[i].drawingOrder > this.sections[j].drawingOrder) {
					var temp = this.sections[j];
					this.sections[j] = this.sections[i];
					this.sections[i] = temp;
				}
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

	setPenPosition (section: CanvasSectionObject) {
		this.context.setTransform(1, 0, 0, 1, 0, 0);
		this.context.translate(section.myTopLeft[0], section.myTopLeft[1]);
	}

	private drawSections () {
		this.context.setTransform(1, 0, 0, 1, 0, 0);
		this.context.fillStyle = this.clearColor;
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

		this.context.font = String(20 * this.dpiScale) + "px Verdana";
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].isLocated) {
				this.context.translate(this.sections[i].myTopLeft[0], this.sections[i].myTopLeft[1]);
				if (this.sections[i].backgroundColor) {
					this.context.fillStyle = this.sections[i].backgroundColor;
					this.context.fillRect(0, 0, this.sections[i].size[0], this.sections[i].size[1]);
				}

				this.sections[i].onDraw();

				if (this.sections[i].borderColor) {
					this.context.lineWidth = this.dpiScale;
					this.context.strokeStyle = this.sections[i].borderColor;
					this.context.strokeRect(0.5, 0.5, this.sections[i].size[0], this.sections[i].size[1]);
				}

				this.context.translate(-this.sections[i].myTopLeft[0], -this.sections[i].myTopLeft[1]);
			}
		}
		//this.drawSectionBorders();
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

	private checkNewSectionName (options: any) {
		if (options.name !== undefined && typeof options.name === 'string' && options.name.trim() !== '') {
			if (this.doesSectionExist(options.name)) {
				console.error('There is a section with the same name. Use doesSectionExist for existancy checks.');
				return false;
			}
			else if (['top', 'left', 'bottom', 'right'].includes(options.name.trim())) {
				console.error('"top", "left", "bottom" and "right" words are reserved. Choose another name for the section.');
				return false;
			}
			else {
				return true;
			}
		}
		else {
			console.error('Sections should have a "name" property.');
			return false;
		}
	}

	private checkSectionProperties (options: any) {
		if (
			options.anchor === undefined
			|| options.position === undefined
			|| options.size === undefined
			|| options.expand === undefined
			|| options.processingOrder === undefined
			|| options.drawingOrder === undefined
			|| options.zIndex === undefined
			|| options.interactable === undefined
		) {
			console.error('Section has missing properties. See "checkSectionProperties" function.');
			return false;
		}
		else {
			return true;
		}
	}

	private newSectionChecks (options: any): boolean {
		if (!this.checkNewSectionName(options))
			return false;
		else if (!this.checkSectionProperties(options))
			return false;
		else
			return true;
	}

	createSection (options: any, parentSectionName: string = null) {
		if (this.newSectionChecks(options)) {
			// Every section can draw from Point(0, 0), their drawings will be translated to myTopLeft position.
			var newSection: CanvasSectionObject = new CanvasSectionObject(options);
			newSection.boundToSection = parentSectionName;
			this.pushSection(newSection);
			return true;
		}
		else {
			return false;
		}
	}

	addSection (newSection: CanvasSectionObject) {
		if (this.newSectionChecks(newSection)) {
			this.pushSection(newSection);
			return true;
		}
		else {
			return false;
		}
	}

	private addSectionFunctions(section: CanvasSectionObject) {
		section.setDrawingOrder = function(drawingOrder: number) {
			section.drawingOrder = drawingOrder;
			section.containerObject.updateBoundSectionLists();
			section.containerObject.reNewAllSections();
		};

		section.setZIndex = function(zIndex: number) {
			section.zIndex = zIndex;
			section.containerObject.updateBoundSectionLists();
			section.containerObject.reNewAllSections();
		};

		section.bindToSection = function(sectionName: string) {
			section.boundToSection = sectionName;
			section.containerObject.updateBoundSectionLists();
			section.containerObject.reNewAllSections();
		};

		section.stopPropagating = function() {
			section.containerObject.lowestPropagatedBoundSection = section.name;
		}
	}

	private pushSection (newSection: CanvasSectionObject) {
		// Every section can draw from Point(0, 0), their drawings will be translated to myTopLeft position.
		newSection.context = this.context;
		newSection.documentTopLeft = this.documentTopLeft;
		newSection.containerObject = this;
		newSection.dpiScale = this.dpiScale;
		newSection.sectionProperties.section = newSection;
		this.sections.push(newSection);
		this.addSectionFunctions(newSection);
		this.updateBoundSectionLists();
		newSection.onInitialize();
		this.reNewAllSections(false);
		this.drawSections();
	}

	removeSection (name: string) {
		var found: boolean = false;
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].name === name) {
				var element: HTMLDivElement = <HTMLDivElement>document.getElementById('test-div-' + this.sections[i].name);
				if (element) // Remove test div if exists.
					document.body.removeChild(element);
				this.sections[i].onRemove();
				this.sections[i] = null;
				this.sections.splice(i, 1);
				found = true;
				break;
			}
		}

		if (found) {
			this.updateBoundSectionLists();
			this.reNewAllSections();
			return true;
		}
		else {
			return false;
		}
	}
}