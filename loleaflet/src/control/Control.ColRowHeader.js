/*
 * L.Control.ColRowHeader
 * 
 * Provides common methods for the column and row headers.
 */

L.Control.ColRowHeader = L.Control.extend({

	LOButtons: {
		left: 1,
		middle: 2,
		right: 4
	},

	JSButtons: {
		left: 0,
		middle: 1,
		right: 2
	},

	_initializeColRowBar: function(type) {
	    this._type = type;
	    L.DomEvent.on(this._table, 'mousedown', this._onMouseEvent, this);
	    L.DomEvent.on(this._table, 'mouseup', this._onMouseEvent, this);
	},
	
	// Avoid sending mouse move events when we don't have a button down (they are just
	// ignored client side).
	_enableMouseMove: function(enable) {
	    if (enable === false) {
	        L.DomEvent.off(this._table, 'mousemove', this._onMouseEvent, this);
	    } else {
		L.DomEvent.on(this._table, 'mousemove', this._onMouseEvent, this);
	    }
	},

	_onMouseEvent: function(e) {
	    var docLayer = this._map._docLayer;
	    if (!docLayer) {
		return;
	    }

	    var mousePos = docLayer._latLngToTwips(this._map.containerPointToLatLng(this._map.mouseEventToContainerPoint(e)));
	    var modifier = this._map.keyboard.modifier;
	    if (e.type === 'mousemove') {
	        docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, this._cachedButtons, modifier, this._type);
	        return;
	    }

	    var buttons = 0;
	    buttons |= e.button === this.JSButtons.left ? this.LOButtons.left : 0;
	    buttons |= e.button === this.JSButtons.middle ? this.LOButtons.middle : 0;
	    buttons |= e.button === this.JSButtons.right ? this.LOButtons.right : 0;

	    if (e.type === 'mousedown') {
	        this._enableMouseMove(true);
	        this._cachedButtons = buttons;
	        docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, buttons, modifier, this._type);
	    } else if (e.type === 'mouseup') {
	        this._enableMouseMove(false);
	        docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, buttons, modifier, this._type);
	    }
	},

});

L.colrowheader = function (options) {
	return new L.ColRowHeader(options);
};