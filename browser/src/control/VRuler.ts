/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * Ruler Handler
 */

/* global L _ */

interface Params {
	[key: string]: {
		type: string;
		value: any;
	};
}

interface Options {
	interactive: boolean;
	marginSet: boolean;
	displayNumber: boolean;
	tileMargin: number;
	margin1: number | null;
	margin2: number | null;
	leftOffset: number | null;
	pageOffset: number | null;
	pageWidth: number | null;
	pageTopMargin: number | null;
	pageBottomMargin: number | null;
	tabs: any[];
	unit: string | null;
	DraggableConvertRatio: number | null;
	timer: ReturnType<typeof setTimeout>;
	showruler: boolean;
	position: string;
	disableMarker: boolean;
}

class VRuler {
	_pVerticalStartMarker: HTMLDivElement;
	_pVerticalEndMarker: HTMLDivElement;
	_rFace: HTMLDivElement;
	_markerHorizontalLine: HTMLDivElement;
	_rWrapper: HTMLDivElement;
	_rMarginWrapper: HTMLDivElement;
	_rBPWrapper: HTMLDivElement;
	_rBPContainer: HTMLDivElement;
	_rTSContainer: HTMLDivElement;
	_tMarginMarker: HTMLDivElement;
	_bMarginMarker: HTMLDivElement;
	_tMarginDrag: HTMLDivElement;
	_bMarginDrag: HTMLDivElement;

	_indentationElementId: string;
	_initialposition: number;
	_lastposition: number;
	_map: ReturnType<typeof L.map>;

	options: Options = {
		interactive: true,
		marginSet: false,
		displayNumber: true,
		tileMargin: 20, // No idea what this means and where it comes from
		margin1: null,
		margin2: null,
		leftOffset: null,
		pageOffset: null,
		pageWidth: null,
		pageTopMargin: null,
		pageBottomMargin: null,
		tabs: [],
		unit: null,
		DraggableConvertRatio: null,
		timer: null,
		showruler: true,
		position: 'topleft',
		disableMarker: false,
	};

	constructor(map: ReturnType<typeof L.map>, options: Options) {
		this._map = map;
		Object.assign(this.options, options);
		this.onAdd();
	}

	onAdd() {
		this._map.on('vrulerupdate', this._updateOptions, this);
		this._map.on('scrolllimits', this._updatePaintTimer, this);
		this._map.on('moveend', this._fixOffset, this);
		this._map.on('updatepermission', this._changeInteractions, this);
		this._map.on(
			'resettopbottompagespacing',
			this._resetTopBottomPageSpacing,
			this,
		);
		this._map.on('commandstatechanged', this.onCommandStateChanged, this);
		L.DomUtil.addClass(this._map.getContainer(), 'hasruler');

		const container: HTMLDivElement = this._initLayout();
		const corner: HTMLElement =
			this._map._controlCorners[this.options.position];

		L.DomUtil.addClass(container, 'leaflet-control');

		if (this.options.position.indexOf('bottom') !== -1) {
			corner.insertBefore(container, corner.firstChild);
		} else {
			corner.appendChild(container);
		}
	}

	_updatePaintTimer() {
		clearTimeout(this.options.timer);
		this.options.timer = setTimeout(L.bind(this._updateBreakPoints, this), 300);
	}

	_resetTopBottomPageSpacing(e?: any) {
		this.options.pageTopMargin = undefined;
		this.options.pageBottomMargin = undefined;
		if (e) this.options.disableMarker = e.disableMarker;
	}

	getWindowProperty<T>(propertyName: string): T | undefined {
		return (window as any)[propertyName];
	}

	onCommandStateChanged(e: any) {
		// reset Top bottom margin on style change
		// Style will change when we do focus on section like Header, Footer, Main text section
		if (e.commandName == '.uno:StyleApply') this._resetTopBottomPageSpacing();
	}

	_changeInteractions(e: any) {
		if (this._tMarginDrag) {
			if (e.perm === 'edit') {
				this._tMarginDrag.style.cursor = 'e-resize';
				this._bMarginDrag.style.cursor = 'w-resize';
			} else {
				this._tMarginDrag.style.cursor = 'default';
				this._bMarginDrag.style.cursor = 'default';
			}
		}
	}

