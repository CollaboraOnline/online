/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * L.Control.Notebookbar - container for tabbed menu on the top of application
 */

/* global $ _ _UNO JSDialog app */
L.Control.Notebookbar = L.Control.extend({

	_currentScrollPosition: 0,
	_showNotebookbar: false,
	_RTL: false,
	_lastContext: null,

	container: null,
	builder: null,

	HOME_TAB_ID: 'Home-tab-label',

	additionalShortcutButtons: [],

	onAdd: function (map) {
		// log and test window.ThisIsTheiOSApp = true;
		this.map = map;
		this.additionalShortcutButtons = [];
		this._currentScrollPosition = 0;
		var docType = this._map.getDocType();

		if (document.documentElement.dir === 'rtl')
			this._RTL = true;

		this.builder = new L.control.notebookbarBuilder({windowId: -2, mobileWizard: this, map: map, cssClass: 'notebookbar', useSetTabs: true});
		this.map.on('commandstatechanged', this.builder.onCommandStateChanged, this.builder);

		// remove old toolbar
		var toolbar = L.DomUtil.get('toolbar-up');
		if (toolbar)
			toolbar.outerHTML = '';

		// create toolbar from template
		$('#toolbar-logo').after(this.map.toolbarUpTemplate.cloneNode(true));
		this.parentContainer = L.DomUtil.get('toolbar-up');

		this.loadTab(this.getFullJSON(this.HOME_TAB_ID));

		this.onContextChange = this.onContextChange.bind(this);
		app.events.on('contextchange', this.onContextChange);
		this.map.on('notebookbar', this.onNotebookbar, this);
		app.events.on('updatepermission', this.onUpdatePermission.bind(this));
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
		this.map.on('statusbarchanged', this.onStatusbarChange, this);
		this.map.on('rulerchanged', this.onRulerChange, this);
		this.map.on('darkmodechanged', this.onDarkModeToggleChange, this);
		this.map.on('showannotationschanged', this.onShowAnnotationsChange, this);
		this.map.on('a11ystatechanged', this.onAccessibilityToggleChange, this);
		if (docType === 'presentation') {
			this.map.on('updateparts', this.onSlideHideToggle, this);
			this.map.on('toggleslidehide', this.onSlideHideToggle, this);
		}

		this.initializeInCore();

		$('#toolbar-wrapper').addClass('hasnotebookbar');
		$('.main-nav').addClass('hasnotebookbar');
		this.floatingNavIcon = document.querySelector('.navigator-btn-wrapper');
		if (this.floatingNavIcon) 
			this.floatingNavIcon.classList.add('hasnotebookbar');
		document.getElementById('document-container').classList.add('notebookbar-active');

		var docLogoHeader = L.DomUtil.create('div', '');
		docLogoHeader.id = 'document-header';

		var iconClass = 'document-logo';
		if (docType === 'text') {
			iconClass += ' writer-icon-img';
		} else if (docType === 'spreadsheet') {
			iconClass += ' calc-icon-img';
		} else if (docType === 'presentation') {
			iconClass += ' impress-icon-img';
		} else if (docType === 'drawing') {
			iconClass += ' draw-icon-img';
		}
		var docLogo = L.DomUtil.create('div', iconClass, docLogoHeader);
		$(docLogo).data('id', 'document-logo');
		$(docLogo).data('type', 'action');
		$('.main-nav').prepend(docLogoHeader);
		var isDarkMode = window.prefs.getBoolean('darkTheme');
		if (!isDarkMode)
			$('#invertbackground').hide();

		var that = this;
		var retryNotebookbarInit = function() {
			if (!that.isInitializedInCore()) {
				// if notebookbar doesn't have any welded controls it can trigger false alarm here
				window.app.console.warn('notebookbar might be not initialized, retrying');
				that.initializeInCore();
				that.retry = setTimeout(retryNotebookbarInit, 3000);
			}
		};

		this.retry = setTimeout(retryNotebookbarInit, 3000);
	},

	onRemove: function() {
		clearTimeout(this.retry);
		this.resetInCore();
		this.map.off('commandstatechanged', this.builder.onCommandStateChanged, this.builder);
		this.map.off('notebookbar');
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
		app.events.off('contextchange', this.onContextChange);
		$('.main-nav #document-header').remove();
		$('.main-nav').removeClass('hasnotebookbar');
		$('#toolbar-wrapper').removeClass('hasnotebookbar');
		if (this.floatingNavIcon) 
			this.floatingNavIcon.classList.remove('hasnotebookbar');
		$('.main-nav #document-header').remove();
		this.clearNotebookbar();
	},

	isInitializedInCore: function() {
		return this._isNotebookbarLoadedOnCore;
	},

	initializeInCore: function() {
		this.map.sendUnoCommand('.uno:ToolbarMode?Mode:string=notebookbar_online.ui');
	},

	resetInCore: function() {
		this._isNotebookbarLoadedOnCore = false;
		this.map.sendUnoCommand('.uno:ToolbarMode?Mode:string=Default');
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype !== 'notebookbar')
			return;

		if (!this.container)
			return;

		if (!this.builder)
			return;

		this._isNotebookbarLoadedOnCore = true;

		this.builder.updateWidget(this.container, data.control);
	},

	onJSAction: function (e) {
		var data = e.data;

		if (data.jsontype !== 'notebookbar')
			return;

		if (!this.builder)
			return;

		if (!this.container)
			return;

		this._isNotebookbarLoadedOnCore = true;

		this.builder.executeAction(this.container, data.data);
	},

	onUpdatePermission: function(e) {
		if (e.detail.perm === 'edit') {
			this._showNotebookbar = true;
			this.showTabs();
			$('.main-nav').removeClass('readonly');
		} else {
			this.hideTabs();
		}
	},

	onNotebookbar: function(data) {
		this._isNotebookbarLoadedOnCore = true;
		// setup id for events
		this.builder.setWindowId(data.id);
	},

	showTabs: function() {
		$('.ui-tabs.notebookbar').show();
		$('.notebookbar-shortcuts-bar').show();
		this.extend();
		$(window).resize();
	},

	hideTabs: function() {
		$('.ui-tabs.notebookbar').hide();
		$('.notebookbar-shortcuts-bar').hide();
		$('.main-nav').addClass('readonly');
		this.collapse();
	},

	collapse: function() {
		if (this._showNotebookbar !== false) this.map.uiManager.collapseNotebookbar();
	},

	extend: function() {
		if (this._showNotebookbar !== false) this.map.uiManager.extendNotebookbar();
	},

	isCollapsed: function() {
		return this.map.uiManager.isNotebookbarCollapsed();
	},

	clearNotebookbar: function() {
		$('.root-container.notebookbar').remove();
		$('.notebookbar-tabs-container').remove();
		$('.notebookbar-shortcuts-bar').remove();
		$(this.container).remove();
	},

	loadTab: function(tabJSON) {
		this.clearNotebookbar();

		this.container = L.DomUtil.create('div', 'notebookbar-scroll-wrapper', this.parentContainer);

		JSDialog.MakeScrollable(this.parentContainer, this.container);

		this.builder.build(this.container, [tabJSON]);

		if (this._showNotebookbar === false)
			this.hideTabs();

		if (window.mode.isDesktop() || window.mode.isTablet())
			this.createOptionsSection();

		this.scrollToLastPositionIfNeeded();
	},

	setTabs: function(tabs) {
		var container = L.DomUtil.create('div', 'notebookbar-tabs-container');
		container.appendChild(tabs);
		for (let tab of tabs.children) {
			if (tab.id.endsWith('-tab-label')) {
				let name = tab.id.substring(0, tab.id.length - 10);
				if (!this.map.uiManager.isTabVisible(name)) {
					$(tab).hide();
				}
			}
		}
		$('#document-titlebar').before(container);
		this.createShortcutsBar();
	},

	selectedTab: function() {
		// implement in child classes
	},

	getTabs: function() {
		// implement in child classes
		return [];
	},

	getTabsJSON: function() {
		// implement in child classes
		return [];
	},

	getShortcutsBarData: function() {
		var hasSave = !this._map['wopi'].HideSaveOption;
		return [
			{
				'id': 'shortcutstoolbox',
				'type': 'toolbox',
				'children': [
					hasSave ? {
						'id': 'save',
						'type': 'toolitem',
						'text': _('Save'),
						'command': '.uno:Save',
						'accessKey': '1',
						'isCustomTooltip': true
					} : {}
				]
			}
		];
	},

	createShortcutsBar: function() {
		var shortcutsBar = L.DomUtil.create('div', 'notebookbar-shortcuts-bar');
		$('#main-menu-state').after(shortcutsBar);

		var shortcutsBarData = this.getShortcutsBarData();
		var toolitems = shortcutsBarData[0].children;

		for (var i in this.additionalShortcutButtons) {
			var item = this.additionalShortcutButtons[i];
			toolitems.push(item);
		}

		for (var j in toolitems) {
			item = toolitems[j];
			var hidden = false;
			var commands = this.map._extractCommand(item);
			commands.forEach(function(command) {
				if (!this.map.uiManager.isCommandVisible(command)) {
					toolitems.splice(j, 1);
					hidden = true;
				}
			}.bind(this));
			if (hidden) {
				break;
			}
			if (!this.map.uiManager.isButtonVisible(item.id)) {
				toolitems.splice(j, 1);
				break;
			}
		}

		this.builder.build(shortcutsBar, shortcutsBarData);

		//create SaveState object after addition of shortcut bar in UI
		this.map.saveState = new app.definitions.saveState(this.map);
	},

	reloadShortcutsBar: function() {
		$('.notebookbar-shortcuts-bar').remove();
		this.createShortcutsBar();
	},

	insertButtonToShortcuts: function(button) {
		for (var i in this.additionalShortcutButtons) {
			var item = this.additionalShortcutButtons[i];
			if (item.id === button.id)
				return;
		}

		var isUnoCommand = button.unoCommand && button.unoCommand.indexOf('.uno:') >= 0;
		if (button.unoCommand && !isUnoCommand)
			button.unoCommand = '.uno:' + button.unoCommand;

		this.additionalShortcutButtons.push(
			{
				id: button.id,
				type: 'toolitem',
				text: button.label ? button.label : (button.hint ? _(button.hint) : ' '),
				icon: button.imgurl,
				command: button.unoCommand,
				accessKey: button.accessKey ? button.accessKey: null,
				postmessage: button.unoCommand ? undefined : true,
				cssClass: 'integrator-shortcut'
			}
		);

		this.reloadShortcutsBar();
	},

	showNotebookbarButton: function(buttonId, show) {
		var button = $(this.container).find('#' + buttonId);
		if (button) {
			if (show) {
				button.show();
			} else {
				button.hide();
			}
			return true;
		} else {
			return false;
		}
	},

	showNotebookbarCommand: function(commandId, show) {
		var cssClass;
		if (commandId.indexOf('.uno:') == 0) {
			cssClass = 'uno' + commandId.substring(5);
		} else {
			cssClass = commandId;
		}
		var button = $(this.container).find('div.' + cssClass);
		if (button) {
			if (show) {
				button.show();
			} else {
				button.hide();
			}
			return true;
		}
		return false;
	},

	setCurrentScrollPosition: function() {
		this._currentScrollPosition = $(this.container).scrollLeft();
	},

	scrollToLastPositionIfNeeded: function() {
		var rootContainer = $(this.container).children('div').get(0);

		if (this._currentScrollPosition && $(rootContainer).outerWidth() > $(window).width()) {
			$(this.container).animate({ scrollLeft: this._currentScrollPosition }, 0);
		} else {
			JSDialog.RefreshScrollables();
		}
	},

	shouldIgnoreContextChange(contexts, appId) {
		// New -> old context name pairs.
		let ignored = [['NotesPage', 'DrawPage'], ['DrawPage', 'NotesPage']];
		if (appId === 'com.sun.star.text.TextDocument') {
			ignored.push(['Text', '']);
		}

		for (let i = 0; i < ignored.length; i++) {
			if (contexts[0] === ignored[i][0] && contexts[1] === ignored[i][1])
				return true;
		}

		return false;
	},

	refreshContextTabsVisibility: function() {
		this.updateTabsVisibilityForContext(this._lastContext);
	},

	updateButtonVisibilityForContext: function (context, tabId) {
		const tabsJSON = this.getTabsJSON();
		const splitTabId = tabId.split('-');
		if (splitTabId.length !== 3)
			return;

		const tabName = splitTabId[0];
		const toShow = [];
		const toHide = [];

		tabsJSON.forEach((tabContent) => {
			if (!tabContent || !tabContent.children[0] || !tabContent.children[0].children) return;

			const tabPageId = tabContent.children[0].id;
			const tabPageName = tabPageId.split('-')[0];
			if (tabPageName !== tabName)
				return;

			const children = tabContent.children[0].children;
			const requiredContext = context || 'default';

			children.forEach((item) => {
				if (!item.context) return;

				if (item.context.indexOf(requiredContext) >= 0) {
					toShow.push(item.command.replace('.uno:', ''));
				} else {
					toHide.push(item.command.replace('.uno:', ''));
				}
			});
		});

		toHide.forEach((item) => {
			this.showButton(item, false);
		});
		toShow.forEach((item) => {
			this.showButton(item, true);
		});
	},

	showButton: function (id, show) {
		if (!id) return;

		this.builder.executeAction(this.parentContainer, {
			control_id: id,
			control: { id: id },
			action_type: show ? 'show' : 'hide',
		});

		JSDialog.RefreshScrollables();
	},

	updateTabsVisibilityForContext: function(requestedContext) {
		var tabs = this.getTabs();
		var contextTab = null;
		var defaultTab = null;
		let alreadySelected = null;
		// Currently selected tab name, part of the element's ID.
		let currentlySelectedTabName = null;
		for (var tab in tabs) {
			var tabElement = $('#' + tabs[tab].name + '-tab-label');
			if (tabElement.hasClass('selected')) {
				currentlySelectedTabName = tabs[tab].name;
			}
			if (tabs[tab].context) {
				tabElement.hide();
				var contexts = tabs[tab].context.split('|');
				for (var context in contexts) {
					// Check the tab isn't hidden.
					if (!this.map.uiManager.isTabVisible(tabs[tab].name)) {
						continue;
					}
					if (contexts[context] === requestedContext) {
						tabElement.show();
						tabElement.removeClass('hidden');
						if (!tabElement.hasClass('selected'))
							contextTab = tabElement;
						else
							alreadySelected = tabElement;
					} else if (contexts[context] === 'default') {
						tabElement.show();
						if (!tabElement.hasClass('selected'))
							defaultTab = tabElement;
					}
				}
			} else if (!this.map.uiManager.isTabVisible(tabs[tab].name)) {
				// There is no context, but we check if the tab is hidden
				tabElement.hide();
			} else {
				tabElement.show();
			}
		}

		if (alreadySelected) {
			const tabId = alreadySelected.attr('id');
			this.updateButtonVisibilityForContext(requestedContext, tabId);
			return;
		}

		if (contextTab) {
			// Switch to the tab of the context, unless we currently show the review tab
			// for text documents, where jumping to the next change would possibly
			// switch to the Home or Table tabs, which is not wanted.
			var docType = this._map.getDocType();
			if (docType !== 'text' || currentlySelectedTabName !== 'Review') {
				contextTab.click();
			}
			const tabId = contextTab.attr('id');
			this.updateButtonVisibilityForContext(requestedContext, tabId);
			return;
		}

		if (defaultTab) {
			defaultTab.click();
			const tabId = defaultTab.attr('id');
			this.updateButtonVisibilityForContext(requestedContext, tabId);
			return;
		}
	},

	onContextChange: function(event) {
		const detail = event.detail;
		if (detail.appId !== detail.oldAppId) {
			var childrenArray = undefined; // Use buttons provided by specific Control.Notebookbar implementation by default
			if (detail.appId === 'com.sun.star.formula.FormulaProperties') {
				childrenArray = [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:SidebarDeck.ElementsDeck', '', true),
						'command': '.uno:SidebarDeck.ElementsDeck'
					}
				];
			}
			this.createOptionsSection(childrenArray);
		}

		if (detail.context === detail.oldContext)
			return;

		if (this.shouldIgnoreContextChange([detail.context, detail.oldContext], detail.appId))
			return;

		this.updateTabsVisibilityForContext(detail.context);
		this._lastContext = detail.context;
	},

	onSlideHideToggle: function() {
		if (!app.impress.isSlideHidden(this.map.getCurrentPartNumber()))
			$('#showslide').hide();
		else
			$('#showslide').show();

		if (app.impress.isSlideHidden(this.map.getCurrentPartNumber()))
			$('#hideslide').hide();
		else
			$('#hideslide').show();
	},

	onStatusbarChange: function() {
		if (this.map.uiManager.isStatusBarVisible()) {
			$('#showstatusbar').addClass('selected');
		}
		else {
			$('#showstatusbar').removeClass('selected');
		}
	},

	onRulerChange: function() {
		if (this.map.uiManager.isRulerVisible()) {
			$('#showruler').addClass('selected');
		}
		else {
			$('#showruler').removeClass('selected');
		}
	},

	onDarkModeToggleChange: function() {
		if (window.prefs.getBoolean('darkTheme')) {
			$('#invertbackground').show();
		}
		else {
			$('#invertbackground').hide();
		}
	},

	onShowAnnotationsChange: function(e) {
		if (e.state === 'true')
		{
			$('#review-show-resolved-annotations').removeClass('disabled');
			$('#review-show-resolved-annotations').attr('disabled', false);
			$('#review-show-resolved-annotations-button').attr('disabled', false);
		}
		else
		{
			$('#review-show-resolved-annotations').addClass('disabled');
			$('#review-show-resolved-annotations').attr('disabled', true);
			$('#review-show-resolved-annotations-button').attr('disabled', true);
		}
	},

	onAccessibilityToggleChange: function() {
		if (window.prefs.getBoolean('accessibilityState')) {
			$('#togglea11ystate').addClass('selected');
		} else {
			$('#togglea11ystate').removeClass('selected');
		}
	},

	buildOptionsSectionData: function(childrenArray) {
		return [
			{
				'id': 'optionscontainer',
				'type': 'container',
				'children': [
					{
						'id': 'optionstoolboxdown',
						'type': 'toolbox',
						'children': childrenArray
					}
				]
			}
		];
	},

	getOptionsSectionData: function() {
		return this.buildOptionsSectionData(this.getDefaultToolItems());
	},

	getDefaultToolItems: function() {
		const optionsToolItems = [
			{
				'type': 'toolitem',
				'text': _UNO('.uno:Sidebar', '', true),
				'command': '.uno:SidebarDeck.PropertyDeck',
				'accessibility': { focusBack: false, combination: 'ZB', de: null },
				'useInLineLabelsForUnoButtons': false,
			},
		];
	
		if (this._map && this._map['wopi'].EnableShare) {
			optionsToolItems.push({
				'type': 'customtoolitem',
				'text': _('Share'),
				'command': 'shareas',
				'accessibility': { focusBack: false, combination: 'ZS', de: null }
			});
		}
	
		return optionsToolItems;
	},

	createOptionsSection: function(childrenArray) {
		$('.notebookbar-options-section').remove();

		var optionsSection = L.DomUtil.create('div', 'notebookbar-options-section');
		$(optionsSection).insertBefore('#closebuttonwrapperseparator');

		var builderOptions = {
			mobileWizard: this,
			map: this.map,
			cssClass: 'notebookbar',
		};

		var builder = new L.control.notebookbarBuilder(builderOptions);
		if (childrenArray === undefined)
			childrenArray = this.getOptionsSectionData();
		builder.build(optionsSection, childrenArray);
	},
});
