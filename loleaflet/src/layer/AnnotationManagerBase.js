/* -*- js-indent-level: 8 -*- */
/*
 *  L.AnnotationManagerBase
 */

/* global L */

L.AnnotationManagerBase = L.Class.extend({
	initialize: function (map, options) {
		this._map = map;
		this._initializeSpecific(options);
	}
});
