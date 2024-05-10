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

/* global app $ L _ Hammer */
L.Control.VRuler = L.Control.extend({
	options: {
		interactive: true,
		marginSet: false,
		displayNumber: true,
		tileMargin: 18, // No idea what this means and where it comes from
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
		isHorizontalRuler:true
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

		// pageWidth on the other hand *is* really in mm100.
		this.options.pageWidth = parseInt(obj['pageWidth']);

		// to be enabled only after adding support for other length units as well
		// this.options.unit = obj['unit'].trim();

		this._updateBreakPoints();
		var scale = this._map.getZoomScale(this._map.getZoom(), 10);
		if (this.options.isHorizontalRuler) {
			this._rWrapper.style.visibility = '';
			this._rWrapper.style.transform = 'rotate(90deg)';
			var position = document.documentElement.dir === 'rtl' ? 'top right' : 'top left';
			this._rWrapper.style.transformOrigin = position;
			this._rWrapper.style.left = this.options.tileMargin * scale + 'px';
		}
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

		var tileContainer = mapPane.getElementsByClassName('leaflet-tile-container');
		for (var i = 0; i < tileContainer.length; ++i) {
			if (parseInt(tileContainer[i].style.zIndex) === this._map.getMaxZoom()) {
				tileContainer = tileContainer[i];
				break;
			}
		}
		var tileContainerXTranslate = 0;
		if (tileContainer.style !== undefined)
			tileContainerXTranslate = parseInt(tileContainer.style.transform.match(/\(([-0-9]*)/)[1]);

		var mapPaneYTranslate = 0;
		var computedStyle = window.getComputedStyle(mapPane);
		var transformValue = computedStyle.getPropertyValue('transform');
		var transformMatrix = new DOMMatrixReadOnly(transformValue);

		// Get the ranslateY values
		mapPaneYTranslate = transformMatrix.f;

		var rulerOffset = mapPaneYTranslate + firstTileXTranslate + tileContainerXTranslate + (this.options.tileMargin * scale);

		this._rFace.style.marginInlineStart = rulerOffset + 'px';

		this.rulerOffset = rulerOffset; // Needed on different parts too..
	},

});

L.control.vruler = function (options) {
	return new L.Control.VRuler(options);
};
