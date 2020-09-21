/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarCalc
 */

/* global */
L.Control.NotebookbarCalc = L.Control.NotebookbarWriter.extend({

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
				'name': 'HomeLabel',
				'context': 'default|Cell'
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

L.control.notebookbarCalc = function (options) {
	return new L.Control.NotebookbarCalc(options);
};