	_initiateIndentationMarkers() {
		// Paragraph indentation..
		this._pVerticalStartMarker = document.createElement('div');
		this._pVerticalStartMarker.id = 'lo-vertical-pstart-marker';
		this._pVerticalStartMarker.classList.add(
			'cool-ruler-indentation-marker-up',
		);
		this._rFace.appendChild(this._pVerticalStartMarker);

		// Paragraph end..
		this._pVerticalEndMarker = document.createElement('div');
		this._pVerticalEndMarker.id = 'lo-vertical-pend-marker';
		this._pVerticalEndMarker.classList.add('cool-ruler-indentation-marker-up');
		this._rFace.appendChild(this._pVerticalEndMarker);

		// While one of the markers is being dragged, a howrizontal line should be visible in order to indicate the new position of the marker..
		this._markerHorizontalLine = L.DomUtil.create(
			'div',
			'cool-ruler-horizontal-indentation-marker-center',
		);
		this._rFace.appendChild(this._markerHorizontalLine);

		L.DomEvent.on(
			this._pVerticalStartMarker,
			'mousedown',
			(window as typeof window & { touch: any }).touch.mouseOnly(
				this._initiateIndentationDrag,
			),
			this,
		);
		L.DomEvent.on(
			this._pVerticalEndMarker,
			'mousedown',
			(window as typeof window & { touch: any }).touch.mouseOnly(
				this._initiateIndentationDrag,
			),
			this,
		);
	}

	_initLayout() {
		this._rWrapper = L.DomUtil.create(
			'div',
			'cool-ruler leaflet-bar leaflet-control leaflet-control-custom',
		);
		this._rWrapper.id = 'vertical-ruler';
		this._rWrapper.style.visibility = 'hidden';

		// We start it hidden rather than not initialzing at all.
		// It is due to rulerupdate command that comes from LOK.
		// If we delay its initialization, we can't calculate its margins and have to wait for another rulerupdate message to arrive.
		if (!this.options.showruler) {
			L.DomUtil.setStyle(this._rWrapper, 'display', 'none');
		}
		this._rFace = L.DomUtil.create('div', 'cool-ruler-face', this._rWrapper);
		this._rMarginWrapper = L.DomUtil.create(
			'div',
			'cool-ruler-marginwrapper',
			this._rFace,
		);
		// BP => Break Points
		this._rBPWrapper = L.DomUtil.create(
			'div',
			'cool-ruler-breakwrapper',
			this._rFace,
		);
		this._rBPContainer = L.DomUtil.create(
			'div',
			'cool-ruler-breakcontainer',
			this._rBPWrapper,
		);

		// Tab stops
		this._rTSContainer = L.DomUtil.create(
			'div',
			'cool-ruler-tabstopcontainer',
			this._rMarginWrapper,
		);
		this._initiateIndentationMarkers();

		return this._rWrapper;
	}

	_updateOptions(obj: Options) {
		// window.app.console.log('===> _updateOptions');
		// Note that the values for margin1, margin2 and leftOffset are not in any sane
		// units. See the comment in SwCommentRuler::CreateJsonNotification(). The values
		// are pixels for some virtual device in core, not related to the actual device this
		// is running on at all, passed through convertTwipToMm100(), i.e. multiplied by
		// approximately 1.76. Let's call these units "arbitrary pixelish units" in
		// comments here.
		this.options.margin1 = obj['margin1'];
		this.options.margin2 = obj['margin2'];
		this.options.leftOffset = obj['leftOffset'];
		this.options.pageOffset = obj['pageOffset'];

		// pageWidth on the other hand *is* really in mm100.
		this.options.pageWidth = obj['pageWidth'];

		// set top and bottom margin of page default to leftOffset.
		// this values only change based on which marker we drag on vertical ruler
		if (!this.options.pageTopMargin && !this.options.pageBottomMargin) {
			this.options.pageTopMargin = this.options.leftOffset;
			this.options.pageBottomMargin = this.options.leftOffset;
		}

		this._rWrapper.style.visibility = '';
		this._rWrapper.style.transform = 'rotate(90deg)';
		const position: string =
			document.documentElement.dir === 'rtl' ? 'top right' : 'top left';
		this._rWrapper.style.transformOrigin = position;
		this._rWrapper.style.left = this.options.tileMargin + 'px';
		this._updateBreakPoints();
	}

