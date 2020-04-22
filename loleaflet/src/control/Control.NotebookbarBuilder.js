/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarBuilder
 */

/* global */
L.Control.NotebookbarBuilder = L.Control.JSDialogBuilder.extend({

	onAdd: function (map) {
		this.map = map;
	},

});

L.control.notebookbarBuilder = function (options) {
	return new L.Control.NotebookbarBuilder(options);
};
