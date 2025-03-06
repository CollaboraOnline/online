/* -*- js-indent-level: 8 -*- */
/* global app */
/*
 * L.Evented is a base class that Leaflet classes inherit from to handle custom events.
 */

L.Evented = L.Class.extend({

	initialize: function () {
		// pass in the L.Evented instance as the 'outerObject'.
		this._evented = new app.Evented(this);
	},

	on: function (types, fn, context) {
		this._evented.on(types, fn, context);
		return this;
	},

	off: function (types, fn, context) {
		this._evented.off(types, fn, context);
		return this;
	},

	fire: function (type, data, propagate) {
		this._evented.fire(type, data, propagate);
		return this;
	},

	listens: function (type, propagate) {
		return this._evented.listens(type, propagate);
	},

	once: function (types, fn, context) {
		this._evented.once(types, fn, context);
		return this;
	},

	_getTypedInner: function () {
		return this._evented;
	},

	// adds a parent to propagate events to (when you fire with true as a 3rd argument)
	addEventParent: function (obj) {
		var inner = obj._getTypedInner ? obj._getTypedInner() : obj;
		this._evented.addEventParent(inner);
		return this;
	},

	removeEventParent: function (obj) {
		var inner = obj._getTypedInner ? obj._getTypedInner() : obj;
		this._evented.removeEventParent(inner);
		return this;
	},

});

var proto = L.Evented.prototype;

// aliases; we should ditch those eventually
proto.addEventListener = proto.on;
proto.removeEventListener = proto.clearAllEventListeners = proto.off;
proto.addOneTimeEventListener = proto.once;
proto.fireEvent = proto.fire;
proto.hasEventListeners = proto.listens;

L.Mixin = {Events: proto};
