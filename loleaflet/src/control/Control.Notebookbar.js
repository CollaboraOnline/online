/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Notebookbar
 */

/* global */
L.Control.Notebookbar = L.Control.extend({
	options: {
		docType: ''
	},

	onAdd: function (map) {
		this.map = map;
	},

});

L.control.notebookbar = function (options) {
	return new L.Control.Notebookbar(options);
};