	_updateParagraphIndentations() {
		// for horizontal Ruler we need to also consider height of navigation and toolbar-wrraper
		const documentTop: number = document
			.getElementById('document-container')
			.getBoundingClientRect().top;
		// rTSContainer is the reference element.
		const pStartPosition: number =
			this._rTSContainer.getBoundingClientRect().top - documentTop;
		const pEndPosition: number =
			this._rTSContainer.getBoundingClientRect().bottom - documentTop;

		// We calculated the positions. Now we should move them to left in order to make their sharp edge point to the right direction..
		this._pVerticalStartMarker.style.left =
			pStartPosition -
			this._pVerticalStartMarker.getBoundingClientRect().width / 2 +
			'px';
		this._pVerticalStartMarker.style.display = 'block';
		this._pVerticalEndMarker.style.left =
			pEndPosition -
			this._pVerticalEndMarker.getBoundingClientRect().width +
			'px';
		this._pVerticalEndMarker.style.display = 'block';

		// we do similar operation as we do in Horizontal ruler
		// but this element rotated to 90deg so top of marker should be opposite to horizontal (Negative in this case)
		this._markerHorizontalLine.style.top = '-100vw';
		this._markerHorizontalLine.style.left =
			this._pVerticalStartMarker.style.left;
		if (this.options.disableMarker) {
			this._pVerticalStartMarker.style.display = 'none';
			this._pVerticalEndMarker.style.display = 'none';
		}
	}

	_updateBreakPoints() {
		if (this.options.margin1 == null || this.options.margin2 == null) return;

		const topMargin: number = this.options.leftOffset;
		const docLayer = this._map._docLayer;

		// This is surely bogus. We take pageWidth, which is in mm100, and subtract a value
		// that is in "arbitrary pixelish units". But the only thing bottomMargin is used for is
		// to calculate the width of the part of the ruler that goes out over the right side
		// of the window anyway (see the assignments to this._bMarginMarker.style.width and
		// this._bMarginDrag.style.width near the end of this function), so presumably it
		// doesn't matter that much what bottomMargin is.
		const bottomMargin: number =
			this.options.pageWidth - (this.options.leftOffset + this.options.margin2);
		this.options.pageBottomMargin = bottomMargin;

		const scale: number = this._map.getZoomScale(this._map.getZoom(), 10);
		const wPixel: number =
			docLayer._docPixelSize.y / docLayer._pages -
			this.options.tileMargin * 2 * scale;

		this._fixOffset();

		this.options.DraggableConvertRatio = wPixel / this.options.pageWidth;
		this._rFace.style.width = wPixel + 'px';
		this._rBPContainer.style.marginLeft =
			-1 * (this.options.DraggableConvertRatio * (500 - (topMargin % 1000))) +
			1 +
			'px';

		let numCounter: number = -1 * Math.floor(topMargin / 1000);

		L.DomUtil.removeChildNodes(this._rBPContainer);

		// this.options.pageWidth is in mm100, so the code here makes one ruler division per
		// centimetre.
		//
		// FIXME: Surely this should be locale-specific, we would want to use inches at
		// least in the US. (The ruler unit to use doesn't seem to be stored in the document
		// at least for .odt?)
		for (let num: number = 0; num <= this.options.pageWidth / 1000 + 1; num++) {
			const marker = L.DomUtil.create(
				'div',
				'cool-ruler-maj',
				this._rBPContainer,
			);
			// The - 1 is to compensate for the left and right .5px borders of
			// cool-ruler-maj in leaflet.css.
			marker.style.width = this.options.DraggableConvertRatio * 1000 - 1 + 'px';
			if (this.options.displayNumber) {
				marker.innerText = Math.abs(numCounter);
				numCounter++;
			}
		}

		if (!this.options.marginSet) {
			this.options.marginSet = true;
			this._tMarginMarker = L.DomUtil.create(
				'div',
				'cool-ruler-margin cool-ruler-left',
				this._rFace,
			);
			this._bMarginMarker = L.DomUtil.create(
				'div',
				'cool-ruler-margin cool-ruler-right',
				this._rFace,
			);
			this._tMarginDrag = L.DomUtil.create(
				'div',
				'cool-ruler-drag cool-ruler-left',
				this._rMarginWrapper,
			);
			this._bMarginDrag = L.DomUtil.create(
				'div',
				'cool-ruler-drag cool-ruler-right',
				this._rMarginWrapper,
			);
			const topMarginTooltipText: string = _('Top Margin');
			const bottomMarginTooltipText: string = _('Bottom Margin');

			this._tMarginDrag.dataset.title = topMarginTooltipText;
			this._bMarginDrag.dataset.title = bottomMarginTooltipText;
		}

		this._tMarginMarker.style.width =
			this.options.DraggableConvertRatio * topMargin + 'px';
		this._bMarginMarker.style.width =
			this.options.DraggableConvertRatio * bottomMargin + 'px';
		this._tMarginDrag.style.width =
			this.options.DraggableConvertRatio * topMargin + 'px';
		this._bMarginDrag.style.width =
			this.options.DraggableConvertRatio * bottomMargin + 'px';

		// Put the _rTSContainer in the right place
		this._rTSContainer.style.left =
			this.options.DraggableConvertRatio * topMargin + 'px';
		this._rTSContainer.style.right =
			this.options.DraggableConvertRatio * bottomMargin + 'px';

		this._updateParagraphIndentations();

		if (this.options.interactive) {
			this._changeInteractions({ perm: 'edit' });
		} else {
			this._changeInteractions({ perm: 'readonly' });
		}
	}

