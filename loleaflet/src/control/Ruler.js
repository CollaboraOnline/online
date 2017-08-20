/*
 * Ruler Handler
 */

/* global $ L */
L.Control.Ruler = L.Control.extend({
	options: {
		interactive: true,
		marginSet: false,
		margin1: null,
		margin2: null,
		nullOffset: null,
		pageOffset: null,
		pageWidth: null,
		unit: null,
		convertRatioDrag: null
	},

	onAdd: function(map) {
		map.on('rulerupdate', this._updateOptions, this);
		map.on('docsize', this._updateBreakPoints, this);

		return this._initLayout();
	},

	_initLayout: function() {
		this._rWrapper = L.DomUtil.create('div', 'loleaflet-ruler leaflet-bar leaflet-control leaflet-control-custom');
		this._rFace = L.DomUtil.create('div', 'loleaflet-ruler-face', this._rWrapper);
		this._rMarginWrapper = L.DomUtil.create('div', 'loleaflet-ruler-marginwrapper', this._rFace);
		// BP => Break Points
		this._rBPWrapper = L.DomUtil.create('div', 'loleaflet-ruler-breakwrapper', this._rFace);
		this._rBPContainer = L.DomUtil.create('div', 'loleaflet-ruler-breakcontainer', this._rBPWrapper);

		return this._rWrapper;
	},

	_updateOptions: function(obj) {
		this.options.margin1 = parseInt(obj['margin1']);
		this.options.margin2 = parseInt(obj['margin2']);
		this.options.nullOffset = parseInt(obj['leftOffset']);
		this.options.pageWidth = parseInt(obj['pageWidth']);
		// to be enabled only after adding support for other length units as well
		// this.options.unit = obj['unit'].trim();

		this._updateBreakPoints();
	},

	_updateBreakPoints: function() {

		if (this.options.margin1 == null || this.options.margin2 == null)
			return;

		var classMajorSep = 'loleaflet-ruler-maj',
		classMargin = 'loleaflet-ruler-margin',
		classDraggable = 'loleaflet-ruler-drag',
		rightComp = 'loleaflet-ruler-right',
		leftComp = 'loleaflet-ruler-left',
		lToolTip = 'loleaflet-ruler-ltooltip',
		rToolTip = 'loleaflet-ruler-rtooltip',
		leftMarginStr = _('Left Margin'),
		rightMarginStr = _('Right Margin'),
		convertRatioDrag, lMargin, rMargin, wPixel, hPixel;

		lMargin = this.options.nullOffset;
		rMargin = this.options.pageWidth - (this.options.nullOffset + this.options.margin2);

		// Multiplication with this facor is temporary,
		// I think, we need to find the margin in the left tiles
		// and subtract here accordingly
		wPixel = .958*this._map._docLayer._docPixelSize.x;
		hPixel = this._map._docLayer._docPixelSize.y;

		convertRatioDrag = this.options.convertRatioDrag = wPixel / this.options.pageWidth;

		this._rFace.style.width = wPixel + 'px';
		this._rFace.style.backgroundColor = 'white';
		this._rBPContainer.style.marginLeft = (-1 * (convertRatioDrag *(1000 - (this.options.nullOffset % 1000))) + 1) + 'px';

		$('.' + classMajorSep).remove();
		for (var num = 0; num <= (this.options.pageWidth / 1000) + 1; num++) {

			var marker = L.DomUtil.create('div', classMajorSep, this._rBPContainer);
			marker.style.width = convertRatioDrag*1000 - 2 + 'px';

		}

		if (!this.options.marginSet) {

			this.options.marginSet = true;

			this._lMarginMarker = L.DomUtil.create('div', classMargin + ' ' + leftComp, this._rFace);
			this._rMarginMarker =  L.DomUtil.create('div', classMargin + ' ' + rightComp, this._rFace);

			if (this.options.interactive) {
				this._lMarginDrag = L.DomUtil.create('div', classDraggable + ' ' + leftComp, this._rMarginWrapper);
				this._lToolTip = L.DomUtil.create('div', lToolTip, this._lMarginDrag)
				this._rMarginDrag = L.DomUtil.create('div', classDraggable + ' ' + rightComp, this._rMarginWrapper);
				this._rToolTip = L.DomUtil.create('div', rToolTip, this._rMarginDrag)
				this._lMarginDrag.style.cursor = 'e-resize';
				this._rMarginDrag.style.cursor = 'w-resize';
				this._lMarginDrag.title = leftMarginStr;
				this._rMarginDrag.title = rightMarginStr;
			}
		}

		this._lMarginMarker.style.width = (convertRatioDrag*lMargin) + 'px';
		this._rMarginMarker.style.width = (convertRatioDrag*rMargin) + 'px';

		if (this.options.interactive) {
			this._lMarginDrag.style.width = (convertRatioDrag*lMargin) + 'px';
			this._rMarginDrag.style.width = (convertRatioDrag*rMargin) + 'px';
		}

		L.DomEvent.on(this._rMarginDrag, 'mousedown', this._initiateDrag, this);
		L.DomEvent.on(this._lMarginDrag, 'mousedown', this._initiateDrag, this);
	},

	_initiateDrag: function(e) {

		var dragableElem = e.srcElement || e.target;
		L.DomEvent.on(this._rFace, 'mousemove', this._moveMargin, this);
		L.DomEvent.on(this._map, 'mouseup', this._endDrag, this);
		this._initialposition = e.clientX;

		if (L.DomUtil.hasClass(dragableElem, 'loleaflet-ruler-right')) {
			L.DomUtil.addClass(this._rMarginDrag, 'leaflet-drag-moving');
			this._rFace.style.cursor = 'w-resize';
		}
		else {
			L.DomUtil.addClass(this._lMarginDrag, 'leaflet-drag-moving');
			this._rFace.style.cursor = 'e-resize';
		}
	},

	_moveMargin: function(e) {
		var posChange = e.clientX - this._initialposition;
		var unit = this.options.unit ? this.options.unit : ' cm';
		if (L.DomUtil.hasClass(this._rMarginDrag, 'leaflet-drag-moving')) {
			var rMargin = this.options.pageWidth - (this.options.nullOffset + this.options.margin2);
			var newPos = this.options.convertRatioDrag*rMargin - posChange;
			this._rToolTip.style.display = 'block';
			this._rToolTip.style.right = newPos - 25 + 'px';
			this._rToolTip.innerText = (Math.round(this.options.pageWidth / 100 - newPos / (this.options.convertRatioDrag * 100)) / 10).toString() + unit;
			this._rMarginDrag.style.width = newPos + 'px';
		}
		else {
			var newPos = this.options.convertRatioDrag*this.options.nullOffset + posChange;
			this._lToolTip.style.display = 'block';
			this._lToolTip.style.left = newPos - 25 + 'px';
			this._lToolTip.innerText = (Math.round(newPos / (this.options.convertRatioDrag * 100)) / 10).toString() + unit;
			this._lMarginDrag.style.width = newPos + 'px';
		}
	},


	_endDrag: function(e) {
		var posChange = e.originalEvent.clientX - this._initialposition;
		var unoObj = {}, marginType, fact;

		L.DomEvent.off(this._rFace, 'mousemove', this._moveMargin, this);
		L.DomEvent.off(this._map, 'mouseup', this._endDrag, this);

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
		unoObj[marginType]['value'] = fact * posChange/(this.options.convertRatioDrag * this.options.pageWidth);
		this._map._socket.sendMessage('uno .uno:RulerChangeState ' + JSON.stringify(unoObj));
	}
});


L.control.ruler = function (options) {
	return new L.Control.Ruler(options);
};