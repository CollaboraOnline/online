/* -*- js-indent-level: 8 -*- */
/*
	This class is used as the notebookbar accessibility configuration provider for the current document type.
*/

/* global app */

/* eslint-disable-next-line */
var NotebookbarAccessibilityDefinitions = function() {
	this.cleanMenuName = function(id) {
		if (!id) {
			console.debug('No id found for Notebookbar Accesibility item');
			return id;
		}
		var separatorPos = id.indexOf(':');
		if (separatorPos === -1)
			return id;
		return id.substr(0, separatorPos);
	};

	this.getContentListRecursive = function(rawList, list, language) {
		if (Array.isArray(rawList)) {
			for (var i = 0; i < rawList.length; i++) {
				if (rawList[i].accessibility) {
					var combination = language && rawList[i].accessibility[language] ? rawList[i].accessibility[language]: rawList[i].accessibility.combination;
					var id = this.cleanMenuName(rawList[i].id);

					// menu button
					var arrow = document.querySelector('#' + id + ' .arrowbackground');
					if (arrow) {
						list.push({ id: id, focusBack: rawList[i].accessibility.focusBack, combination: combination });
						continue;
					}

					// regular uno button
					var element = document.getElementById(id + '-button');
					if (element) {
						list.push({ id: id + '-button', focusBack: rawList[i].accessibility.focusBack, combination: combination });
						continue
					}

					// other
					list.push({ id: id, focusBack: rawList[i].accessibility.focusBack, combination: combination });
				}
				else if (rawList[i].children && Array.isArray(rawList[i].children) && rawList[i].children.length > 0) {
					this.getContentListRecursive(rawList[i].children, list, language);
				}
			}
		}
		else if (rawList.children && Array.isArray(rawList.children) && rawList.children.length > 0) {
			this.getContentListRecursive(rawList.children, list, language);
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
				tabs[i].rawContentList = [];

				for (var j = 0; j < contextContainer.children.length; j++) {
					if (contextContainer.children[j].children[0].id === tabName + '-container') {
						tabs[i].rawContentList = contextContainer.children[j].children[0].children;
						break;
					}
				}
			}
		}

		var defs = {};
		var language = this.getLanguage();
		for (i = 0; i < tabs.length; i++) {
			if (tabs[i].accessibility && tabs[i].accessibility.focusBack !== undefined) {
				defs[tabs[i].id] = tabs[i];
				defs[tabs[i].id].focusBack = tabs[i].accessibility.focusBack;
				defs[tabs[i].id].combination = language && tabs[i].accessibility[language] ? tabs[i].accessibility[language]: tabs[i].accessibility.combination;
				defs[tabs[i].id].contentList = [];
				this.getContentListRecursive(defs[tabs[i].id].rawContentList, defs[tabs[i].id].contentList, language);
				delete defs[tabs[i].id].rawContentList;
			}
		}

		return defs;
	};

	this.getLanguage = function() {
		if (app.UI.language.fromURL && app.UI.language.fromURL !== '') {
			return app.UI.language.fromURL;
		}
		else
			return null; // Default.
	};

	this.checkIntegratorButtons = function(selectedDefinitions) {
		// The list of containers of the buttons which are added by integrations (via insertbutton post message etc).
		var containerList = ['save', 'userListHeader', 'shortcutstoolbox'];

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
		this.checkIntegratorButtons(selectedDefinitions);

		return selectedDefinitions;
	};
};
