/* eslint-disable */
/* See CanvasSectionContainer.ts for explanations. */

// We are using typescript without modules and compile files individually for now. Typescript needs to know about global definitions.
// We will keep below definitions until we use tsconfig.json.
declare var L: any;
declare var $: any;
declare var Hammer: any;

class ScrollSection {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null;
	containerObject: any = null;
	dpiScale: number = null;
	name: string = null;
	backgroundColor: string = null;
	borderColor: string = null;
	boundToSection: string = null;
	anchor: Array<string> = new Array(0);
	position: Array<number> = new Array(0);
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	isLocated: boolean = false;
	processingOrder: number = null;
	drawingOrder: number = null;
	zIndex: number = null;
	interactable: boolean = true;
	sectionProperties: any = {};
	map: any;
	documentWidth: number = 0;
	documentHeight: number = 0;
	currentScrollPosX: number = 0;
	currentScrollPosY: number = 0;
	ignoreScroll: boolean;
	autoScrollTimer: any;
	mockDoc: any;
	hammer: any;
	scrollContainer: any;

	constructor () {
		this.name = L.CSections.Scroll.name;
		this.anchor = ['top', 'right'];
		this.position = [0, 0];
		this.size = [30, 0];
		this.expand = ['bottom'];
		this.processingOrder = L.CSections.Scroll.processingOrder;
		this.drawingOrder = L.CSections.Scroll.drawingOrder;
		this.zIndex = L.CSections.Scroll.zIndex;

		this.map = L.Map.THIS;

		this.map.on('scrollto', this.onScrollTo, this);
		this.map.on('scrollby', this.onScrollBy, this);
		this.map.on('scrollvelocity', this.onScrollVelocity, this);
		this.map.on('handleautoscroll', this.onHandleAutoScroll, this);
		this.map.on('docsize', this.onUpdateSize, this);
		this.map.on('updatescrolloffset', this.onUpdateScrollOffset, this);
	}

	public onInitialize () {
		this.scrollContainer = L.DomUtil.create('div', 'scroll-container', this.map._container.parentElement);
		this.mockDoc = L.DomUtil.create('div', '', this.scrollContainer);
		this.mockDoc.id = 'mock-doc';

		this.addMCustomScrollBar();

		if (!this.hammer && this.map.touchGesture) {
			this.hammer = new Hammer(this.scrollContainer);
			this.hammer.get('pan').set({
				direction: Hammer.DIRECTION_ALL
			});
			this.hammer.get('swipe').set({ threshold: 5 });

			if (L.Browser.touch)
				L.DomEvent.on(this.scrollContainer, 'touchmove', L.DomEvent.preventDefault);

			var mapTouchGesture = this.map.touchGesture;
			this.hammer.on('panstart', L.bind(mapTouchGesture._onPanStart, mapTouchGesture));
			this.hammer.on('pan', L.bind(mapTouchGesture._onPan, mapTouchGesture));
			this.hammer.on('panend', L.bind(mapTouchGesture._onPanEnd, mapTouchGesture));
			this.hammer.on('swipe', L.bind(mapTouchGesture._onSwipe, mapTouchGesture));
		}
	}

	private addMCustomScrollBar () {
		var control = this;
		var autoHideTimeout: any = null;
		$('.scroll-container').mCustomScrollbar({
			axis: 'yx',
			theme: 'minimal-dark',
			scrollInertia: 0,
			advanced:{
				autoExpandHorizontalScroll: true, /* weird bug, it should be false */
				jumpOnContentResize: false /* prevent "jumping" on mobile devices */
			},
			callbacks:{
				onScrollStart: function() {
					control.map.fire('closepopup');
				},
				onScroll: function() {
					control.onScrollEnd(this);
					if (autoHideTimeout)
						clearTimeout(autoHideTimeout);
					autoHideTimeout = setTimeout(function() {
						//$('.mCS-autoHide > .mCustomScrollBox ~ .mCSB_scrollTools').css({opacity: 0, 'filter': 'alpha(opacity=0)', '-ms-filter': 'alpha(opacity=0)'});
						$('.mCS-autoHide > .mCustomScrollBox ~ .mCSB_scrollTools').removeClass('loleaflet-scrollbar-show');
					}, 2000);
				},
				whileScrolling: function() {
					control.onScroll(this);

					// autoHide feature doesn't work because plugin relies on hovering on scroll container
					// and we have a mock scroll container whereas the actual user hovering happens only on
					// real document. Change the CSS rules manually to simulate autoHide feature.
					$('.mCS-autoHide > .mCustomScrollBox ~ .mCSB_scrollTools').addClass('loleaflet-scrollbar-show');
				},
				onUpdate: function() {
					console.debug('mCustomScrollbar: onUpdate:');
				},
				alwaysTriggerOffsets: false
			}
		});
	}

