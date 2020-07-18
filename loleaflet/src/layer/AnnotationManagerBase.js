/* -*- js-indent-level: 8 -*- */
/*
 *  L.AnnotationManagerBase
 */

/* global L */

L.AnnotationManagerBase = L.Class.extend({
	initialize: function (map, options) {
		this._map = map;
		this._doclayer = this._map._docLayer;
		this._initializeSpecific(options);
	}
});