	_fixOffset() {
		if (!this._map.options.docBounds) return;

		const scale: number = this._map.getZoomScale(this._map.getZoom(), 10);
		const mapPane = this._map._mapPane;
		const topLeft = this._map.latLngToLayerPoint(
			this._map.options.docBounds.getNorthWest(),
		);
		const firstTileXTranslate = topLeft.y;

		let mapPaneYTranslate: number = 0;
		const computedStyle = window.getComputedStyle(mapPane);
		const transformValue = computedStyle.getPropertyValue('transform');
		const transformMatrix = new DOMMatrixReadOnly(transformValue);

		// Get the translateY values
		mapPaneYTranslate = transformMatrix.f;

		// we need to also consider  if there is more then 1 page then pageoffset is crucial to consider
		// i have calculated current page using pageoffset and pageWidth coming from CORE
		// based on that calculate the page offset
		// so if cursor moves to other page we will see how many pages before current page are there
		// and then add totalHeight of all those pages to our final calculation of rulerOffset
		const currentPage: number = Math.floor(
			this.options.pageOffset / this.options.pageWidth,
		);
		let pageoffset: number = 0;
		if (this._map._docLayer._docPixelSize)
			pageoffset =
				currentPage *
				(this._map._docLayer._docPixelSize.y / this._map._docLayer._pages);

		const rulerOffset: number =
			mapPaneYTranslate +
			firstTileXTranslate +
			pageoffset +
			this.options.tileMargin * scale;

		this._rFace.style.marginInlineStart = rulerOffset + 'px';

		this._updateParagraphIndentations();
	}

	_moveIndentation(e: any) {
		if (e.type === 'panmove') {
			e.clientX = e.center.x;
		}

		const element: HTMLElement = document.getElementById(
			this._indentationElementId,
		);
		// for horizontal Ruler we need to also consider height of navigation and toolbar-wrraper
		const documentTop = document
			.getElementById('document-container')
			.getBoundingClientRect().top;

		// User is moving the cursor / their finger on the screen and we are moving the marker.
		const newLeft: number =
			parseInt(element.style.left.replace('px', '')) +
			e.clientY -
			this._lastposition -
			documentTop;
		element.style.left = String(newLeft) + 'px';
		this._lastposition = e.clientY - documentTop;
		// halfWidth..
		const halfWidth: number =
			(element.getBoundingClientRect().right -
				element.getBoundingClientRect().left) *
			0.5;
		this._markerHorizontalLine.style.left = String(newLeft + halfWidth) + 'px';
	}