	public onCalcScroll (e: any) {
		if (!this.map._enabled) {
			return;
		}

		var newLeft = -e.mcs.left;
		if (newLeft > this.currentScrollPosX) {
			var viewportWidth = this.map.getSize().x;
			var docWidth = this.map._docLayer._docPixelSize.x;
			newLeft = Math.min(newLeft, docWidth - viewportWidth);
		}
		else {
			newLeft = Math.max(newLeft, 0);
		}

		var newTop = -e.mcs.top;
		if (newTop > this.currentScrollPosY) {
			var viewportHeight = this.map.getSize().y;
			var docHeight = Math.round(this.map._docLayer._docPixelSize.y);
			newTop = Math.min(newTop, docHeight - viewportHeight);
		}
		else {
			newTop = Math.max(newTop, 0);
		}

		var offset = new L.Point(
			newLeft - this.currentScrollPosX,
			newTop - this.currentScrollPosY);

		if (offset.equals(new L.Point(0, 0))) {
			return;
		}

		this.currentScrollPosX = newLeft;
		this.currentScrollPosY = newTop;
		this.map.fire('scrolloffset', offset);
		this.map._docLayer.refreshViewData({ x: newLeft, y: newTop, offset: offset});
		this.map.scroll(offset.x, offset.y);
	}

	public onScroll (e: any) {
		if (this.map._docLayer._docType === 'spreadsheet') {
			this.onCalcScroll(e);
			return;
		}

		console.debug('_onScroll: ');
		if (!this.map._enabled) {
			return;
		}

		if (this.ignoreScroll) {
			console.debug('_onScroll: ignoring scroll');
			return;
		}

		var offset = new L.Point(
			-e.mcs.left - this.currentScrollPosX,
			-e.mcs.top - this.currentScrollPosY);

		if (!offset.equals(new L.Point(0, 0))) {
			this.currentScrollPosX = -e.mcs.left;
			this.currentScrollPosY = -e.mcs.top;
			console.debug('_onScroll: scrolling: ' + offset);
			this.map.scroll(offset.x, offset.y);
			this.map.fire('scrolloffset', offset);
		}
	}

	public onScrollEnd (e: any) {
		// needed in order to keep the row/column header correctly aligned
		if (this.map._docLayer._docType === 'spreadsheet') {
			return;
		}

		console.debug('_onScrollEnd:');
		if (this.ignoreScroll) {
			this.ignoreScroll = null;
			console.debug('_onScrollEnd: scrollTop: ' + -e.mcs.top);
			this.map.scrollTop(-e.mcs.top);
		}
		this.currentScrollPosX = -e.mcs.left;
		this.currentScrollPosY = -e.mcs.top;
		// Scrolling quickly via mousewheel messes up the annotations for some reason
		// Triggering the layouting algorithm here, though unnecessary, fixes the problem.
		// This is just a workaround till we find the root cause of why it messes up the annotations
		this.map._docLayer.layoutAnnotations();
	}

	public onScrollTo (e: any) {
		// triggered by the document (e.g. search result out of the viewing area)
		$('.scroll-container').mCustomScrollbar('scrollTo', [e.y, e.x], {calledFromInvalidateCursorMsg: e.calledFromInvalidateCursorMsg});
	}

	public onScrollBy (e: any) {
		e.y *= (-1);
		var y = '+=' + e.y;
		if (e.y < 0) {
			y = '-=' + Math.abs(e.y);
		}
		e.x *= (-1);
		var x = '+=' + e.x;
		if (e.x < 0) {
			x = '-=' + Math.abs(e.x);
		}
		// Note: timeout===1 is checked in my extremely ugly hack in jquery.mCustomScrollbar.js.
		$('.scroll-container').mCustomScrollbar('scrollTo', [y, x], { timeout: 1 });
	}

