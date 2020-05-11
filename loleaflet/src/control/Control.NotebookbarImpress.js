/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarImpress
 */

/* global */
L.Control.NotebookbarImpress = L.Control.NotebookbarWriter.extend({

	getShortcutsBarData: function() {
		return [
			{
				'id': 'shortcutstoolbox',
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': 'Save',
						'command': '.uno:Save'
					},
					{
						'type': 'toolitem',
						'text': 'Start Presentation',
						'command': '.uno:Presentation'
					},
					{
						'type': 'toolitem',
						'text': 'Undo',
						'command': '.uno:Undo'
					},
					{
						'type': 'toolitem',
						'text': 'Redo',
						'command': '.uno:Redo'
					}
				]
			}
		];
	},

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

		case 'TableLabel':
			this.loadTab(this.getTableTab());
			break;
		}
	},
	
	getTabs: function() {
		return [
			{
				'text': '~Home',
				'id': '2',
				'name': 'HomeLabel',
				'context': 'default|DrawText'
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
			},
			{
				'text': '~Table',
				'id': '8',
				'name': 'TableLabel',
				'context': 'Table'
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
	},

	getTableTab: function() {
		return {};
	}
});

L.control.notebookbarImpress = function (options) {
	return new L.Control.NotebookbarImpress(options);
};
