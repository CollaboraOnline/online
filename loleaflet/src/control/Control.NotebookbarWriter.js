/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarWriter
 */

/* global */
L.Control.NotebookbarWriter = L.Control.Notebookbar.extend({

	selectedTab: function(tabText) {
		switch (tabText) {
		case 'HomeLabel':
			this.loadTab(this.getHomeTab());
			break;

		case 'InsertLabel':
			this.loadTab(this.getInsertTab());
			break;

		case 'LayoutLabel':
			this.loadTab(this.getLayoutTab());
			break;
		
		case 'ReferencesLabel':
			this.loadTab(this.getReferencesTab());
			break;

		case 'TableLabel':
			this.loadTab(this.getTableTab());
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
				'text': '~Layout',
				'id': '4',
				'name': 'LayoutLabel'
			},
			{
				'text': 'Reference~s',
				'id': '5',
				'name': 'ReferencesLabel'
			},
			{
				'text': '~Review',
				'id': '6',
				'name': 'ReviewLabel'
			},
			{
				'text': '~Table',
				'id': '8',
				'name': 'TableLabel'
			}
		];
	},

	getHomeTab: function() {
		return '';
	},

	getInsertTab: function() {
		return '';
	},

	getLayoutTab: function() {
		return '';
	},

	getReferencesTab: function() {
		return '';
	},

	getTableTab: function() {
		return '';
	},

	getReviewTab: function() {
		return '';
	}
});

L.control.notebookbarWriter = function (options) {
	return new L.Control.NotebookbarWriter(options);
};
