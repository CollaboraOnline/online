/* eslint-disable */

declare var $: any;
declare var L: any;

/*
 * Cursor implements a blinking cursor.
 * This is used as the text-cursor(in and out of document) and view-cursor.
 */

class Cursor {
	opacity: number = 1;
	zIndex: number = 1000;
	blink: boolean = false;
	color: string;
	header: boolean = false;
	headerName: string;
	headerTimeout: number = 3000;

	private position: cool.Point;
	private size: cool.Point;
	private width: number;
	private container: HTMLDivElement;
	private cursorHeader: HTMLDivElement;
	private cursor: HTMLDivElement;
	private map: any;
	private blinkTimeout: NodeJS.Timeout;
	private visible: boolean = false;
	private domAttached: boolean = false;

	// position and size should be in core pixels.
	constructor(position: cool.Point, size: cool.Point, map: any, options: any) {
		this.opacity = options.opacity !== undefined ? options.opacity : this.opacity;
		this.zIndex = options.zIndex !== undefined ? options.zIndex : this.zIndex;
		this.blink = options.blink !== undefined ? options.blink : this.blink;
		this.color = options.color !== undefined ? options.color : this.color;
		this.header = options.header !== undefined ? options.header : this.header;
		this.headerName = options.headerName !== undefined ? options.headerName : this.headerName;
		this.headerTimeout = options.headerTimeout !== undefined ? options.headerTimeout : this.headerTimeout;

		this.position = position;
		this.size = size;
		this.map = map;

		this.initLayout();
	}

	add() {
		if (!this.container) {
			this.initLayout();
		}

		this.setMouseCursor();

		this.map.getCursorOverlayContainer().appendChild(this.container);
		this.visible = true;
		this.domAttached = true;

		this.update();

		let cursor_css = getComputedStyle(this.cursor, null);
		this.width = parseFloat(cursor_css.getPropertyValue("width"));

		if (this.map._docLayer.isCalc())
			this.map.on('splitposchanged move', this.update, this);
		else
			this.map.on('move', this.update, this);

		window.addEventListener('blur', this.onFocusBlur.bind(this));
		window.addEventListener('focus', this.onFocusBlur.bind(this));
		window.addEventListener('resize', this.onResize.bind(this));
	}

	setMouseCursor() {
		if (this.domAttached && this.container && this.container.querySelector('.blinking-cursor') !== null) {
			if (this.map._docLayer._docType === 'presentation') {
				$('.leaflet-interactive').css('cursor', 'text');
			} else {
				$('.leaflet-pane.leaflet-map-pane').css('cursor', 'text');
			}
		}
	}
	setMouseCursorForTextBox() {
		if (this.domAttached && this.container && this.container.querySelector('.blinking-cursor') !== null) {
			$('.leaflet-interactive').css('cursor', 'text');
		}
	}

	remove() {
		this.map.off('splitposchanged', this.update, this);
		if (this.map._docLayer._docType === 'presentation') {
			$('.leaflet-interactive').css('cursor', '');
		} else {
			$('.leaflet-pane.leaflet-map-pane').css('cursor', '');
		}
		if (this.container && this.domAttached) {
			this.map.getCursorOverlayContainer().removeChild(this.container);
		}

		this.visible = false;
		this.domAttached = false;

		window.removeEventListener('blur', this.onFocusBlur.bind(this));
		window.removeEventListener('focus', this.onFocusBlur.bind(this));
		window.removeEventListener('resize', this.onResize.bind(this));
	}

	isDomAttached(): boolean {
		return this.domAttached;
	}

	addCursorClass(visible: boolean) {
		if (visible)
			L.DomUtil.removeClass(this.cursor, 'blinking-cursor-hidden');
		else
			L.DomUtil.addClass(this.cursor, 'blinking-cursor-hidden');
	}

	isVisible(): boolean {
		return this.visible;
	}

	onFocusBlur(ev: FocusEvent) {
		this.addCursorClass(ev.type !== 'blur');
	}

	onResize() {
		if (window.devicePixelRatio !== 1 )
			this.cursor.style.width = this.width / window.devicePixelRatio + 'px';
		else
			this.cursor.style.removeProperty('width');
	}

	// position and size should be in core pixels.
	setPositionSize(position: cool.Point, size: cool.Point) {
		this.position = position;
		this.size = size;
		this.update();
	}

	getPosition(): cool.Point {
		return this.position;
	}

