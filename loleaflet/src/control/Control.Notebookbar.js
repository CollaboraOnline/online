/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Notebookbar
 */

/* global $ */
L.Control.Notebookbar = L.Control.extend({
	options: {
		docType: ''
	},

	onAdd: function (map) {
		this.map = map;

		var homeTab = JSON.parse(this.getHomeTab());
		var builder = new L.control.notebookbarBuilder({mobileWizard: this, map: this.map, cssClass: 'notebookbar'});
		builder.build($('#toolbar-wrapper').get(0), [homeTab]);
	},

	setTabs: function(tabs) {
		$('nav').prepend(tabs);
	},

	getHomeTab: function() {
		return '';
	}

});

L.control.notebookbar = function (options) {
	return new L.Control.Notebookbar(options);
};
