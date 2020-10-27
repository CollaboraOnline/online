/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.AutofilterDropdown
 */

/* global $ */
L.Control.AutofilterDropdown = L.Control.extend({
	container: null,

	onAdd: function (map) {
		this.map = map;

		this.map.on('autofilterdropdown', this.onAutofilterDropdown, this);
		this.map.on('closepopup', this.onClosePopup, this);
		this.map.on('closepopups', this.onClosePopup, this);
		L.DomEvent.on(this.map, 'mouseup', this.onClosePopup, this);
	},

	onRemove: function() {
		this.map.off('autofilterdropdown', this.onAutofilterDropdown, this);
		this.map.off('closepopup', this.onClosePopup, this);
		this.map.off('closepopups', this.onClosePopup, this);
		L.DomEvent.off(this.map, 'mouseup', this.onClosePopup, this);
	},

	onAutofilterDropdown: function(data) {
		if (this.container)
			L.DomUtil.remove(this.container);

		if (data.action === 'close')
			return;

		var scale = this._map.getZoomScale(this._map.getZoom(), this._map.options.defaultZoom);
		var origin = this._map.getPixelOrigin();
		var panePos = this._map._getMapPanePos();
		var cursorPos = this._map._docLayer.getCursorPos();

		var corePoint = new L.Point(parseInt(data.posx) - 35, parseInt(data.posy) - 75);
		var cssPoint = this._map._docLayer._corePixelsToCss ? this._map._docLayer._corePixelsToCss(corePoint) : corePoint;

		var left = cssPoint.x * scale;
		var top = cssPoint.y * scale;

		var splitPanesContext = this._map.getSplitPanesContext();
		var splitPos = new L.Point(0, 0);

		if (splitPanesContext)
			splitPos = splitPanesContext.getSplitPos();

		var newLeft = left + panePos.x - origin.x;
		if (left >= splitPos.x && newLeft >= 0)
			left = newLeft;

		var newTop = top + panePos.y - origin.y;
		if (top >= splitPos.y && newTop >= 0)
			top = newTop;

		// some documents with split panes have coordinates increased by split position...
		if (left >= $('.spreadsheet-header-columns').width()) {
			if (cursorPos.x >= splitPos.x && left >= splitPos.x)
				left = left - splitPos.x;

			if (cursorPos.y >= splitPos.y && top >= splitPos.y)
				top = top - splitPos.y;
		}

		this.container = L.DomUtil.create('div', 'autofilter-container', $('#document-container').get(0));

		L.DomUtil.setStyle(this.container, 'margin-left', left + 'px');
		L.DomUtil.setStyle(this.container, 'margin-top', top + 'px');

		var builder = new L.control.jsDialogBuilder({windowId: data.id, mobileWizard: this, map: this.map, cssClass: 'dockingwindow'});
		builder.build(this.container, [data]);
	},

	onClosePopup: function() {
		if (this.container)
			L.DomUtil.remove(this.container);

		// TODO: kill popup in the core
	}
});

L.control.autofilterDropdown = function (options) {
	return new L.Control.AutofilterDropdown(options);
};