	public onScrollVelocity (e: any) {
		if (e.vx === 0 && e.vy === 0) {
			clearInterval(this.autoScrollTimer);
			this.autoScrollTimer = null;
			this.map.isAutoScrolling = false;
		} else {
			clearInterval(this.autoScrollTimer);
			this.map.isAutoScrolling = true;
			this.autoScrollTimer = setInterval(L.bind(function() {
				this._onScrollBy({x: e.vx, y: e.vy});
			}, this), 100);
		}
	}

	public onHandleAutoScroll (e :any) {
		var vx = 0;
		var vy = 0;

		if (e.pos.y > e.map._size.y - 50) {
			vy = 50;
		} else if (e.pos.y < 50) {
			vy = -50;
		}
		if (e.pos.x > e.map._size.x - 50) {
			vx = 50;
		} else if (e.pos.x < 50) {
			vx = -50;
		}

		this.onScrollVelocity({vx: vx, vy: vy});
	}

	public onUpdateSize (e: any) {
		if (!this.mockDoc) {
			return;
		}

		// we need to avoid precision issues in comparison (in the end values are pixels)
		var newDocWidth = Math.ceil(e.x);
		var newDocHeight = Math.ceil(e.y);

		// for writer documents, ignore scroll while document size is being reduced
		if (this.map.getDocType() === 'text' && newDocHeight < this.documentHeight) {
			console.debug('_onUpdateSize: Ignore the scroll !');
			this.ignoreScroll = true;
		}

		// Use the rounded pixel values as it makes little sense to use fractional pixels.
		L.DomUtil.setStyle(this.mockDoc, 'width', newDocWidth + 'px');
		L.DomUtil.setStyle(this.mockDoc, 'height', newDocHeight + 'px');

		// custom scrollbar plugin checks automatically for content height changes but not for content width changes
		// so we need to update scrollbars explicitly; moreover we want to avoid to have 'update' invoked twice
		// in case prevDocHeight !== newDocHeight
		if (this.documentWidth !== newDocWidth && this.documentHeight === newDocHeight) {
			$('.scroll-container').mCustomScrollbar('update');
		}

		// Don't get them through L.DomUtil.getStyle because precision is no more than 6 digits
		this.documentWidth = newDocWidth;
		this.documentHeight = newDocHeight;
	}

	public onUpdateScrollOffset (e: any) {
		// used on window resize
		// also when dragging
		var offset = new L.Point(e.x - this.currentScrollPosX, e.y - this.currentScrollPosY);

		this.map.fire('scrolloffset', offset);
		if (e.updateHeaders && this.map._docLayer._docType === 'spreadsheet') {
			// This adjustment was just meant for refreshViewData()
			// to indicate that both column/row headers/gridlines
			// should be updated, no matter what the actual offset
			// is (unsure why).
			// TODO: Get rid of the 'offset' adjustment and
			// only send boolean flags to refreshViewData().
			if (offset.x === 0) {
				offset.x = 1;
			}
			if (offset.y === 0) {
				offset.y = 1;
			}
			this.map._docLayer.refreshViewData({x: e.x, y: e.y, offset: offset});
		}

		this.ignoreScroll = null;
		$('.scroll-container').mCustomScrollbar('stop');
		this.currentScrollPosX = e.x;
		this.currentScrollPosY = e.y;
		$('.scroll-container').mCustomScrollbar('scrollTo', [e.y, e.x], {callbacks: false, timeout:0});
	}

	public onMouseMove () {}
	public onMouseDown () {}
	public onMouseUp () {}
	public onMouseEnter () {}
	public onMouseLeave () {}
	public onClick () {}
	public onDoubleClick () {}
	public onContextMenu () {}
	public onMouseWheel () {}
	public onLongPress () {}
	public onMultiTouchStart () {}
	public onMultiTouchMove () {}
	public onMultiTouchEnd () {}
	public onResize () {}
	public onDraw () {}
	public onNewDocumentTopLeft () {}
}

L.getNewScrollSection = function () {
	return new ScrollSection();
}