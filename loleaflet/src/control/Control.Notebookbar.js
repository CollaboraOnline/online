/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Notebookbar
 */

/* global $ _ _UNO */
L.Control.Notebookbar = L.Control.extend({

	_currentScrollPosition: 0,
	_showNotebookbar: false,
	/// do we use cached JSON or already received something from the core
	_isLoaded: false,

	container: null,
	builder: null,

	onAdd: function (map) {
		// log and test window.ThisIsTheiOSApp = true;
		this.map = map;
		this._currentScrollPosition = 0;

		this.builder = new L.control.notebookbarBuilder({mobileWizard: this, map: map, cssClass: 'notebookbar'});
		this.loadTab(this.getFullJSON('-10'));

		this.createScrollButtons();
		this.setupResizeHandler();

		this.map.on('contextchange', this.onContextChange, this);
		this.map.on('notebookbar', this.onNotebookbar, this);
		this.map.on('updatepermission', this.onUpdatePermission, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);

		$('#toolbar-wrapper').addClass('hasnotebookbar');
		$('.main-nav').addClass('hasnotebookbar');
		$('.main-nav').addClass(this._map.getDocType() + '-color-indicator');

		var docLogoHeader = L.DomUtil.create('div', '');
		docLogoHeader.id = 'document-header';
		var docLogo = L.DomUtil.create('div', 'document-logo', docLogoHeader);
		$(docLogo).data('id', 'document-logo');
		$(docLogo).data('type', 'action');
		$('.main-nav').prepend(docLogoHeader);

		var that = this;
		var retryNotebookbarInit = function() {
			if (!that._isLoaded) {
				console.error('notebookbar is not initialized, retrying');
				that.map.sendUnoCommand('.uno:Notebookbar?File:string=notebookbar.ui');
				that.retry = setTimeout(retryNotebookbarInit, 10000);
			}
		};

		this.retry = setTimeout(retryNotebookbarInit, 3000);
	},

	onRemove: function() {
		clearTimeout(this.retry);
		this.map.off('contextchange', this.onContextChange, this);
		this.map.off('updatepermission', this.onUpdatePermission, this);
		this.map.off('notebookbar');
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.clearNotebookbar();
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype !== 'notebookbar')
			return;

		if (!this.container)
			return;

		var control = this.container.querySelector('#' + data.control.id);
		if (!control)
			return;

		var parent = control.parentNode;
		if (!parent)
			return;

		if (!this.builder)
			return;

		control.style.visibility = 'hidden';

		var temporaryParent = L.DomUtil.create('div');
		this.builder.buildControl(temporaryParent, data.control);
		parent.insertBefore(temporaryParent.firstChild, control.nextSibling);
		L.DomUtil.remove(control);
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
		this._isLoaded = true;
		// setup id for events
		this.builder.setWindowId(data.id);
	},

	showTabs: function() {
		$('.ui-tabs.notebookbar').show();
		$('.notebookbar-shortcuts-bar').show();
		this.extend();
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

		if (window.mode.isDesktop() || (window.ThisIsAMobileApp && window.mode.isTablet()))
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
		return [
			{
				'id': 'shortcutstoolbox',
				'type': 'toolbox',
				'children': [
					{
						'type': 'toolitem',
						'text': _('Menu'),
						'command': '.uno:Menubar'
					},
					{
						'type': 'toolitem',
						'text': _('Save'),
						'command': '.uno:Save'
					},
					{
						'type': 'toolitem',
						'text': _('Undo'),
						'command': '.uno:Undo'
					},
					{
						'type': 'toolitem',
						'text': _('Redo'),
						'command': '.uno:Redo'
					}
				]
			}
		];
	},

	createShortcutsBar: function() {
		var shortcutsBar = L.DomUtil.create('div', 'notebookbar-shortcuts-bar');
		$('#main-menu').after(shortcutsBar);
		this.builder.build(shortcutsBar, this.getShortcutsBarData());
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

		$(left).css({'height': '80px'});
		$(right).css({'height': '80px'});

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
				if ($('.notebookbar-scroll-wrapper').scrollLeft() > 0)
					$(container).find('.w2ui-scroll-left').show();
				else
					$(container).find('.w2ui-scroll-left').hide();

				if ($('.notebookbar-scroll-wrapper').scrollLeft() < $(rootContainer).outerWidth() - $(window).width() - 1)
					$(container).find('.w2ui-scroll-right').show();
				else
					$(container).find('.w2ui-scroll-right').hide();
			} else {
				$(container).find('.w2ui-scroll-left').hide();
				$(container).find('.w2ui-scroll-right').hide();
			}
		};

		$(window).resize(handler);
		$('.notebookbar-scroll-wrapper').scroll(handler);
	},

	onContextChange: function(event) {
		var tabs = this.getTabs();
		for (var tab in tabs) {
			if (tabs[tab].context) {
				var tabElement = $('#' + tabs[tab].name + '-tab-label');
				tabElement.hide();
				var contexts = tabs[tab].context.split('|');
				for (var context in contexts) {
					if (contexts[context] === event.context) {
						tabElement.show();
						if (!tabElement.hasClass('selected'))
							tabElement.click();
					} else if (contexts[context] === 'default') {
						tabElement.show();
					}
				}
			}
		}
	},

	getOptionsSectionData: function() {
		return [
			{
				'id': 'optionscontainer',
				'type': 'container',
				'vertical': 'true',
				'children': [
					{
						'id': 'optionstoolboxdown',
						'type': 'toolbox',
						'children': [
							{
								'type': 'toolitem',
								'text': _UNO('.uno:Sidebar', '', true),
								'command': '.uno:Sidebar'
							},
							{
								'type': 'toolitem',
								// dummy node to avoid creating labels
							}
						]
					}
				]
			}
		];
	},

	createOptionsSection: function() {
		$('.notebookbar-options-section').remove();

		var optionsSection = L.DomUtil.create('div', 'notebookbar-options-section');
		$('#document-titlebar').parent().append(optionsSection);

		if (L.Params.closeButtonEnabled)
			$(optionsSection).css('right', '30px');

		var builderOptions = {
			mobileWizard: this,
			map: this.map,
			cssClass: 'notebookbar',
		};

		var builder = new L.control.notebookbarBuilder(builderOptions);
		builder.build(optionsSection, this.getOptionsSectionData());
	},
});
