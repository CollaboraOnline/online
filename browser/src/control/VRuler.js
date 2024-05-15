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

/* global app L _ */
L.Control.VRuler = L.Control.extend({
	options: {
		interactive: true,
		marginSet: false,
		displayNumber: true,
		tileMargin: 20, // No idea what this means and where it comes from
		margin1: null,
		margin2: null,
		nullOffset: null,
		pageOffset: null,
		pageWidth: null,
		tabs: [],
		unit: null,
		DraggableConvertRatio: null,
		timer: null,
		showruler: true,
	},

	onAdd: function(map) {
		map.on('vrulerupdate', this._updateOptions, this);
		map.on('scrolllimits', this._updatePaintTimer, this);
		map.on('moveend', this._fixOffset, this);
		map.on('updatepermission', this._changeInteractions, this);
		L.DomUtil.addClass(map.getContainer(), 'hasruler');
		this._map = map;

		return this._initLayout();
	},

	_updatePaintTimer: function() {
		clearTimeout(this.options.timer);
		this.options.timer = setTimeout(L.bind(this._updateBreakPoints, this), 300);
	},

	_changeInteractions: function(e) {
		if (this._lMarginDrag) {
			if (e.perm === 'edit') {
				this._lMarginDrag.style.cursor = 'e-resize';
				this._rMarginDrag.style.cursor = 'w-resize';
			}
			else {
				this._lMarginDrag.style.cursor = 'default';
				this._rMarginDrag.style.cursor = 'default';
			}
		}
	},

	_initiateIndentationMarkers: function() {

		// Paragraph indentation..
		this._pStartMarker = document.createElement('div');
		this._pStartMarker.id = 'lo-vertical-pstart-marker';
		this._pStartMarker.classList.add('cool-ruler-indentation-marker-up');
		this._rFace.appendChild(this._pStartMarker);

		// Paragraph end..
		this._pEndMarker = document.createElement('div');
		this._pEndMarker.id = 'lo-vertical-pend-marker';
		this._pEndMarker.classList.add('cool-ruler-indentation-marker-up');
		this._rFace.appendChild(this._pEndMarker);

		// While one of the markers is being dragged, a howrizontal line should be visible in order to indicate the new position of the marker..
		this._markerHorizontalLine = L.DomUtil.create('div', 'cool-ruler-horizontal-indentation-marker-center');
		this._rFace.appendChild(this._markerHorizontalLine);


		L.DomEvent.on(this._pStartMarker, 'mousedown', window.touch.mouseOnly(this._initiateIndentationDrag), this);
		L.DomEvent.on(this._pEndMarker, 'mousedown', window.touch.mouseOnly(this._initiateIndentationDrag), this);
	},

	_initLayout: function() {
		this._rWrapper = L.DomUtil.create('div', 'cool-ruler leaflet-bar leaflet-control leaflet-control-custom');
		this._rWrapper.id = 'vertical-ruler'
		this._rWrapper.style.visibility = 'hidden';

		// We start it hidden rather than not initialzing at all.
		// It is due to rulerupdate command that comes from LOK.
		// If we delay its initialization, we can't calculate its margins and have to wait for another rulerupdate message to arrive.
		if (!this.options.showruler) {
			L.DomUtil.setStyle(this._rWrapper, 'display', 'none');
		}
		this._rFace = L.DomUtil.create('div', 'cool-ruler-face', this._rWrapper);
		this._rMarginWrapper = L.DomUtil.create('div', 'cool-ruler-marginwrapper', this._rFace);
		// BP => Break Points
		this._rBPWrapper = L.DomUtil.create('div', 'cool-ruler-breakwrapper', this._rFace);
		this._rBPContainer = L.DomUtil.create('div', 'cool-ruler-breakcontainer', this._rBPWrapper);

		// Tab stops
		this._rTSContainer = L.DomUtil.create('div', 'cool-ruler-tabstopcontainer', this._rMarginWrapper);
		this._initiateIndentationMarkers();

		return this._rWrapper;
	},

	_updateOptions: function(obj) {
		// window.app.console.log('===> _updateOptions');
		// Note that the values for margin1, margin2 and leftOffset are not in any sane
		// units. See the comment in SwCommentRuler::CreateJsonNotification(). The values
		// are pixels for some virtual device in core, not related to the actual device this
		// is running on at all, passed through convertTwipToMm100(), i.e. multiplied by
		// approximately 1.76. Let's call these units "arbitrary pixelish units" in
		// comments here.
		this.options.margin1 = parseInt(obj['margin1']);
		this.options.margin2 = parseInt(obj['margin2']);
		this.options.nullOffset = parseInt(obj['leftOffset']);
		this.options.pageOffset = parseInt(obj['pageOffset']);

		// pageWidth on the other hand *is* really in mm100.
		this.options.pageWidth = parseInt(obj['pageWidth']);

		// to be enabled only after adding support for other length units as well
		// this.options.unit = obj['unit'].trim();

		this._rWrapper.style.visibility = '';
		this._rWrapper.style.transform = 'rotate(90deg)';
		var position = document.documentElement.dir === 'rtl' ? 'top right' : 'top left';
		this._rWrapper.style.transformOrigin = position;
		this._rWrapper.style.left = this.options.tileMargin + 'px';
		this._updateBreakPoints();
	},

	_updateParagraphIndentations: function() {
		var items = this._map['stateChangeHandler'];
		var state = items.getItemValue('.uno:LeftRightParaMargin');

		if (!state)
			return;

		this.options.leftParagraphIndent = parseFloat(state.left.replace(',', '.'));
		this.options.rightParagraphIndent = parseFloat(state.right.replace(',', '.'));
		this.options.indentUnit = state.unit;

		var pxPerMm100 = this._map._docLayer._docPixelSize.x / (this._map._docLayer._docWidthTwips * 2540/1440);

		// Conversion to mm100.
		if (this.options.indentUnit === 'inch') {
			this.options.leftParagraphIndent = this.options.leftParagraphIndent * 2540;
			this.options.rightParagraphIndent = this.options.rightParagraphIndent * 2540;
		}

		this.options.leftParagraphIndent *= pxPerMm100;
		this.options.rightParagraphIndent *= pxPerMm100;

		// for horizontal Ruler we need to also consider height of navigation and toolbar-wrraper 
		var documentTop = document.getElementById('document-container').getBoundingClientRect().top;
		// rTSContainer is the reference element.
		var pStartPosition = this._rTSContainer.getBoundingClientRect().top + this.options.leftParagraphIndent - documentTop;
		var pEndPosition = this._rTSContainer.getBoundingClientRect().bottom - this.options.rightParagraphIndent - documentTop;

		// We calculated the positions. Now we should move them to left in order to make their sharp edge point to the right direction..
		this._pStartMarker.style.left = pStartPosition - this._pStartMarker.getBoundingClientRect().width  + 'px';
		this._pEndMarker.style.left = pEndPosition - this._pEndMarker.getBoundingClientRect().width + 'px';

		// we do similar operation as we do in Horizontal ruler 
		// but this element rotated to 90deg so top of marker should be opposite to horizontal (Negative in this case)
		this._markerHorizontalLine.style.top = '-100vw';
		this._markerHorizontalLine.style.left = this._pStartMarker.style.left;
	},

	_updateBreakPoints: function() {

		if (this.options.margin1 == null || this.options.margin2 == null)
			return;

		var lMargin, rMargin, wPixel, scale;
		var docLayer = this._map._docLayer;

		lMargin = this.options.nullOffset;

		// This is surely bogus. We take pageWidth, which is in mm100, and subtract a value
		// that is in "arbitrary pixelish units". But the only thing rMargin is used for is
		// to calculate the width of the part of the ruler that goes out over the right side
		// of the window anyway (see the assignments to this._rMarginMarker.style.width and
		// this._rMarginDrag.style.width near the end of this function), so presumably it
		// doesn't matter that much what rMargin is.
		rMargin = this.options.pageWidth - (this.options.nullOffset + this.options.margin2);

		scale = this._map.getZoomScale(this._map.getZoom(), 10);
		wPixel = (docLayer._docPixelSize.y/docLayer._pages) - (this.options.tileMargin * 2) * scale;

		this._fixOffset();

		this.options.DraggableConvertRatio = wPixel / this.options.pageWidth;
		this._rFace.style.width = wPixel + 'px';
		this._rBPContainer.style.marginLeft = (-1 * (this.options.DraggableConvertRatio * (500 - (lMargin % 1000))) + 1) + 'px';

		var numCounter = -1 * parseInt(lMargin / 1000);

		L.DomUtil.removeChildNodes(this._rBPContainer);

		// this.options.pageWidth is in mm100, so the code here makes one ruler division per
		// centimetre.
		//
		// FIXME: Surely this should be locale-specific, we would want to use inches at
		// least in the US. (The ruler unit to use doesn't seem to be stored in the document
		// at least for .odt?)
		for (var num = 0; num <= (this.options.pageWidth / 1000) + 1; num++) {
			var marker = L.DomUtil.create('div', 'cool-ruler-maj', this._rBPContainer);
			// The - 1 is to compensate for the left and right .5px borders of
			// cool-ruler-maj in leaflet.css.
			marker.style.width = this.options.DraggableConvertRatio*1000 - 1 + 'px';
			if (this.options.displayNumber) {
				if (numCounter !== 0)
					marker.innerText = Math.abs(numCounter++);
				else
					numCounter++;
			}
		}

		if (!this.options.marginSet) {
			this.options.marginSet = true;
			this._lMarginMarker = L.DomUtil.create('div', 'cool-ruler-margin cool-ruler-left', this._rFace);
			this._rMarginMarker =  L.DomUtil.create('div', 'cool-ruler-margin cool-ruler-right', this._rFace);
			this._lMarginDrag = L.DomUtil.create('div', 'cool-ruler-drag cool-ruler-left', this._rMarginWrapper);
			this._lToolTip = L.DomUtil.create('div', 'cool-ruler-ltooltip', this._lMarginDrag);
			this._rMarginDrag = L.DomUtil.create('div', 'cool-ruler-drag cool-ruler-right', this._rMarginWrapper);
			this._rToolTip = L.DomUtil.create('div', 'cool-ruler-rtooltip', this._rMarginDrag);
			var lMarginTooltipText = _('Top Margin');
			var rMarginTooltipText = _('Bottom Margin');

			this._lMarginDrag.dataset.title = lMarginTooltipText;
			this._rMarginDrag.dataset.title = rMarginTooltipText;
		}

		this._lMarginMarker.style.width = (this.options.DraggableConvertRatio*lMargin) + 'px';
		this._rMarginMarker.style.width = (this.options.DraggableConvertRatio*rMargin) + 'px';
		this._lMarginDrag.style.width = (this.options.DraggableConvertRatio*lMargin) + 'px';
		this._rMarginDrag.style.width = (this.options.DraggableConvertRatio*rMargin) + 'px';

		// Put the _rTSContainer in the right place
		this._rTSContainer.style.left = (this.options.DraggableConvertRatio * lMargin) + 'px';
		this._rTSContainer.style.right = (this.options.DraggableConvertRatio * rMargin) + 'px';

		this._updateParagraphIndentations();

		if (this.options.interactive) {
			this._changeInteractions({perm:'edit'});
		}
		else {
			this._changeInteractions({perm:'readonly'});
		}
	},

	_fixOffset: function() {
		if (!this._map.options.docBounds)
			return;

		var scale = this._map.getZoomScale(this._map.getZoom(), 10);
		var mapPane = this._map._mapPane;
		var topLeft = this._map.latLngToLayerPoint(this._map.options.docBounds.getNorthWest());
		var firstTileXTranslate = topLeft.y;

		var mapPaneYTranslate = 0;
		var computedStyle = window.getComputedStyle(mapPane);
		var transformValue = computedStyle.getPropertyValue('transform');
		var transformMatrix = new DOMMatrixReadOnly(transformValue);

		// Get the translateY values
		mapPaneYTranslate = transformMatrix.f;

		// we need to also consider  if there is more then 1 page then pageoffset is crucial to consider
		// i have calculated current page using pageoffset and pageWidth coming from CORE
		// based on that calculate the page offset
		// so if cursor moves to other page we will see how many pages before current page are there
		// and then add totalHeight of all those pages to our final calculation of rulerOffset
		var currentPage = Math.floor(this.options.pageOffset/this.options.pageWidth);
		var pageoffset = 0;
		if (this._map._docLayer._docPixelSize)
			pageoffset = currentPage * (this._map._docLayer._docPixelSize.y / this._map._docLayer._pages);

		var rulerOffset = mapPaneYTranslate + firstTileXTranslate + pageoffset + (this.options.tileMargin * scale);

		this._rFace.style.marginInlineStart = rulerOffset + 'px';

		this.rulerOffset = rulerOffset; // Needed on different parts too..
		this._updateParagraphIndentations();
	},

	_moveIndentation: function(e) {
		if (e.type === 'panmove') {
			e.clientX = e.center.x;
		}

		var element = document.getElementById(this._indentationElementId);
		// for horizontal Ruler we need to also consider height of navigation and toolbar-wrraper 
		var documentTop = document.getElementById('document-container').getBoundingClientRect().top;

		// User is moving the cursor / their finger on the screen and we are moving the marker.
		var newLeft = parseInt(element.style.left.replace('px', '')) + e.clientY - this._lastposition - documentTop;
		element.style.left = String(newLeft) + 'px';
		this._lastposition = e.clientY - documentTop;
		// halfWidth..
		var halfWidth = (element.getBoundingClientRect().right - element.getBoundingClientRect().left) * 0.5;
		this._markerHorizontalLine.style.left = String(newLeft + halfWidth) + 'px';
	},

	_moveIndentationEnd: function(e) {
		this._map.rulerActive = false;

		if (e.type !== 'panend') {
			L.DomEvent.off(this._rFace, 'mousemove', this._moveIndentation, this);
			L.DomEvent.off(this._map, 'mouseup', this._moveIndentationEnd, this);
		}

		var unoObj = {}, indentType = '';

		// Calculation step..
		// The new coordinate of element subject to indentation is sent as a percentage of the page width..
		// We need to calculate the percentage. Left margin (nullOffset) is not being added to the indentation (on the core part)..
		// We can use TabStopContainer's position as the reference point, as they share the same reference point..
		var element = document.getElementById(this._indentationElementId);

		var leftValue;
		// The halfWidth of the shape..
		var halfWidth = (element.getBoundingClientRect().right - element.getBoundingClientRect().left) * 0.5;

		// We need the pageWidth in pixels, so we can not use "this.options.pageWidth" here, since that's in mm..
		var pageWidth = parseFloat(this._rFace.style.width.replace('px', ''));

		if (element.id === 'lo-fline-marker') {
			indentType = 'FirstLineIndent';
			// FirstLine indentation is always positioned according to the left indent..
			// We don't need to add halfWidth here..
			leftValue = (parseFloat(this._firstLineMarker.style.left.replace('px', '')) - parseFloat(this._pStartMarker.style.left.replace('px', '')));
		}
		else if (element.id === 'lo-pstart-marker') {
			indentType = 'LeftParaIndent';
			leftValue = element.getBoundingClientRect().left - this._rTSContainer.getBoundingClientRect().left + halfWidth;
		}
		else if (element.id === 'lo-pend-marker') {
			indentType = 'RightParaIndent';
			// Right marker is positioned from right, this is rightValue..
			leftValue = this._rTSContainer.getBoundingClientRect().right - element.getBoundingClientRect().right + halfWidth;
		}

		leftValue = leftValue / pageWidth; // Now it's a percentage..

		if (indentType !== '') {
			unoObj[indentType] = {};
			unoObj[indentType]['type'] = 'string';
			unoObj[indentType]['value'] = leftValue;
			app.socket.sendMessage('uno .uno:ParagraphChangeState ' + JSON.stringify(unoObj));
		}

		this._indentationElementId = '';
		this._markerHorizontalLine.style.display = 'none';
	},

	_initiateIndentationDrag: function(e) {
		if (window.ThisIsTheiOSApp && !this._map.isEditMode())
			return;

		this._map.rulerActive = true;

		this._indentationElementId = e.target.id.trim() === '' ? e.target.parentNode.id: e.target.id;

		if (e.type !== 'panstart') {
			L.DomEvent.on(this._rFace, 'mousemove', this._moveIndentation, this);
			L.DomEvent.on(this._map, 'mouseup', this._moveIndentationEnd, this);
		}
		else {
			e.clientX = e.center.x;
		}
		// for horizontal Ruler we need to also consider height of navigation and toolbar-wrraper 
		var documentTop = document.getElementById('document-container').getBoundingClientRect().top;

		this._initialposition = this._lastposition = e.clientY - documentTop;
		this._markerHorizontalLine.style.display = 'block';
		this._markerHorizontalLine.style.left = this._lastposition + 'px';
	},

});

L.control.vruler = function (options) {
	return new L.Control.VRuler(options);
};
