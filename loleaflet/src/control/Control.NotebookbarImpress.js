/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarImpress
 */

/* global */
L.Control.NotebookbarImpress = L.Control.NotebookbarWriter.extend({

	selectedTab: function(tabText) {
		switch (tabText) {
		case 'HomeLabel':
			this.loadTab(this.getHomeTab());
			break;

		case 'InsertLabel':
			this.loadTab(this.getInsertTab());
			break;

		case 'ReviewLabel':
			this.loadTab(this.getReviewTab());
			break;
		}
	},
	
	getTabs: function() {
		return [
			{
				'text': '~Home',
				'id': '2',
				'name': 'HomeLabel'
			},
			{
				'text': '~Insert',
				'id': '3',
				'name': 'InsertLabel'
			},
			{
				'text': '~Review',
				'id': '6',
				'name': 'ReviewLabel'
			}
		];
	},

	getHomeTab: function() {
		return {};
	},

	getInsertTab: function() {
		return {};
	},

	getReviewTab: function() {
		return {};
	}
});

L.control.notebookbarImpress = function (options) {
	return new L.Control.NotebookbarImpress(options);
};
