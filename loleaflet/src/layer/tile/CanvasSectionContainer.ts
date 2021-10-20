/* eslint-disable */

declare var L: any;
declare var app: any;

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
			When 2 or more sections are bound, the top section will get the event first.
			If a section handles the event and calls stopPropagating function, the bound sections after that section won't get the event.
			Example scenario:
				Event: drag
				Top section handles event.
				Middle section handles the event and then calls "stopPropagating" function. From this point, top section still handles the event until the end of the event.
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

	documentObject:
		* This means that the section is a document object. So its anchor can only be "top left", it doesn't need to be set.
		* Container's documentAnchorSectionName should be set for enabling document objects.
		* For this type of sections, only "size" and "position" are meaningful.
		* Position is the object's position inside the document.
		* So a document object is not a UI element, other sections are UI elements and their positions and sizes can be managed by the section container.
		* Document objects' positions and sizes are not managed by the section container.
		* When "onDraw" function of a document-object section is called, the canvas pen is positioned to the coordinate of the document object. So the section can draw from point (0, 0)
		* Before "onDraw" function is called, section's "isVisible" property is set. If the object is visible inside the viewed area (even partially), the property value will be true, if not, it will be false.

	windowSection:	Bound sections overlap entirely, their sizes and locations are the same.
					Events are propagated "only" between bound sections.
					When an event occurs, the target section is found and local coordinates are calculated.
					Since the same coordinates are valid for the bound sections beneath the target section, we can easily propagate the event to those bound sections.
					If 2 sections intersect but not bound, the top section gets the event and event is not propagated to the intersecting section.
					This type of propagation reduces the computational load of the CanvasSectionContainer.

					Now, the document is placed inside TilesSection and we need to scroll / zoom the document.
					If we bind the ScrollSection to TilesSection, we can easily scroll the document using event propagation.
					But now we have CommentListSection next to TilesSection. We also want to be able to scroll the document when mouse is above CommentListSection.
					This request needs a top handler to be met.
					Top handlers (sections) will handle events like scroll & zoom universally.
					Users will be able to scroll the document while the mouse pointer is above CommentListSection.
					So the solution to problems like scrolling is using "windowSection"s.

					A window section is always the first to handle an event and its size is equal to canvas element's size.
					An event is propagated for the target section after window section handles it.
					A window section can stop propagation of the event.
					"Window section"s drawing order and zIndex can be set. So it will be drawn accordingly.

					If:
						We don't want to handle the event with the window section while mouse is above "section X".
							Check canvasSectionContainer.targetSection property. It shows the actual target of the event.
								Example:	A document object is being moved and window section shouldn't scroll the document.
											Window section will check the containerObject.targetSection (string) and see it is a document object.
						We are handling keyboard events with a window section so there is no target section?
							Check the containerObject.activeSection property, if it is not included in your list, don't handle the keyboard event with the window section.
							One should set and keep up to date the containerObject.activeSection (string) property accordingly.

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
	If top bar is processed after tiles area, since "tiles area" will most probably be expanded to all directions, it will leave no space for top bar.
	So, tiles area will be processed last.
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
	backgroundOpacity: number = 1; // Valid when backgroundColor is valid.
	borderColor: string = null; // Default is null (no borders).
	boundToSection: string = null;
	anchor: Array<string> = new Array(0);
	documentObject: boolean = false; // If true, the section is a document object.
	// When section is a document object, its position should be the real position inside the document, in core pixels.
	isVisible: boolean = false; // Is section visible on the viewed area of the document? This property is valid for document objects. This is managed by the section container.
	showSection: boolean = true; // Show / hide section.
	position: Array<number> = new Array(0);
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	isLocated: boolean = false; // location and size of the section computed yet ?
	processingOrder: number = null;
	drawingOrder: number = null;
	zIndex: number = null;
	interactable: boolean = true;
	isAnimating: boolean = false;
	windowSection: boolean = false;
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
	onMouseWheel: Function; // Parameters: Point [x, y], Delta [X, Y], e (native event object)
	onLongPress: Function; // Parameters: Point [x, y], e (native event object)
	onMultiTouchStart: Function; // Parameters: e (native event object)
	onMultiTouchMove: Function; // Parameters: Point [x, y], DragDistance [x, y], e (native event object)
	onMultiTouchEnd: Function; // Parameters: e (native event object)
	onResize: Function; // Parameters: null (Section's size is up to date when this callback is called.)
	onDraw: Function; // Parameters: null || (frameCount, elapsedTime)
	onDrawArea: Function; // Optional Parameters: (area, paneTopLeft, canvasContext) - area is the area to be painted using canvasContext.
	onAnimationEnded: Function; // frameCount, elapsedTime. Sections that will use animation, have to have this function defined.
	onNewDocumentTopLeft: Function; // Parameters: Size [x, y]
	onRemove: Function; // This Function is called right before section is removed.
	setDrawingOrder: Function; // Parameters: integer. Do not implement this. This function is added by section container.
	setZIndex: Function; // Parameters: integer. Do not implement this. This function is added by section container.
	bindToSection: Function; // Parameters: string. Do not implement this. This function is added by section container.
	boundsList: Array<CanvasSectionObject>; // The sections those this section can propagate events to. Updated by container.
	stopPropagating: Function; // Do not implement this. This function is added by section container.
	startAnimating: Function; // Do not implement this. This function is added by section container. Return value: boolean.
	resetAnimation: Function; // Do not implement this. This function is added by section container.
	getTestDiv: Function; // Do not implement this. This function is added by section container.
	setPosition: Function; // Document objects only. Do not implement this. This function is added by section container.

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
		this.showSection = options.showSection;
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
		this.onDrawArea = options.onDrawArea ? options.onDrawArea: function() {};
		this.onNewDocumentTopLeft = options.onNewDocumentTopLeft ? options.onNewDocumentTopLeft: function() {};
		this.onRemove = options.onRemove ? options.onRemove: function() {};
		this.onAnimationEnded = options.onAnimationEnded ? options.onAnimationEnded: function() {};
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
	private documentBottomRight: Array<number> = [0, 0];
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
	private clearColor: string = '#f8f9fa'; // '#f8f9fa';
	private touchEventInProgress: boolean = false; // This prevents multiple calling of mouse down and up events.
	public testing: boolean = false; // If this set to true, container will create a div element for every section. So, cypress tests can find where to click etc.
	public lowestPropagatedBoundSection: string = null; // Event propagating to bound sections. The first section which stops propagating and the sections those are on top of that section, get the event.
	public targetSection: string = null;
	public activeSection: string = null;
	private scrollLineHeight: number = 30; // This will be overridden.
	private mouseIsInside: boolean = false;
	private inZoomAnimation: boolean = false;
	private zoomChanged: boolean = false;
	private documentAnchorSectionName: string = null; // This section's top left point declares the point where document starts.
	private documentAnchor: Array<number> = null; // This is the point where document starts inside canvas element. Initial value shouldn't be [0, 0].
	// Above 2 properties can be used with documentBounds.
	private drawingPaused: number = 0;
	private drawingEnabled: boolean = true;
	private dirty: boolean = false;
	private sectionsDirty: boolean = false;
	private paintedEver: boolean = false;

	// For window sections.
	private windowSectionList: Array<CanvasSectionObject> = [];

	// Below variables are related to animation feature.
	private animatingSectionName: string = null; // The section that called startAnimating function. This variable is null when animations are not running.
	private lastFrameStamp: number = null;
	private continueAnimating: boolean = null;
	private frameCount: number = null; // Frame count of the current animation.
	private duration: number = null; // Duration for the animation.
	private elapsedTime: number = null; // Time that passed since the animation started.
	private stoppingFunctionList: Array<EventListener>; // Event listeners need to be removed from the canvas object. So we keep track of their functions.
	private stoppingEventTypes: Array<string>; // Events those stop the animation.

	constructor (canvasDOMElement: HTMLCanvasElement, disableDrawing?: boolean) {
		this.canvas = canvasDOMElement;
		this.context = canvasDOMElement.getContext('2d', { alpha: false });
		this.context.setTransform(1,0,0,1,0,0);
		document.addEventListener('mousemove', this.onMouseMove.bind(this));
		this.canvas.onmousedown = this.onMouseDown.bind(this);
		document.addEventListener('mouseup', this.onMouseUp.bind(this));
		this.canvas.onclick = this.onClick.bind(this);
		this.canvas.ondblclick = this.onDoubleClick.bind(this);
		this.canvas.oncontextmenu = this.onContextMenu.bind(this);
		this.canvas.onwheel = this.onMouseWheel.bind(this);
		this.canvas.onmouseleave = this.onMouseLeave.bind(this);
		this.canvas.onmouseenter = this.onMouseEnter.bind(this);
		this.canvas.ontouchstart = this.onTouchStart.bind(this);
		this.canvas.ontouchmove = this.onTouchMove.bind(this);
		this.canvas.ontouchend = this.onTouchEnd.bind(this);
		this.canvas.ontouchcancel = this.onTouchCancel.bind(this);

		// Some explanation first.
		// When the user uses the mouse wheel for scrolling, different browsers use different technics for calculating the deltaY and deltaX values.
		// For example FireFox uses "deltaMode=1" which corresponds to "lines". So it creates the event with the number of lines to scroll.
		// Chrome uses "deltaMode=0" which corresponds to "pixels". So it creates the event with the number of pixels to scroll.
		// When "deltaMode=1" is used, we need to know the height of the line, so we will convert it to pixels.
		// For that purpose, we'll create a temporary div element, get the font size and delete the temporary element.
		let tempElement = document.createElement('div');
		tempElement.style.fontSize = 'initial'; // IE doesn't support this property, but it uses "deltaMode=0" (so we don't need to get the line height).
		tempElement.style.display = 'none';
		document.body.appendChild(tempElement);
		this.scrollLineHeight = parseInt(window.getComputedStyle(tempElement).fontSize);
		document.body.removeChild(tempElement); // Remove the temporary element.

		if (disableDrawing)
			this.disableDrawing();
	}

	private clearCanvas() {
		this.context.fillStyle = this.clearColor;
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}

	getContext () {
		return this.context;
	}

	public setDocumentAnchorSection(sectionName: string) {
		var section: CanvasSectionObject = this.getSectionWithName(sectionName);
		if (section) {
			this.documentAnchorSectionName = sectionName;
		}
		else {
			this.documentAnchorSectionName = null;
			this.documentAnchor = null;
		}
	}

	public getDocumentAnchorSection (): CanvasSectionObject {
		return this.getSectionWithName(this.documentAnchorSectionName);
	}

	public getViewSize (): Array<number> {
		return [this.canvas.width, this.canvas.height];
	}

	setClearColor (color: string) {
		this.clearColor = color;
	}

	getClearColor () {
		return this.clearColor;
	}

	setInZoomAnimation (inZoomAnimation: boolean) {
		this.inZoomAnimation = inZoomAnimation;
	}

	isInZoomAnimation (): boolean {
		return this.inZoomAnimation;
	}

	setZoomChanged (zoomChanged: boolean) {
		this.zoomChanged = zoomChanged;
	}

	isZoomChanged (): boolean {
		return this.zoomChanged;
	}

	drawingAllowed (): boolean {
		return this.drawingEnabled && this.drawingPaused <= 0;
	}

	// This is used for making sure rendering does not happen for multiple runs of
	// Socket._emitSlurpedEvents(). Currently this is used in Calc to disable rendering
	// from docload till we get tiles of the correct view area to render.
	// After calling this, only enableDrawing() can undo this call.
	disableDrawing () {
		this.drawingEnabled = false;
	}

	enableDrawing () {
		if (this.drawingEnabled)
			return;

		this.drawingEnabled = true;
		if (this.drawingPaused === 0) {
			// Trigger a forced repaint as drawing is not paused currently.
			this.dirty = true;
			this.paintOnResumeOrEnable();
		}
	}

	pauseDrawing () {

		if (this.drawingPaused++ === 0) {
			this.dirty = false;
		}
	}

	// set topLevel if we are sure that we are the top of call nesting
	// eg. in a browser event handler. Avoids JS exceptions poisoning
	// the count, since we have no RAII helpers here.
	resumeDrawing(topLevel?: boolean) {
		var wasNonZero: boolean = this.drawingPaused !== 0;
		if (topLevel)
		   this.drawingPaused = 0;
		else if (this.drawingPaused > 0)  // ensure non-negative value.
		   this.drawingPaused--;

		if (this.drawingEnabled && wasNonZero && this.drawingPaused === 0) {
			this.paintOnResumeOrEnable();
		}
	}

	private paintOnResumeOrEnable() {
		if (this.sectionsDirty) {
			this.updateBoundSectionLists();
			this.reNewAllSections(false);
			this.sectionsDirty = false;
		}

		var scrollSection = <any>this.getSectionWithName(L.CSections.Scroll.name)
		if (scrollSection)
			scrollSection.completePendingScroll(); // No painting, only dirtying.

		if (this.dirty) {
			this.requestReDraw();
			this.dirty = false;
		}
	}

	private setDirty() {
		this.dirty = true;
	}

	/**
	 * IE11 doesn't support Array.includes, use replacement
	*/
	private arrayIncludes<T> (array: Array<T>, element: T) {
		return array.indexOf(element) >= 0;
	};

	private clearMousePositions () {
		this.positionOnClick = this.positionOnDoubleClick = this.positionOnMouseDown = this.positionOnMouseUp = this.dragDistance = this.sectionOnMouseDown = null;
		this.touchCenter = null;
		this.draggingSomething = false;
		this.touchEventInProgress = false;
		this.lowestPropagatedBoundSection = null;
		this.targetSection = null;
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

	public getDocumentTopLeft (): Array<number> {
		return [this.documentTopLeft[0], this.documentTopLeft[1]];
	}

	public getDocumentBottomRight (): Array<number> {
		return [this.documentBottomRight[0], this.documentBottomRight[1]];
	}

	// Returns top-left and bottom-right coordinates respectively.
	public getDocumentBounds (): Array<number> {
		return [this.documentTopLeft[0], this.documentTopLeft[1], this.documentBottomRight[0], this.documentBottomRight[1]];
	}

	public getDocumentSize (): Array<number> {
		return [this.documentBottomRight[0] - this.documentTopLeft[0], this.documentBottomRight[1] - this.documentTopLeft[1]];
	}

	private isDocumentObjectVisible (section: CanvasSectionObject): boolean {
		if (
			(
				section.position[0] >= this.documentTopLeft[0] && section.position[0] <= this.documentBottomRight[0] ||
				section.position[0] + section.size[0] >= this.documentTopLeft[0] && section.position[0] + section.size[0] <= this.documentBottomRight[0]
			)
			&&
			(
				section.position[1] >= this.documentTopLeft[1] && section.position[1] <= this.documentBottomRight[1] ||
				section.position[1] + section.size[1] >= this.documentTopLeft[1] && section.position[1] + section.size[1] <= this.documentBottomRight[1]
			)
		) {
			return true;
		}
		else
			return false;
	}

	// For window sections, there is a "targetSection" property in CanvasSectionContainer.
	// Because a window section is above all sections and cover entire canvas, it may need to act according to the actual target of the event.
	// In this case, "targetSection" property gives the window section the first target of the event.
	// This (below) function gives the window section if a section will sooner or later get the event.
	// But this function cannot know if the event will be stopped by a prior section before the event reaches the section specified with the "sectionName" variable.
	// This function doesn't neither check the "interactable" property of the section in question ("sectionName"). Though that check can be added here, as an optional one.
	public targetBoundSectionListContains (sectionName: string): boolean {
		if (!this.targetSection)
			return false;
		else {
			var section: CanvasSectionObject = this.getSectionWithName(this.targetSection);
			if (section && section.boundsList) {
				for (var i: number = 0; i < section.boundsList.length; i++) {
					if (section.boundsList[i].name === sectionName)
						return true;
				}
				return false;
			}
			else
				return false;
		}
	}

	public setDocumentBounds (points: Array<number>) {
		this.documentTopLeft[0] = Math.round(points[0]);
		this.documentTopLeft[1] = Math.round(points[1]);

		this.documentBottomRight[0] = Math.round(points[2]);
		this.documentBottomRight[1] = Math.round(points[3]);

		app.file.viewedRectangle = [this.documentTopLeft[0], this.documentTopLeft[1], this.documentBottomRight[0] - this.documentTopLeft[0], this.documentBottomRight[1] - this.documentTopLeft[1]];

		for (var i: number = 0; i < this.sections.length; i++) {
			var section: CanvasSectionObject = this.sections[i];

			if (section.documentObject === true) {
				section.myTopLeft = [this.documentAnchor[0] + section.position[0] - this.documentTopLeft[0], this.documentAnchor[1] + section.position[1] - this.documentTopLeft[1]];
				section.isVisible = this.isDocumentObjectVisible(section);
			}

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
				if (!this.arrayIncludes(sectionList, tempSection))
					tempSectionList.push(tempSection);
			}
		}

		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].isLocated && this.sections[i].boundToSection === section.name) {
				if (!this.arrayIncludes(sectionList, this.sections[i]))
					tempSectionList.push(this.sections[i]);
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

		// Remove the sections those are above this section. Events will not be propagated to them.
		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].name !== section.name) {
				section.boundsList.splice(i, 1);
			}
			else {
				break;
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

	public requestReDraw() {
		if (!this.drawingAllowed()) {
			// Someone requested a redraw, but we're paused => schedule a redraw.
			this.setDirty();
			return;
		}

		if (!this.getAnimatingSectionName())
			this.drawSections();
	}

	private propagateOnClick(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		var windowPosition: Array<number> = position ? [position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]: null;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onClick(windowPosition, e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onClick((position ? [position[0], position[1]]: null), e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnDoubleClick(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		var windowPosition: Array<number> = position ? [position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]: null;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onDoubleClick(windowPosition, e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onDoubleClick((position ? [position[0], position[1]]: null), e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnMouseLeave(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		this.targetSection = section.name;

		var windowPosition: Array<number> = position ? [position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]: null;
		if (!windowPosition) { // This event is valid only if the windowPosition is null for window sections. Otherwise mouse cannot leave from a section that is covering entire canvas element.
			for (var j: number = 0; j < this.windowSectionList.length; j++) {
				var windowSection = this.windowSectionList[j];
				if (windowSection.interactable)
					windowSection.onMouseLeave(windowPosition, e);
				// This event's propagation shouldn't be cancelled.
			}
		}

		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMouseLeave((position ? [position[0], position[1]]: null), e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMouseEnter(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		this.targetSection = section.name;

		// This event is handled in the mouseEnter event of the canvas itself (for window sections).

		for (var i: number = section.boundsList.length - 1; i > -1; i--) {
			if (section.boundsList[i].interactable)
				section.boundsList[i].onMouseEnter((position ? [position[0], position[1]]: null), e);

			if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
				break; // Stop propagation.
		}
	}

	private propagateOnMouseMove(section: CanvasSectionObject, position: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		var windowPosition: Array<number> = position ? [position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]: null;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onMouseMove(windowPosition, dragDistance, e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onMouseMove((position ? [position[0], position[1]]: null), dragDistance, e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnLongPress(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		var windowPosition: Array<number> = position ? [position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]: null;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onLongPress(windowPosition, e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onLongPress((position ? [position[0], position[1]]: null), e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnMouseDown(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		var windowPosition: Array<number> = position ? [position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]: null;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onMouseDown(windowPosition, e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onMouseDown((position ? [position[0], position[1]]: null), e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnMouseUp(section: CanvasSectionObject, position: Array<number>, e: MouseEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		var windowPosition: Array<number> = position ? [position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]: null;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onMouseUp(windowPosition, e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onMouseUp((position ? [position[0], position[1]]: null), e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnContextMenu(section: CanvasSectionObject) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onContextMenu();

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onContextMenu();

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnMouseWheel(section: CanvasSectionObject, position: Array<number>, delta: Array<number>, e: MouseEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		var windowPosition: Array<number> = position ? [position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]: null;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onMouseWheel(windowPosition, delta, e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onMouseWheel((position ? [position[0], position[1]]: null), delta, e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnMultiTouchStart(section: CanvasSectionObject, e: TouchEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onMultiTouchStart(e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onMultiTouchStart(e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnMultiTouchMove(section: CanvasSectionObject, position: Array<number>, distance: number, e: TouchEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		var windowPosition: Array<number> = position ? [position[0] + section.myTopLeft[0], position[1] + section.myTopLeft[1]]: null;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onMultiTouchMove(windowPosition, distance, e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onMultiTouchMove((position ? [position[0], position[1]]: null), distance, e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private propagateOnMultiTouchEnd(section: CanvasSectionObject, e: TouchEvent) {
		this.targetSection = section.name;

		var propagate: boolean = true;
		for (var j: number = 0; j < this.windowSectionList.length; j++) {
			var windowSection = this.windowSectionList[j];
			if (windowSection.interactable)
				windowSection.onMultiTouchEnd(e);

			if (this.lowestPropagatedBoundSection === windowSection.name)
				propagate = false; // Window sections can not stop the propagation of the event for other window sections.
		}

		if (propagate) {
			for (var i: number = section.boundsList.length - 1; i > -1; i--) {
				if (section.boundsList[i].interactable)
					section.boundsList[i].onMultiTouchEnd(e);

				if (section.boundsList[i].name === this.lowestPropagatedBoundSection)
					break; // Stop propagation.
			}
		}
	}

	private onClick (e: MouseEvent) {
		if (!this.draggingSomething) { // Prevent click event after dragging.
			if (this.positionOnMouseDown !== null && this.positionOnMouseUp !== null) {
				this.positionOnClick = this.convertPositionToCanvasLocale(e);
				var s1 = this.findSectionContainingPoint(this.positionOnMouseDown);
				var s2 = this.findSectionContainingPoint(this.positionOnMouseUp);
				if (s1 && s2 && s1 == s2) { // Allow click event if only mouse was above same section while clicking.
					var section: CanvasSectionObject = this.findSectionContainingPoint(this.positionOnClick);
					if (section) { // "interactable" property is checked while propagating the event.
						this.propagateOnClick(section, this.convertPositionToSectionLocale(section, this.positionOnClick), e);
					}
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
		// Early exit. If mouse is outside and "draggingSomething = false", then there is no reason to check further.
		if (!this.mouseIsInside && !this.draggingSomething)
			return;

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
		// Early exit. If mouse down position is not inside the canvas area, we have nothing to check further.
		if (!this.positionOnMouseDown) {
			this.clearMousePositions();
			return;
		}

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

		if (!this.mouseIsInside) { // Normally, onclick event clears the positions. In this case, onClick won't be fired. So we clear the positions.
			this.clearMousePositions();
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
		var delta: Array<number>;

		if (e.deltaMode === 1)
			delta = [e.deltaX * this.scrollLineHeight, e.deltaY * this.scrollLineHeight];
		else
			delta = [e.deltaX, e.deltaY];

		var section: CanvasSectionObject = this.findSectionContainingPoint(point);
		if (section)
			this.propagateOnMouseWheel(section, this.convertPositionToSectionLocale(section, point), delta, e);
	}

	onMouseLeave (e: MouseEvent) {
		// While dragging something, we don't clear the event information even if the mouse is outside of the canvas area.
		// We catch the mouse move and mouse up events even when the mouse pointer is outside the canvas area.
		// This feature is enabled to create a better dragging experience.
		if (!this.draggingSomething) {
			if (this.sectionUnderMouse !== null) {
				var section: CanvasSectionObject = this.getSectionWithName(this.sectionUnderMouse);
				if (section)
					this.propagateOnMouseLeave(section, null, e);
				this.sectionUnderMouse = null;
			}
			this.clearMousePositions();
			this.mousePosition = null;
		}
		this.mouseIsInside = false;
	}

	onMouseEnter (e: MouseEvent) {
		this.mouseIsInside = true;

		for (var i: number = 0; i < this.windowSectionList.length; i++) {
			var windowSection = this.windowSectionList[i];
			if (windowSection.interactable)
				windowSection.onMouseEnter(null, e);
		}
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
		// Sometimes onTouchStart is fired for another element. In this case, we return.
		if (this.positionOnMouseDown === null)
			return;

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
		app.dpiScale = window.devicePixelRatio;
		app.roundedDpiScale = Math.round(window.devicePixelRatio);

		newWidth = Math.floor(newWidth * this.dpiScale);
		newHeight = Math.floor(newHeight * this.dpiScale);

		this.canvas.width = newWidth;
		this.canvas.height = newHeight;

		// CSS pixels can be fractional, but need to round to the same real pixels
		var cssWidth: number = newWidth / this.dpiScale; // NB. beware
		var cssHeight: number = newHeight / this.dpiScale;
		this.canvas.style.width = cssWidth.toFixed(4) + 'px';
		this.canvas.style.height = cssHeight.toFixed(4) + 'px';

		// Avoid black default background if canvas was never painted
		// since construction.
		if (!this.paintedEver)
			this.clearCanvas();

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
			if (this.sections[i].isLocated && !this.sections[i].windowSection && this.sections[i].showSection && (!this.sections[i].documentObject || this.sections[i].isVisible) && this.doesSectionIncludePoint(this.sections[i], point))
				return this.sections[i];
		}

		return null;
	}

	public doesSectionIncludePoint (section: any, point: Array<number>): boolean { // No ray casting here, it is a rectangle.
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

	createUpdateSingleDivElement (section: CanvasSectionObject) {
		var bcr: ClientRect = this.canvas.getBoundingClientRect();
		var element: HTMLDivElement = <HTMLDivElement>document.getElementById('test-div-' + section.name);
		if (!element) {
			element = document.createElement('div');
			element.id = 'test-div-' + section.name;
			document.body.appendChild(element);
		}
		element.style.position = 'fixed';
		element.style.zIndex = '-1';
		element.style.left = String(bcr.left + Math.round(section.myTopLeft[0] / this.dpiScale)) + 'px';
		element.style.top = String(bcr.top + Math.round(section.myTopLeft[1] / this.dpiScale)) + 'px';
		element.style.width = String(Math.round(section.size[0] / this.dpiScale)) + 'px';
		element.style.height = String(Math.round(section.size[1] / this.dpiScale)) + 'px';
		if (section.name === 'tiles') {
			// For tiles section add document coordinates of top and left too.
			element.innerText = JSON.stringify({
				top: Math.round(section.documentTopLeft[1]),
				left: Math.round(section.documentTopLeft[0]),
				width: Math.round(section.size[0]),
				height: Math.round(section.size[1])
			});
		}
	}

	createUpdateDivElements () {
		for (var i: number = 0; i < this.sections.length; i++) {
			this.createUpdateSingleDivElement(this.sections[i]);
		}
	}

	public reNewAllSections(redraw: boolean = true) {
		this.orderSections();
		this.locateSections();
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].onResize();
		}
		this.applyDrawingOrders();
		if (this.testing)
			this.createUpdateDivElements();
		if (redraw && this.drawingAllowed())
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
		if (this.arrayIncludes(section.expand, 'left')) {
			var initialX = section.myTopLeft[0];
			section.myTopLeft[0] = this.hitLeft(section);
			section.size[0] = initialX - section.myTopLeft[0];
		}

		if (this.arrayIncludes(section.expand, 'right')) {
			section.size[0] = this.hitRight(section) - section.myTopLeft[0];
		}

		if (this.arrayIncludes(section.expand, 'top')) {
			var initialY = section.myTopLeft[1];
			section.myTopLeft[1] = this.hitTop(section);
			section.size[1] = initialY - section.myTopLeft[1];
		}

		if (this.arrayIncludes(section.expand, 'bottom')) {
			section.size[1] = this.hitBottom(section) - section.myTopLeft[1];
		}
	}

	private locateSections () {
		// Reset some values.
		for (var i: number = 0; i < this.sections.length; i++) {
			this.sections[i].isLocated = false;
			this.sections[i].myTopLeft = null;
		}

		this.documentAnchor = null;
		this.windowSectionList = [];

		for (var i: number = 0; i < this.sections.length; i++) {
			var section: CanvasSectionObject = this.sections[i];

			if (section.documentObject === true) { // "Document anchor" section should be processed before "document object" sections.
				if (section.size && section.position) {
					section.isLocated = true;
					section.myTopLeft = [this.documentAnchor[0] + section.position[0] - this.documentTopLeft[0], this.documentAnchor[1] + section.position[1] - this.documentTopLeft[1]];
				}
			}
			else if (section.boundToSection) { // Don't set boundToSection property for "window sections".
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
			else if (section.windowSection) {
				section.myTopLeft = [0, 0];
				section.size = [this.canvas.width, this.canvas.height];
				section.isLocated = true;
				this.windowSectionList.push(section);
			}
			else { // A regular UI element.
				section.myTopLeft = [this.calculateSectionInitialPosition(section, 1), this.calculateSectionInitialPosition(section, 0)];

				if (section.expand[0] !== '')
					this.expandSection(section);

				this.roundPositionAndSize(section);
				section.isLocated = true;
			}

			if (section.name === this.documentAnchorSectionName) {
				this.documentAnchor = [section.myTopLeft[0], section.myTopLeft[1]];
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

	public applyDrawingOrders () {
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

			if (section.isLocated && section.showSection && (!section.documentObject || section.isVisible)) {
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
	}

	setPenPosition (section: CanvasSectionObject) {
		this.context.setTransform(1, 0, 0, 1, 0, 0);
		this.context.translate(section.myTopLeft[0], section.myTopLeft[1]);
	}

	private drawSections (frameCount: number = null, elapsedTime: number = null) {
		this.context.setTransform(1, 0, 0, 1, 0, 0);

		if (!this.zoomChanged) {
			this.clearCanvas();
		}

		this.context.font = String(20 * this.dpiScale) + "px Verdana";
		for (var i: number = 0; i < this.sections.length; i++) {
			if (this.sections[i].isLocated && this.sections[i].showSection && (!this.sections[i].documentObject || this.sections[i].isVisible)) {
				this.context.translate(this.sections[i].myTopLeft[0], this.sections[i].myTopLeft[1]);
				if (this.sections[i].backgroundColor) {
					this.context.globalAlpha = this.sections[i].backgroundOpacity;
					this.context.fillStyle = this.sections[i].backgroundColor;
					this.context.fillRect(0, 0, this.sections[i].size[0], this.sections[i].size[1]);
					this.context.globalAlpha = 1;
				}

				this.sections[i].onDraw(frameCount, elapsedTime);

				if (this.sections[i].borderColor) { // If section's border is set, draw its borders after section's "onDraw" function is called.
					this.context.lineWidth = this.dpiScale;
					this.context.strokeStyle = this.sections[i].borderColor;
					this.context.strokeRect(0.5, 0.5, this.sections[i].size[0], this.sections[i].size[1]);
				}

				this.context.translate(-this.sections[i].myTopLeft[0], -this.sections[i].myTopLeft[1]);
			}
		}

		this.paintedEver = true;
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
			else if (this.arrayIncludes(['top', 'left', 'bottom', 'right'], options.name.trim())) {
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
			if (options.showSection === undefined)
				options.showSection = true;

			if (options.windowSection === undefined)
				options.windowSection = false;

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

		section.startAnimating = function(options: any): boolean {
			return section.containerObject.startAnimating(section.name, options);
		}

		section.resetAnimation = function () {
			section.containerObject.resetAnimation(section.name);
		}

		section.getTestDiv = function (): HTMLDivElement {
			var element: HTMLDivElement = <HTMLDivElement>document.getElementById('test-div-' + this.name);
			if (element)
				return element;
			else
				return null;
		}

		// Only for document objects.
		if (section.documentObject === true) {
			section.setPosition = function (x: number, y: number) {
				x = Math.round(x);
				y = Math.round(y);
				section.myTopLeft[0] = section.containerObject.documentAnchor[0] + x - section.containerObject.documentTopLeft[0];
				section.myTopLeft[1] = section.containerObject.documentAnchor[1] + y - section.containerObject.documentTopLeft[1];
				section.position[0] = x;
				section.position[1] = y;
				section.isVisible = section.containerObject.isDocumentObjectVisible(section);
				if (this.testing)
					section.containerObject.createUpdateSingleDivElement(section);
			}
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
		newSection.onInitialize();
		if (this.drawingAllowed()) {
			this.updateBoundSectionLists();
			this.reNewAllSections();
		}
		else {
			this.sectionsDirty = true;
			this.dirty = true;
		}
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
			if (!this.drawingAllowed())
			    this.sectionsDirty = true;
			else {
			    this.updateBoundSectionLists();
			    this.reNewAllSections();
			}
			return true;
		}
		else {
			return false;
		}
	}

	private setAnimatingSectionName (sectionName: string) {
		this.animatingSectionName = sectionName;
	}

	public getAnimatingSectionName (): string {
		return this.animatingSectionName;
	}

	private animate (timeStamp: number) {
		if (this.lastFrameStamp > 0)
			this.elapsedTime += timeStamp - this.lastFrameStamp;

		this.lastFrameStamp = timeStamp;

		if (this.duration && this.elapsedTime >= this.duration) { // This is not the only place that can set "continueAnimating" to "false".
			this.continueAnimating = false;
		}

		if (this.continueAnimating) {
			this.drawSections(this.frameCount, this.elapsedTime);
			this.frameCount++;
			requestAnimationFrame(this.animate.bind(this));
		}
		else {
			for (var i: number = 0; i < this.stoppingFunctionList.length; i++) {
				this.canvas.removeEventListener(this.stoppingEventTypes[i], this.stoppingFunctionList[i], true);
			}

			var section: CanvasSectionObject = this.getSectionWithName(this.getAnimatingSectionName());
			if (section) {
				section.isAnimating = false;
				section.onAnimationEnded(this.frameCount, this.elapsedTime);
			}

			this.setAnimatingSectionName(null);
			this.frameCount = this.elapsedTime = null;

			this.drawSections();
		}
	}

	private createStoppingFunction () {
		var that: any = this;
		return function () {
			that.continueAnimating = false;
		}
	}

	// Resets animation duration. Not to be called directly. Instead, use (inside section class) this.resetAnimation()
	public resetAnimation (sectionName: string) {
		if (sectionName === this.getAnimatingSectionName()) {
			this.lastFrameStamp = 0;
			this.elapsedTime = 0;
			this.frameCount = 0;
		}
	}

	public stopAnimating () {
		// Though this function is available for every section, generally, only the section that started animation should use this.
		this.continueAnimating = false;
	}

	// Don't call this directly. Instead, call (inside the section class) section.startAnimating(options).
	public startAnimating (sectionName: string, options: any): boolean {
		/*
			Most of the time, we need to draw entire canvas when animating.
			Because if there is another section under the animated one, that section needs to be renewed too.
			Also, sections may need to be redrawn because of the updated view (while animating).
			This animation feature re-draws all sections with requestAnimationFrame.
			Developer can set options to ensure the animation stops at certain point.
			If your section's "onDraw" function is given the variables "frameCount, elapsedTime", then you can assume that CanvasSectionContainer is in animation mode.
			You can also check getAnimatingSectionName function of container class (if it is null or not) to see if animating is on.

			Sections other than the one which started the animation, can't know when the animation will stop.

			The section which started the animation => "(inside section class) this.containerObject.getAnimatingSectionName()".

			For now, only one section can start animations at a time.

			options (possible values are separated by the '|' char):
				// Developer can specify the events those will stop animating.
				// Important note: User shouldn't depend on the order of the events if they assign a stopping handler to an event.
					Let's assume a stopping function is bound to 'onclick' event.
					For now, most probably, onclick event will first be propagated to sections, then animation will stop.
					But when Leaflet is removed, animation will stop first and then onclick event will be propagated to sections.

				stoppingEvents: ['click', 'mousemove' ..etc] // Events should match the real keywords.
				// Developer can set the duration for the animation, in miliseconds. There are also other ways to stop the animation.
				duration: 2000 | null // 2 seconds | null.
		*/

		if (!this.getAnimatingSectionName()) {
			this.setAnimatingSectionName(sectionName);
			this.getSectionWithName(sectionName).isAnimating = true;
			this.lastFrameStamp = 0;
			this.continueAnimating = true;
			this.duration = options.duration ? options.duration: null;
			this.elapsedTime = 0;
			this.frameCount = 0;

			this.stoppingFunctionList = new Array<EventListener>(0);
			this.stoppingEventTypes = new Array<string>(0);

			if (options.stoppingEvents) {
				for (var i: number = 0; i < options.stoppingEvents.length; i++) {
					this.stoppingEventTypes.push(options.stoppingEvents[i]);
					this.stoppingFunctionList.push(this.createStoppingFunction());
					this.canvas.addEventListener(options.stoppingEvents[i], this.stoppingFunctionList[i], true);
				}
			}

			this.animate(performance.now());
			return true;
		}
		else {
			return false;
		}
	}
}
