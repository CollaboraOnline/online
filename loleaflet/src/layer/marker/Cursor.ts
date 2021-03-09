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
	dpiScale: number = 1;

	private position: CPoint;
	private size: CPoint;
	private container: HTMLDivElement;
	private cursorHeader: HTMLDivElement;
	private cursor: HTMLDivElement;
	private map: any;
	private blinkTimeout: NodeJS.Timeout;
	private visible: boolean = false;

	// position and size should be in core pixels.
	constructor(position: CPoint, size: CPoint, map: any, options: any) {
		this.opacity = options.opacity !== undefined ? options.opacity : this.opacity;
		this.zIndex = options.zIndex !== undefined ? options.zIndex : this.zIndex;
		this.blink = options.blink !== undefined ? options.blink : this.blink;
		this.color = options.color !== undefined ? options.color : this.color;
		this.header = options.header !== undefined ? options.header : this.header;
		this.headerName = options.headerName !== undefined ? options.headerName : this.headerName;
		this.headerTimeout = options.headerTimeout !== undefined ? options.headerTimeout : this.headerTimeout;
		this.dpiScale = options.dpiScale !== undefined ? options.dpiScale : this.dpiScale;

		this.position = position;
		this.size = size;
		this.map = map;

		this.initLayout();
	}

	add() {
		if (!this.container) {
			this.initLayout();
		}

		if (this.container.querySelector('.blinking-cursor') !== null) {
			if (this.map._docLayer._docType === 'presentation') {
				$('.leaflet-interactive').css('cursor', 'text');
			} else {
				$('.leaflet-pane.leaflet-map-pane').css('cursor', 'text');
			}
		}

		this.map.getCursorOverlayContainer().appendChild(this.container);
		this.update();
		if (this.map._docLayer.isCalc())
			this.map.on('splitposchanged move', this.update, this);
		else
			this.map.on('zoomend move', this.update, this);

		this.visible = true;

		document.addEventListener('blur', this.onFocusBlur.bind(this));
		document.addEventListener('focus', this.onFocusBlur.bind(this));
	}

	remove() {
		this.map.off('splitposchanged', this.update, this);
		if (this.map._docLayer._docType === 'presentation') {
			$('.leaflet-interactive').css('cursor', '');
		} else {
			$('.leaflet-pane.leaflet-map-pane').css('cursor', '');
		}
		if (this.container) {
			this.map.getCursorOverlayContainer().removeChild(this.container);
		}

		this.visible = false;

		document.removeEventListener('blur', this.onFocusBlur.bind(this));
		document.removeEventListener('focus', this.onFocusBlur.bind(this));
	}

	isVisible(): boolean {
		return this.visible;
	}

	onFocusBlur(ev: FocusEvent) {
		if (ev.type === 'blur')
			$('.leaflet-cursor').addClass('blinking-cursor-hidden');
		else
			$('.leaflet-cursor').removeClass('blinking-cursor-hidden');
	}

	// position and size should be in core pixels.
	setPositionSize(position: CPoint, size: CPoint) {
		this.position = position;
		this.size = size;
		this.update();
	}

	getPosition(): CPoint {
		return this.position;
	}

	private update() {
		if (!this.container || !this.map)
			return;

		var docBounds = CBounds.fromCompat(this.map.getCorePxDocBounds());
		var inDocCursor = docBounds.contains(this.position);
		// Calculate position and size in CSS pixels.
		var viewBounds = CBounds.fromCompat(this.map.getPixelBoundsCore());
		var spCxt = this.map.getSplitPanesContext();
		var origin = viewBounds.min.clone();
		var paneSize = viewBounds.getSize();
		var splitPos = new CPoint(0, 0);
		if (inDocCursor && spCxt) {
			splitPos = CPoint.fromCompat(
				spCxt.getSplitPos()).multiplyBy(this.dpiScale);
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
			var paneOffset = new CPoint(
				origin.x ? canvasOffset.x - splitPos.x : canvasOffset.x,
				origin.y ? canvasOffset.y - splitPos.y : canvasOffset.y);
			var paneBounds = new CBounds(new CPoint(0, 0), paneSize);

			if (!paneBounds.contains(paneOffset)) {
				this.container.style.visibility = 'hidden';
				return;
			}
		}

		this.container.style.visibility = 'visible';

		var tileSectionPos = this.map._docLayer.getTileSectionPos();
		// Compute tile-section offset in css pixels.
		var pos = canvasOffset.add(tileSectionPos)._divideBy(this.dpiScale)._round();
		var size = this.size.divideBy(this.dpiScale)._round();
		this.setSize(size);
		this.setPos(pos);
	}

	setOpacity(opacity: number) {
		if (this.container) {
			L.DomUtil.setOpacity(this.cursor, opacity);
		}
	}

	showCursorHeader() {
		if (this.cursorHeader) {
			L.DomUtil.setStyle(this.cursorHeader, 'visibility', 'visible');

			clearTimeout(this.blinkTimeout);
			this.blinkTimeout = setTimeout(L.bind(function () {
				L.DomUtil.setStyle(this.cursorHeader, 'visibility', 'hidden');
			}, this), this.headerTimeout);
		}
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

	private setPos(pos: CPoint) {
		this.container.style.top = pos.y + 'px';
		this.container.style.left = pos.x + 'px';
		this.container.style.zIndex = this.zIndex + '';
		// Restart blinking animation
		if (this.blink) {
			L.DomUtil.removeClass(this.cursor, 'blinking-cursor');
			void this.cursor.offsetWidth;
			L.DomUtil.addClass(this.cursor, 'blinking-cursor');
		}
	}

	private setSize(size: CPoint) {
		this.cursor.style.height = size.y + 'px';
		this.container.style.top = '-' + (this.container.clientHeight - size.y - 2) / 2 + 'px';
	}

	static hotSpot = new Map<string, CPoint>([['fill', new CPoint(7, 16)]]);

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
			var cursorHotSpot = Cursor.hotSpot.get(cursorName) || new CPoint(0, 0);
			customCursor = L.Browser.ie ? // IE10 does not like item with left/top position in the url list
				'url(' + Cursor.imagePath + '/' + cursorName + '.cur), default' :
				'url(' + Cursor.imagePath + '/' + cursorName + '.png) ' + cursorHotSpot.x + ' ' + cursorHotSpot.y + ', default';
		}
		return customCursor;
	};
}