	_moveIndentationEnd(e: Event) {
		this._map.rulerActive = false;

		if (e.type !== 'panend') {
			L.DomEvent.off(this._rFace, 'mousemove', this._moveIndentation, this);
			L.DomEvent.off(this._map, 'mouseup', this._moveIndentationEnd, this);
		}

		// Calculation step..
		// The new coordinate of element subject to indentation is sent as a percentage of the page width..
		// We need to calculate the percentage. Left margin (leftOffset) is not being added to the indentation (on the core part)..
		// We can use TabStopContainer's position as the reference point, as they share the same reference point..
		const element: HTMLElement = document.getElementById(
			this._indentationElementId,
		);

		// The halfWidth of the shape..
		const halfWidth: number =
			(element.getBoundingClientRect().bottom -
				element.getBoundingClientRect().top) *
			0.5;

		const params: Params = {};
		const upperMargin: string = 'Space.Upper';
		const lowerMargin: string = 'Space.Lower';
		if (
			this._pVerticalStartMarker.getBoundingClientRect().top >
			this._pVerticalEndMarker.getBoundingClientRect().top
		) {
			// do not change anything if Start marker goes beyond the end marker in that case we hold the last original postions or marker
			this._fixOffset();
		} else if (element.id == 'lo-vertical-pstart-marker') {
			const topMarginPX: number =
				this._pVerticalStartMarker.getBoundingClientRect().top -
				this._rTSContainer.getBoundingClientRect().top +
				halfWidth;
			const top: number =
				topMarginPX / this.options.DraggableConvertRatio +
				this.options.pageTopMargin;
			// margin should not go above page top
			this.options.pageTopMargin = top < 0 ? this.options.pageTopMargin : top;
		} else if (element.id == 'lo-vertical-pend-marker') {
			const bottomMarginPX: number =
				this._rTSContainer.getBoundingClientRect().bottom -
				this._pVerticalEndMarker.getBoundingClientRect().bottom +
				halfWidth;
			const bottom: number =
				bottomMarginPX / this.options.DraggableConvertRatio +
				this.options.pageBottomMargin;
			// margin should not go below page bottom
			this.options.pageBottomMargin =
				bottom < 0 ? this.options.pageBottomMargin : bottom;
		}
		params[upperMargin] = {
			type: 'long',
			value: this.options.pageTopMargin,
		};
		params[lowerMargin] = {
			type: 'long',
			value: this.options.pageBottomMargin,
		};
		this._map.sendUnoCommand('.uno:SetLongTopBottomMargin', params);

		this._indentationElementId = '';
		this._markerHorizontalLine.style.display = 'none';
	}

	_initiateIndentationDrag(e: any) {
		if (
			this.getWindowProperty<boolean>('ThisIsTheiOSApp') &&
			!this._map.isEditMode()
		)
			return;

		this._map.rulerActive = true;

		this._indentationElementId =
			e.target.id.trim() === '' ? e.target.parentNode.id : e.target.id;

		if (e.type !== 'panstart') {
			L.DomEvent.on(this._rFace, 'mousemove', this._moveIndentation, this);
			L.DomEvent.on(this._map, 'mouseup', this._moveIndentationEnd, this);
		} else {
			e.clientX = e.center.x;
		}
		// for horizontal Ruler we need to also consider height of navigation and toolbar-wrraper
		const documentTop: number = document
			.getElementById('document-container')
			.getBoundingClientRect().top;

		this._initialposition = this._lastposition = e.clientY - documentTop;
		this._markerHorizontalLine.style.display = 'block';
		this._markerHorizontalLine.style.left = this._lastposition + 'px';
	}
}

L.control.vruler = function (map: ReturnType<typeof L.map>, options: any) {
	return new VRuler(map, options);
};
