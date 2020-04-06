/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Ruler Handler
 */

/* global $ L _ */
L.Control.Ruler = L.Control.extend({
	options: {
		interactive: true,
		marginSet: false,
		displayNumber: true,
		tileMargin: 18, // No idea what this means and where it comes from
		extraSize: 0,
		margin1: null,
		margin2: null,
		nullOffset: null,
		pageOffset: null,
		pageWidth: null,
		tabs: [],
		unit: null,
		DraggableConvertRatio: null,
		timer: null
	},

	onAdd: function(map) {
		map.on('rulerupdate', this._updateOptions, this);
		map.on('docsize', this._updatePaintTimer, this);
		map.on('scrolloffset resize', this._fixOffset, this);
		map.on('updatepermission', this._changeInteractions, this);
		$('#map').addClass('hasruler');
		this._map = map;

		return this._initLayout();
	},

	_updatePaintTimer: function(e) {
		if (e.extraSize)
			this.options.extraSize = e.extraSize.x;
		clearTimeout(this.options.timer);
		this.options.timer = setTimeout(L.bind(this._updateBreakPoints, this), 300);
	},

	_changeInteractions: function(e) {
		if (this._lMarginDrag) {
			if (e.perm === 'edit') {
				this._lMarginDrag.style.cursor = 'e-resize';
				this._rMarginDrag.style.cursor = 'w-resize';

				if (!window.ThisIsTheiOSApp) {
					L.DomEvent.on(this._rMarginDrag, 'mousedown', this._initiateDrag, this);
					L.DomEvent.on(this._lMarginDrag, 'mousedown', this._initiateDrag, this);
				}
			}
			else {
				this._lMarginDrag.style.cursor = 'default';
				this._rMarginDrag.style.cursor = 'default';

				if (!window.ThisIsTheiOSApp) {
					L.DomEvent.off(this._rMarginDrag, 'mousedown', this._initiateDrag, this);
					L.DomEvent.off(this._lMarginDrag, 'mousedown', this._initiateDrag, this);
				}
			}
		}
	},

	_initLayout: function() {
		this._rWrapper = L.DomUtil.create('div', 'loleaflet-ruler leaflet-bar leaflet-control leaflet-control-custom');
		this._rFace = L.DomUtil.create('div', 'loleaflet-ruler-face', this._rWrapper);
		this._rMarginWrapper = L.DomUtil.create('div', 'loleaflet-ruler-marginwrapper', this._rFace);
		// BP => Break Points
		this._rBPWrapper = L.DomUtil.create('div', 'loleaflet-ruler-breakwrapper', this._rFace);
		this._rBPContainer = L.DomUtil.create('div', 'loleaflet-ruler-breakcontainer', this._rBPWrapper);

		// Tab stops
		this._rTSContainer = L.DomUtil.create('div', 'loleaflet-ruler-tabstopcontainer', this._rMarginWrapper);
		if (window.ThisIsTheiOSApp)
			L.DomEvent.on(this._rTSContainer, 'touchstart', this._initiateTabstopDrag, this);
		else
			L.DomEvent.on(this._rTSContainer, 'mousedown', this._initiateTabstopDrag, this);


		return this._rWrapper;
	},

	_updateOptions: function(obj) {
		// console.log('===> _updateOptions');
		// Note that the values for margin1, margin2, and leftOffset are not in any sane
		// units. See the comment in SwCommentRuler::CreateJsonNotification(). The values
		// are pixels for some virtual device in core, not related to the actual device this
		// is running on at all, passed through convertTwipToMm100(), i.e. multiplied by
		// approximately 1.76. Let's call these units "arbitrary pixelish units" in
		// comments here.
		this.options.margin1 = parseInt(obj['margin1']);
		this.options.margin2 = parseInt(obj['margin2']);
		this.options.nullOffset = parseInt(obj['leftOffset']);

		// pageWidth on the other hand *is* really in mm100.
		this.options.pageWidth = parseInt(obj['pageWidth']);
		this.options.tabs = [];
		// As are the position values of the elements in the tabs array.
		for (var i in obj['tabs']) {
			this.options.tabs[i] = { position: parseInt(obj['tabs'][i].position), style: parseInt(obj['tabs'][i].style) };
		}
		// to be enabled only after adding support for other length units as well
		// this.options.unit = obj['unit'].trim();

		this._updateBreakPoints();
	},

	_updateBreakPoints: function() {

		if (this.options.margin1 == null || this.options.margin2 == null)
			return;

		if (this._map._docLayer._annotations._items.length === 0
		|| this._map._docLayer._annotations._items.length
		=== this._map._docLayer._annotations._hiddenItems
		|| !this.options.marginSet)
			this.options.extraSize = 0;

		var lMargin, rMargin, wPixel, scale;

		lMargin = this.options.nullOffset;

		// This is surely bogus. We take pageWidth, which is in mm100, and subtract a value
		// that is in "arbitrary pixelish units". But the only thing rMargin is used for is
		// to calculate the width of the part of the ruler that goes out over the right side
		// of the window anyway (see the assignments to this._rMarginMarker.style.width and
		// this._rMarginDrag.style.width near the end of this function), so presumably it
		// doesn't matter that much what rMargin is.
		rMargin = this.options.pageWidth - (this.options.nullOffset + this.options.margin2);

		scale = this._map.getZoomScale(this._map.getZoom(), 10);
		wPixel = this._map._docLayer._docPixelSize.x - (this.options.extraSize + this.options.tileMargin * 2) * scale;

		this._fixOffset();

		this.options.DraggableConvertRatio = wPixel / this.options.pageWidth;
		this._rFace.style.width = wPixel + 'px';
		this._rBPContainer.style.marginLeft = (-1 * (this.options.DraggableConvertRatio * (500 - (lMargin % 1000))) + 1) + 'px';

		var numCounter = -1 * parseInt(lMargin / 1000);

		$('.loleaflet-ruler-maj').remove();

		// this.options.pageWidth is in mm100, so the code here makes one ruler division per
		// centimetre.
		//
		// FIXME: Surely this should be locale-specific, we would want to use inches at
		// least in the US. (The ruler unit to use doesn't seem to be stored in the document
		// at least for .odt?)
		for (var num = 0; num <= (this.options.pageWidth / 1000) + 1; num++) {

			var marker = L.DomUtil.create('div', 'loleaflet-ruler-maj', this._rBPContainer);

			// The - 1 is to compensate for the left and right .5px borders of
			// loleaflet-ruler-maj in leaflet.css.
			marker.style.width = this.options.DraggableConvertRatio*1000 - 1 + 'px';
			if (this.options.displayNumber) {
				if (numCounter !== 0)
					marker.innerText = Math.abs(numCounter++);
				else
					numCounter++;
			}
		}

		// The tabstops. Only draw user-created ones, with style RULER_TAB_LEFT,
		// RULER_TAB_RIGHT, RULER_TAB_CENTER, and RULER_TAB_DECIMAL. See <svtools/ruler.hxx>.

		$('.loleaflet-ruler-tabstop').remove();

		var pxPerMm100 = this._map._docLayer._docPixelSize.x / (this._map._docLayer._docWidthTwips * 2540/1440);
		var tabStopWidthAccum = 0;
		this._rTSContainer.tabStops = [];
		for (num = 0; num < this.options.tabs.length; num++) {
			if (this.options.tabs[num].style >= 4)
				break;
			marker = L.DomUtil.create('div', 'loleaflet-ruler-tabstop', this._rTSContainer);
			var thisWidth = this.options.tabs[num].position - tabStopWidthAccum;
			var tabstopBorder = getComputedStyle(marker, null).getPropertyValue('--loleaflet-ruler-tabstop-border');
			marker.style.marginLeft = (pxPerMm100 * thisWidth - tabstopBorder) + 'px';
			marker.tabStopNumber = num;
			marker.tabStopLocation = { left: pxPerMm100 * tabStopWidthAccum, right: pxPerMm100 * (tabStopWidthAccum + thisWidth) };
			this._rTSContainer.tabStops[num] = marker;
			tabStopWidthAccum += thisWidth;
		}

		if (!this.options.marginSet) {

			this.options.marginSet = true;

			this._lMarginMarker = L.DomUtil.create('div', 'loleaflet-ruler-margin loleaflet-ruler-left', this._rFace);
			this._rMarginMarker =  L.DomUtil.create('div', 'loleaflet-ruler-margin loleaflet-ruler-right', this._rFace);

			this._lMarginDrag = L.DomUtil.create('div', 'loleaflet-ruler-drag loleaflet-ruler-left', this._rMarginWrapper);
			this._lToolTip = L.DomUtil.create('div', 'loleaflet-ruler-ltooltip', this._lMarginDrag);
			this._rMarginDrag = L.DomUtil.create('div', 'loleaflet-ruler-drag loleaflet-ruler-right', this._rMarginWrapper);
			this._rToolTip = L.DomUtil.create('div', 'loleaflet-ruler-rtooltip', this._rMarginDrag);
			this._lMarginDrag.title = _('Left Margin');
			this._rMarginDrag.title = _('Right Margin');

			if (window.ThisIsTheiOSApp) {
				this.options.interactive = true;
				L.DomEvent.on(this._rMarginDrag, 'touchstart', this._initiateDrag, this);
				L.DomEvent.on(this._lMarginDrag, 'touchstart', this._initiateDrag, this);

			}
		}

		this._lMarginMarker.style.width = (this.options.DraggableConvertRatio*lMargin) + 'px';
		this._rMarginMarker.style.width = (this.options.DraggableConvertRatio*rMargin) + 'px';
		this._lMarginDrag.style.width = (this.options.DraggableConvertRatio*lMargin) + 'px';
		this._rMarginDrag.style.width = (this.options.DraggableConvertRatio*rMargin) + 'px';

		// Put the _rTSContainer in the right place
		this._rTSContainer.style.marginLeft = (this.options.DraggableConvertRatio * lMargin) + 'px';
		this._rTSContainer.style.width = 'calc(' + this._rFace.style.width + ' - ' + this._rMarginMarker.style.width + ')';

		if (this.options.interactive) {
			this._changeInteractions({perm:'edit'});
		}
		else {
			this._changeInteractions({perm:'readonly'});
		}
	},

	_fixOffset: function() {
		var scale = this._map.getZoomScale(this._map.getZoom(), 10);
		var mapPane = this._map._mapPane;

		/// The rulerOffset depends on the leftmost tile's position
		/// sometimes the leftmost tile is not available and we need to calculate
		/// from the tiles that we have already.
		var tiles = this._map._docLayer._tiles;
		var firstTileKey = Object.keys(tiles)[0];
		var columnNumber = parseInt(firstTileKey.match(/(\d*):/)[1]);
		var firstTile = tiles[firstTileKey].el;
		var firstTileXTranslate = parseInt(firstTile.style.left) - this._map._docLayer._tileWidthPx * columnNumber;

		var tileContainer = mapPane.getElementsByClassName('leaflet-tile-container');
		tileContainer = tileContainer[tileContainer.length - 1];
		var tileContainerXTranslate = parseInt(tileContainer.style.transform.match(/\(([-0-9]*)/)[1]);
		var mapPaneXTranslate = parseInt(mapPane.style.transform.match(/\(([-0-9]*)/)[1]);

		var rulerOffset = mapPaneXTranslate + firstTileXTranslate + tileContainerXTranslate + (this.options.tileMargin * scale);

		this._rFace.style.marginLeft = rulerOffset + 'px';
	},

	_initiateDrag: function(e) {
		if (e.type === 'touchstart') {
			if (e.touches.length !== 1)
				return;
			e.clientX = e.touches[0].clientX;
		}

		if (window.ThisIsTheiOSApp && this._map._permission !== 'edit')
			return;

		this._map.rulerActive = true;

		var dragableElem = e.srcElement || e.target;
		if (window.ThisIsTheiOSApp) {
			L.DomEvent.on(this._rFace, 'touchmove', this._moveMargin, this);
			L.DomEvent.on(this._rFace, 'touchend', this._endDrag, this);
		}
		else {
			L.DomEvent.on(this._rFace, 'mousemove', this._moveMargin, this);
			L.DomEvent.on(this._map, 'mouseup', this._endDrag, this);
		}
		this._initialposition = e.clientX;
		this._lastposition = this._initialposition;

		if (L.DomUtil.hasClass(dragableElem, 'loleaflet-ruler-right')) {
			L.DomUtil.addClass(this._rMarginDrag, 'leaflet-drag-moving');
			this._rFace.style.cursor = 'w-resize';
		}
		else {
			L.DomUtil.addClass(this._lMarginDrag, 'leaflet-drag-moving');
			this._rFace.style.cursor = 'e-resize';
		}
	},

	_initiateTabstopDrag: function(e) {
		// console.log('===> _initiateTabstopDrag');
		if (e.type === 'touchstart') {
			if (e.touches.length !== 1)
				return;
		}

		// Are there any tab stops?
		// e.currentTarget == this._rTSContainer, so yeah, we could use that, too.
		if (!e.currentTarget || e.currentTarget.tabStops.length === 0)
			return;

		// Check if "close enough" to one unambiguous tab stop
		var closestIndex = -1;
		var closestDistance = 1000000;
		var nextClosestDistance;
		for (var i = 0; i < e.currentTarget.tabStops.length; i++) {
			var distance = Math.abs(e.layerX - e.currentTarget.tabStops[i].tabStopLocation.right);
			if (distance < closestDistance) {
				nextClosestDistance = closestDistance;
				closestDistance = distance;
				closestIndex = i;
			}
		}
		if (nextClosestDistance - closestDistance <= 10) {
			// Nope, not clear which one it was closest to
			return;
		}

		e.currentTarget.tabStopBeingDragged = closestIndex;
		e.currentTarget.tabStopPrevPos = e.layerX;

		if (window.ThisIsTheiOSApp) {
			L.DomEvent.on(e.currentTarget, 'touchmove', this._moveTabstop, this);
			L.DomEvent.on(e.currentTarget, 'touchend', this._endTabstopDrag, this);
		}
		else {
			L.DomEvent.on(e.currentTarget, 'mousemove', this._moveTabstop, this);
			L.DomEvent.on(e.currentTarget, 'mouseup', this._endTabstopDrag, this);
		}
	},

	_moveMargin: function(e) {
		if (e.type === 'touchmove')
			e.clientX = e.touches[0].clientX;

		this._lastposition = e.clientX;
		var posChange = e.clientX - this._initialposition;
		var unit = this.options.unit ? this.options.unit : ' cm';
		if (L.DomUtil.hasClass(this._rMarginDrag, 'leaflet-drag-moving')) {
			var rMargin = this.options.pageWidth - (this.options.nullOffset + this.options.margin2);
			var newPos = this.options.DraggableConvertRatio*rMargin - posChange;
			this._rToolTip.style.display = 'block';
			this._rToolTip.style.right = newPos - 25 + 'px';
			this._rToolTip.innerText = (Math.round(this.options.pageWidth / 100 - newPos / (this.options.DraggableConvertRatio * 100)) / 10).toString() + unit;
			this._rMarginDrag.style.width = newPos + 'px';
		}
		else {
			newPos = this.options.DraggableConvertRatio*this.options.nullOffset + posChange;
			this._lToolTip.style.display = 'block';
			this._lToolTip.style.left = newPos - 25 + 'px';
			this._lToolTip.innerText = (Math.round(newPos / (this.options.DraggableConvertRatio * 100)) / 10).toString() + unit;
			this._lMarginDrag.style.width = newPos + 'px';
		}
	},

	_moveTabstop: function(e) {
		if (!e.currentTarget)
			return;

		var pixelDiff = e.layerX - e.currentTarget.tabStopPrevPos;
		var diff = this._map._docLayer._pixelsToTwips({x: pixelDiff, y:0}).x;
		if (diff === 0)
			return;

		// console.log('===> _moveTabstop ' + e.currentTarget.tabStopBeingDragged + ' pixels:' + pixelDiff + ', twips:' + diff);
		this._map.sendUnoCommand('.uno:MoveTabstop?Tabstop=' + e.currentTarget.tabStopBeingDragged + '&Amount=' + diff);
		e.currentTarget.tabStopPrevPos = e.layerX;
	},

	_endDrag: function(e) {
		this._map.rulerActive = false;

		var posChange;
		if (e.type === 'touchend')
			posChange = this._lastposition - this._initialposition;
		else
			posChange = e.originalEvent.clientX - this._initialposition;
		var unoObj = {}, marginType, fact;

		if (window.ThisIsTheiOSApp) {
			L.DomEvent.off(this._rFace, 'touchmove', this._moveMargin, this);
			L.DomEvent.off(this._rFace, 'touchend', this._endDrag, this);
		}
		else {
			L.DomEvent.off(this._rFace, 'mousemove', this._moveMargin, this);
			L.DomEvent.off(this._map, 'mouseup', this._endDrag, this);
		}
		if (L.DomUtil.hasClass(this._rMarginDrag, 'leaflet-drag-moving')) {
			marginType = 'Margin2';
			fact = -1;
			L.DomUtil.removeClass(this._rMarginDrag, 'leaflet-drag-moving');
			this._rToolTip.style.display = 'none';
		}
		else {
			marginType = 'Margin1';
			fact = 1;
			L.DomUtil.removeClass(this._lMarginDrag, 'leaflet-drag-moving');
			this._lToolTip.style.display = 'none';
		}

		this._rFace.style.cursor = 'default';

		unoObj[marginType] = {};
		unoObj[marginType]['type'] = 'string';
		unoObj[marginType]['value'] = fact * posChange/(this.options.DraggableConvertRatio * this.options.pageWidth);
		this._map._socket.sendMessage('uno .uno:RulerChangeState ' + JSON.stringify(unoObj));
	},

	_endTabstopDrag: function(e) {
		if (!e.currentTarget)
			return;

		// console.log('===> _endTabstopDrag ' + e.type);
		if (window.ThisIsTheiOSApp) {
			L.DomEvent.off(e.currentTarget, 'touchmove', this._moveTabstop, this);
			L.DomEvent.off(e.currentTarget, 'touchend', this._endTabstopDrag, this);
		}
		else {
			L.DomEvent.off(e.currentTarget, 'mousemove', this._moveTabstop, this);
			L.DomEvent.off(e.currentTarget, 'mouseup', this._endTabstopDrag, this);
		}
	},

});


L.control.ruler = function (options) {
	return new L.Control.Ruler(options);
};