	private update() {
		if (!this.container || !this.map)
			return;

		var docBounds = <cool.Bounds>this.map.getCorePxDocBounds();
		var inDocCursor = docBounds.contains(this.position);
		// Calculate position and size in CSS pixels.
		var viewBounds = <cool.Bounds>(this.map.getPixelBoundsCore());
		var spCxt = this.map.getSplitPanesContext();
		var origin = viewBounds.min.clone();
		var paneSize = viewBounds.getSize();
		var splitPos = new cool.Point(0, 0);
		if (inDocCursor && spCxt) {
			splitPos = spCxt.getSplitPos().multiplyBy(app.dpiScale);
			if (this.position.x <= splitPos.x && this.position.x >= 0) {
				origin.x = 0;
				paneSize.x = splitPos.x;
			}
			else {
				paneSize.x -= splitPos.x;
			}

			if (this.position.y <= splitPos.y && this.position.y >= 0) {
				origin.y = 0;
				paneSize.y = splitPos.y;
			}
			else {
				paneSize.y -= splitPos.y;
			}
		}
		var canvasOffset = this.position.subtract(origin);

		if (inDocCursor) {
			var cursorOffset = new cool.Point(
				origin.x ? canvasOffset.x - splitPos.x : canvasOffset.x,
				origin.y ? canvasOffset.y - splitPos.y : canvasOffset.y);
			var paneBounds = new cool.Bounds(new cool.Point(0, 0), paneSize);
			var cursorBounds = new cool.Bounds(cursorOffset, cursorOffset.add(this.size));

			if (!paneBounds.contains(cursorBounds)) {
				this.container.style.visibility = 'hidden';
				this.visible = false;
				this.addCursorClass(this.visible);
				this.showCursorHeader();
				return;
			}
		}

		this.container.style.visibility = 'visible';
		this.visible = true;
		this.addCursorClass(this.visible);

		var tileSectionPos = this.map._docLayer.getTileSectionPos();
		// Compute tile-section offset in css pixels.
		var pos = canvasOffset.add(tileSectionPos)._divideBy(app.dpiScale)._round();
		var size = this.size.divideBy(app.dpiScale)._round();
		this.setSize(size);
		this.setPos(pos);
		this.showCursorHeader();
	}

	setOpacity(opacity: number) {
		if (this.container)
			L.DomUtil.setOpacity(this.cursor, opacity);
		if (this.cursorHeader)
			L.DomUtil.setOpacity(this.cursorHeader, opacity);
	}

	// Shows cursor header if cursor is in visible area.
	showCursorHeader() {
		if (this.cursorHeader) {
			if (!this.visible || this.map._docLayer._isZooming) {
				this.hideCursorHeader();
				return;
			}

			L.DomUtil.setStyle(this.cursorHeader, 'visibility', 'visible');

			clearTimeout(this.blinkTimeout);
			this.blinkTimeout = setTimeout(L.bind(function () {
				this.hideCursorHeader();
			}, this), this.headerTimeout);
		}
	}

	hideCursorHeader() {
		if (this.cursorHeader)
			L.DomUtil.setStyle(this.cursorHeader, 'visibility', 'hidden');
	}

	private initLayout() {
		this.container = L.DomUtil.create('div', 'leaflet-cursor-container');
		if (this.header) {
			this.cursorHeader = L.DomUtil.create('div', 'leaflet-cursor-header', this.container);

			this.cursorHeader.textContent = this.headerName;

			clearTimeout(this.blinkTimeout);
			this.blinkTimeout = setTimeout(L.bind(function () {
				L.DomUtil.setStyle(this._cursorHeader, 'visibility', 'hidden');
			}, this), this.headerTimeout);
		}
		this.cursor = L.DomUtil.create('div', 'leaflet-cursor', this.container);
		if (this.blink) {
			L.DomUtil.addClass(this.cursor, 'blinking-cursor');
		}

		if (this.color) {
			L.DomUtil.setStyle(this.cursorHeader, 'background', this.color);
			L.DomUtil.setStyle(this.cursor, 'background', this.color);
		}

		L.DomEvent
			.disableClickPropagation(this.cursor)
			.disableScrollPropagation(this.container);
	}

	private transformX(xpos: number): number {
		if (!this.map._docLayer.isCalcRTL()) {
			return xpos;
		}

		return this.map._size.x - xpos;
	}

	private setPos(pos: cool.Point) {
		this.container.style.top = pos.y + 'px';
		this.container.style.left = this.transformX(pos.x) + 'px';
		this.container.style.zIndex = this.zIndex + '';
		// Restart blinking animation
		if (this.blink) {
			L.DomUtil.removeClass(this.cursor, 'blinking-cursor');
			void this.cursor.offsetWidth;
			L.DomUtil.addClass(this.cursor, 'blinking-cursor');
		}
	}

	private setSize(size: cool.Point) {
		this.cursor.style.height = size.y + 'px';
		this.container.style.top = '-' + (this.container.clientHeight - size.y - 2) / 2 + 'px';
	}

	static hotSpot = new Map<string, cool.Point>([['fill', new cool.Point(7, 16)]]);

	static customCursors = [
		'fill'
	];

	static imagePath: string;

	static isCustomCursor(cursorName: string): boolean {
		return (Cursor.customCursors.indexOf(cursorName) !== -1);
	}

	static getCustomCursor(cursorName: string) {
		var customCursor;

		if (Cursor.isCustomCursor(cursorName)) {
			var cursorHotSpot = Cursor.hotSpot.get(cursorName) || new cool.Point(0, 0);
			customCursor = L.Browser.ie ? // IE10 does not like item with left/top position in the url list
				'url(' + Cursor.imagePath + '/' + cursorName + '.cur), default' :
				'url(' + Cursor.imagePath + '/' + cursorName + '.png) ' + cursorHotSpot.x + ' ' + cursorHotSpot.y + ', default';
		}
		return customCursor;
	};
}
