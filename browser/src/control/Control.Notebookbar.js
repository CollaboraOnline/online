/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Notebookbar
 */

/* global $ _ _UNO */
L.Control.Notebookbar = L.Control.extend({

	_currentScrollPosition: 0,
	_showNotebookbar: false,
	_RTL: false,

	container: null,
	builder: null,

	HOME_TAB_ID: '-10',

	additionalShortcutButtons: [],
	hiddenShortcutButtons: [],

	onAdd: function (map) {
		// log and test window.ThisIsTheiOSApp = true;
		this.map = map;
		this.additionalShortcutButtons = [];
		this._currentScrollPosition = 0;
		var docType = this._map.getDocType();

		if (document.documentElement.dir === 'rtl')
			this._RTL = true;

		this.builder = new L.control.notebookbarBuilder({mobileWizard: this, map: map, cssClass: 'notebookbar', useSetTabs: true});
		var toolbar = L.DomUtil.get('toolbar-up');
		// In case it contains garbage
		if (toolbar)
			toolbar.remove();
		$('#toolbar-logo').after(this.map.toolbarUpTemplate.cloneNode(true));
		toolbar = $('#toolbar-up');

		this.loadTab(this.getFullJSON(this.HOME_TAB_ID));

		this.createScrollButtons();
		this.setupResizeHandler();

		this.map.on('contextchange', this.onContextChange, this);
		this.map.on('notebookbar', this.onNotebookbar, this);
		this.map.on('updatepermission', this.onUpdatePermission, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);
		this.map.on('jsdialogaction', this.onJSAction, this);
		this.map.on('statusbarchanged', this.onStatusbarChange, this);
		this.map.on('rulerchanged', this.onRulerChange, this);
		this.map.on('darkmodechanged', this.onDarkModeToggleChange, this);

		this.map.sendUnoCommand('.uno:ToolbarMode?Mode:string=notebookbar_online.ui');

		$('#toolbar-wrapper').addClass('hasnotebookbar');
		$('.main-nav').removeProp('overflow');
		$('.main-nav').addClass('hasnotebookbar');
		$('.main-nav').addClass(docType + '-color-indicator');
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

		var that = this;
		var usesNotebookbarWidgetsInCore = docType === 'text' || docType === 'spreadsheet';
		var retryNotebookbarInit = function() {
			if (!that.map._isNotebookbarLoadedOnCore && usesNotebookbarWidgetsInCore) {
				// if notebookbar doesn't have any welded controls it can trigger false alarm here
				window.app.console.warn('notebookbar might be not initialized, retrying');
				that.map.sendUnoCommand('.uno:ToolbarMode?Mode:string=notebookbar_online.ui');
				that.retry = setTimeout(retryNotebookbarInit, 3000);
			}
		};

		this.retry = setTimeout(retryNotebookbarInit, 3000);
	},

	onRemove: function() {
		clearTimeout(this.retry);
		this.map._isNotebookbarLoadedOnCore = false;
		this.map.sendUnoCommand('.uno:ToolbarMode?Mode:string=Default');
		this.map.off('contextchange', this.onContextChange, this);
		this.map.off('updatepermission', this.onUpdatePermission, this);
		this.map.off('notebookbar');
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
		$('.main-nav #document-header').remove();
		$('.main-nav.hasnotebookbar').css('overflow', 'visible');
		$('.main-nav').removeClass('hasnotebookbar');
		$('#toolbar-wrapper').removeClass('hasnotebookbar');
		$('.main-nav').removeClass(this._map.getDocType() + '-color-indicator');
		$('.main-nav #document-header').remove();
		this.clearNotebookbar();
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype !== 'notebookbar')
			return;

		if (!this.container)
			return;

		this.map._isNotebookbarLoadedOnCore = true;

		var control = this.container.querySelector('[id=\'' + data.control.id + '\']');
		if (!control) {
			window.app.console.warn('jsdialogupdate: not found control with id: "' + data.control.id + '"');
			return;
		}

		var parent = control.parentNode;
		if (!parent)
			return;

		if (!this.builder)
			return;

		var scrollTop = control.scrollTop;
		control.style.visibility = 'hidden';

		var temporaryParent = L.DomUtil.create('div');
		this.builder.buildControl(temporaryParent, data.control);
		parent.insertBefore(temporaryParent.firstChild, control.nextSibling);
		var backupGridSpan = control.style.gridColumn;
		L.DomUtil.remove(control);

		var newControl = this.container.querySelector('[id=\'' + data.control.id + '\']');
		if (newControl) {
			newControl.scrollTop = scrollTop;
			newControl.style.gridColumn = backupGridSpan;
		}
	},

	onJSAction: function (e) {
		var data = e.data;

		if (data.jsontype !== 'notebookbar')
			return;

		if (!this.builder)
			return;

		if (!this.container)
			return;

		this.map._isNotebookbarLoadedOnCore = true;

		this.builder.executeAction(this.container, data.data);
	},

	onUpdatePermission: function(e) {
		if (e.perm === 'edit') {
			this._showNotebookbar = true;
			this.showTabs();
			$('.main-nav').removeClass('readonly');
		} else {
			this.hideTabs();
		}
	},

	onNotebookbar: function(data) {
		this.map._isNotebookbarLoadedOnCore = true;
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
		$('.notebookbar-scroll-wrapper').remove();
		$('.notebookbar-shortcuts-bar').remove();
	},

	loadTab: function(tabJSON) {
		this.clearNotebookbar();

		var parent = $('#toolbar-up').get(0);
		this.container = L.DomUtil.create('div', 'notebookbar-scroll-wrapper', parent);

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
						'command': '.uno:Save'
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

		for (i in this.hiddenShortcutButtons) {
			var toHide = this.hiddenShortcutButtons[i];
			for (var j in toolitems) {
				item = toolitems[j];
				if (item.id == toHide) {
					toolitems.splice(j, 1);
					break;
				}
			}
		}

		this.builder.build(shortcutsBar, shortcutsBarData);
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
				postmessage: button.unoCommand ? undefined : true,
				cssClass: 'integrator-shortcut'
			}
		);

		this.reloadShortcutsBar();
	},

	showShortcutsButton: function(buttonId, show) {
		var i = this.hiddenShortcutButtons.indexOf(buttonId);
		if (i > -1) {
			if (show === true)
				this.hiddenShortcutButtons.splice(i, 1);

			this.reloadShortcutsBar();
			return;
		}

		this.hiddenShortcutButtons.push(buttonId);
		this.reloadShortcutsBar();
	},

	setCurrentScrollPosition: function() {
		this._currentScrollPosition = $('.notebookbar-scroll-wrapper').scrollLeft();
	},

	scrollToLastPositionIfNeeded: function() {
		var rootContainer = $('.notebookbar-scroll-wrapper div').get(0);

		if (this._currentScrollPosition && $(rootContainer).outerWidth() > $(window).width()) {
			$('.notebookbar-scroll-wrapper').animate({ scrollLeft: this._currentScrollPosition }, 0);
		} else {
			$(window).resize();
		}
	},

	createScrollButtons: function() {
		var parent = $('#toolbar-up').get(0);

		var left = L.DomUtil.create('div', 'w2ui-scroll-left', parent);
		var right = L.DomUtil.create('div', 'w2ui-scroll-right', parent);

		$(left).css({'height': '72px'});
		$(right).css({'height': '72px'});

		$(left).click(function () {
			var scroll = $('.notebookbar-scroll-wrapper').scrollLeft() - 300;
			$('.notebookbar-scroll-wrapper').animate({ scrollLeft: scroll }, 300);
			setTimeout(function () { $(window).resize(); }, 350);
		});

		$(right).click(function () {
			var scroll = $('.notebookbar-scroll-wrapper').scrollLeft() + 300;
			$('.notebookbar-scroll-wrapper').animate({ scrollLeft: scroll }, 300);
			setTimeout(function () { $(window).resize(); }, 350);
		});
	},

	setupResizeHandler: function() {
		var handler = function() {
			var container = $('#toolbar-up').get(0);
			var rootContainer = $('.notebookbar-scroll-wrapper div').get(0);

			if ($(rootContainer).outerWidth() > $(window).width()) {
				// we have overflowed content
				var direction = this._RTL ? -1 : 1;
				if (direction * $('.notebookbar-scroll-wrapper').scrollLeft() > 0) {
					if (this._RTL)
						$(container).find('.w2ui-scroll-right').show();
					else
						$(container).find('.w2ui-scroll-left').show();
				} else if (this._RTL)
					$(container).find('.w2ui-scroll-right').hide();
				else
					$(container).find('.w2ui-scroll-left').hide();

				if (direction * $('.notebookbar-scroll-wrapper').scrollLeft() < $(rootContainer).outerWidth() - $(window).width() - 1) {
					if (this._RTL)
						$(container).find('.w2ui-scroll-left').show();
					else
						$(container).find('.w2ui-scroll-right').show();
				} else if (this._RTL)
					$(container).find('.w2ui-scroll-left').hide();
				else
					$(container).find('.w2ui-scroll-right').hide();
			} else {
				$(container).find('.w2ui-scroll-left').hide();
				$(container).find('.w2ui-scroll-right').hide();
			}
		}.bind(this);

		$(window).resize(handler);
		$('.notebookbar-scroll-wrapper').scroll(handler);
	},

	onContextChange: function(event) {
		if (event.appId !== event.oldAppId) {
			var childrenArray = undefined; // Use buttons provided by specific Control.Notebookbar implementation by default
			if (event.appId === 'com.sun.star.formula.FormulaProperties') {
				childrenArray = [
					{
						'type': 'toolitem',
						'text': _UNO('.uno:SidebarDeck.ElementsDeck', '', true),
						'command': '.uno:SidebarDeck.ElementsDeck'
					},
					{
						'type': 'toolitem',
						// dummy node to avoid creating labels
					}
				];
			}
			this.createOptionsSection(childrenArray);
		}

		if (event.context === event.oldContext)
			return;

		var tabs = this.getTabs();
		var contextTab = null;
		var defaultTab = null;
		for (var tab in tabs) {
			if (tabs[tab].context) {
				var tabElement = $('#' + tabs[tab].name + '-tab-label');
				tabElement.hide();
				var contexts = tabs[tab].context.split('|');
				for (var context in contexts) {
					if (contexts[context] === event.context) {
						tabElement.show();
						tabElement.removeClass('hidden');
						if (!tabElement.hasClass('selected'))
							contextTab = tabElement;
					} else if (contexts[context] === 'default') {
						tabElement.show();
						if (!tabElement.hasClass('selected'))
							defaultTab = tabElement;
					}
				}
			}
		}

		if (contextTab)
			contextTab.click();
		else if (defaultTab)
			defaultTab.click();
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
		if (this.map.uiManager.getDarkModeState()) {
			$('#toggledarktheme').addClass('selected');
		}
		else {
			$('#toggledarktheme').removeClass('selected');
		}
	},

	buildOptionsSectionData: function(childrenArray) {
		return [
			{
				'id': 'optionscontainer',
				'type': 'container',
				'vertical': 'true',
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
		return this.buildOptionsSectionData([
			{
				'type': 'toolitem',
				'text': _UNO('.uno:Sidebar', '', true),
				'command': '.uno:SidebarDeck.PropertyDeck'
			},
			{
				'type': 'toolitem',
				'text': _UNO('.uno:Navigator'),
				'command': '.uno:Navigator'
			},
			{
				'type': 'toolitem',
				// dummy node to avoid creating labels
			}
		]);
	},

	createOptionsSection: function(childrenArray) {
		$('.notebookbar-options-section').remove();

		var optionsSection = L.DomUtil.create('div', 'notebookbar-options-section');
		$(optionsSection).insertBefore('#closebuttonwrapper');

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
