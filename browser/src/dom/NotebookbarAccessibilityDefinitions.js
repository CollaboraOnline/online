/* -*- js-indent-level: 8 -*- */
/*
	This class is used as the notebookbar accessibility configuration provider for the current document type.
*/

/* global app */

/* eslint-disable-next-line */
var NotebookbarAccessibilityDefinitions = function() {

	this.getContentListRecursive = function(rawList, list) {
		if (Array.isArray(rawList)) {
			for (var i = 0; i < rawList.length; i++) {
				if (rawList[i].accessibility) {
					var element = document.getElementById(rawList[i].id + '-button');
					if (element) {
						list.push({ id: rawList[i].id + '-button', focusBack: rawList[i].accessibility.focusBack, combination: rawList[i].accessibility.combination });
					}
					else {
						list.push({ id: rawList[i].id, focusBack: rawList[i].accessibility.focusBack, combination: rawList[i].accessibility.combination });
					}
				}
				else if (rawList[i].children && Array.isArray(rawList[i].children) && rawList[i].children.length > 0) {
					this.getContentListRecursive(rawList[i].children, list);
				}
			}
		}
		else if (rawList.children && Array.isArray(rawList.children) && rawList.children.length > 0) {
			this.getContentListRecursive(rawList.children, list);
		}
		else
			return;
	};

	this.getTabsAndContents = function() {
		var tabs = app.map.uiManager.notebookbar.getTabs();
		var rawDefinitions = app.map.uiManager.notebookbar.getFullJSON();
		var contextContainer = null;

		while (rawDefinitions.children && Array.isArray(rawDefinitions.children) && rawDefinitions.children[0] && contextContainer === null) {
			if (rawDefinitions.children[0].id === 'ContextContainer')
				contextContainer = rawDefinitions.children[0]; // We get the tab pages array here.
			else
				rawDefinitions = rawDefinitions.children[0];
		}

		if (!contextContainer || !Array.isArray(tabs))
			return;
		else {
			for (var i = 0; i < tabs.length; i++) {
				var tabName = tabs[i].id.split('-')[0];

				for (var j = 0; j < contextContainer.children.length; j++) {
					if (contextContainer.children[j].children[0].id === tabName + '-container') {
						tabs[i].rawContentList = contextContainer.children[j].children[0].children;
						break;
					}
				}
			}
		}

		var defs = {};
		for (i = 0; i < tabs.length; i++) {
			if (tabs[i].accessibility && tabs[i].accessibility.focusBack) {
				defs[tabs[i].id] = tabs[i];
				defs[tabs[i].id].focusBack = tabs[i].accessibility.focusBack;
				defs[tabs[i].id].combination = tabs[i].accessibility.combination;
				defs[tabs[i].id].contentList = [];
				this.getContentListRecursive(defs[tabs[i].id].rawContentList, defs[tabs[i].id].contentList);
			}
		}

		return defs;
	};

	this.applyLanguageSpecificCombinations = function(selectedDefinitions) {
		if (!selectedDefinitions)
			return;

		// Browser language is not reflected to UI so we only check URL's language parameter.
		if (app.UI.language.fromURL && app.UI.language.fromURL !== '') {
			var lang = app.UI.language.fromURL;

			Object.keys(selectedDefinitions).forEach(function(ID) {
				if (selectedDefinitions[ID][lang])
					selectedDefinitions[ID].combination = selectedDefinitions[ID][lang];

				for (var i = 0; i < selectedDefinitions[ID].contentList.length; i++) {
					if (selectedDefinitions[ID].contentList[i][lang])
						selectedDefinitions[ID].contentList[i].combination = selectedDefinitions[ID].contentList[i][lang];
				}
			});
		}
	};

	this.checkIntegratorButtons = function(selectedDefinitions) {
		// The list of containers of the buttons which are added by integrations (via insertbutton post message etc).
		var containerList = ['shortcutstoolbox'];

		for (var i = 0; i < containerList.length; i++) {
			var container = document.getElementById(containerList[i]);

			if (container) {
				// All the buttons inside the container.
				var buttonList = container.querySelectorAll('button');

				if (buttonList.length) {
					for (var j = 0; j < buttonList.length; j++) {
						var button = buttonList[j];
						if (button.accessKey && button.id) {
							if (selectedDefinitions[button.id] === undefined) {
								selectedDefinitions[button.id] = {
									focusBack: true,
									combination: button.accessKey,
									contentList: []
								};
							}
						}
					}
				}
			}
		}
	};

	this.getDefinitions = function() {
		var selectedDefinitions = this.getTabsAndContents();

		this.applyLanguageSpecificCombinations(selectedDefinitions);
		this.checkIntegratorButtons(selectedDefinitions);

		return selectedDefinitions;
	};
};
