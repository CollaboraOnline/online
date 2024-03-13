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
 * L.Control.UIManager - initializes the UI elements like toolbars, menubar or ruler
 *			 and allows to controll them (show/hide)
 */

/* global app $ setupToolbar w2ui toolbarUpMobileItems _ Hammer JSDialog */
L.Control.UIManager = L.Control.extend({
	mobileWizard: null,
	documentNameInput: null,
	blockedUI: false,
	busyPopupTimer: null,
	customButtons: [], // added by WOPI InsertButton
	hiddenButtons: {},
	hiddenCommands: {},

	onAdd: function (map) {
		this.map = map;
		var that = this;
		this.notebookbar = null;
		// Every time the UI mode changes from 'classic' to 'notebookbar'
		// the two below elements will be destroyed.
		// Here we save the original state of the elements, as provided
		// by server, in order to apply to them the same initialization
		// code when activating the 'classic' mode as if the elements are
		// initialized for the first time since the start of the application.
		// It is important to use the same initial structure provided by server
		// in order to keep a single place (server) of initial properties setting.
		this.map.toolbarUpTemplate = $('#toolbar-up')[0].cloneNode(true);
		this.map.mainMenuTemplate = $('#main-menu')[0].cloneNode(true);

		map.on('infobar', this.showInfoBar, this);
		map.on('updatepermission', this.onUpdatePermission, this);

		if (window.mode.isMobile()) {
			window.addEventListener('popstate', this.onGoBack.bind(this));

			// provide entries in the history we can catch to close the app
			history.pushState({context: 'app-started'}, 'app-started');
			history.pushState({context: 'app-started'}, 'app-started');
		}

		map.on('blockUI', this.blockUI, this);
		map.on('unblockUI', this.unblockUI, this);

		$('#toolbar-wrapper').on('click', function (event) {
			if (event.target.parentElement.id === 'toolbar-up' || // checks if clicked on empty part of the toolbar on tabbed view
				event.target.id === 'tb_editbar_item_item_64') // checks if clicked on empty part of the toolbar on compact view
				that.map.fire('editorgotfocus');
		});

		$('.main-nav').on('click', function (event) {
			if (event.target.parentElement.nodeName === 'NAV' || // checks if clicked on an container of an element
				event.target.nodeName === 'NAV' || // checks if clicked on navigation bar itself
				event.target.parentElement.id === 'document-titlebar') { // checks if clicked on the document titlebar container
				that.map.fire('editorgotfocus');}
		});

		if (window.zoteroEnabled)
			this.map.on('updateviewslist', this.onUpdateViews, this);
	},

	// UI initialization

	getCurrentMode: function() {
		return this.shouldUseNotebookbarMode() ? 'notebookbar' : 'classic';
	},

	shouldUseNotebookbarMode: function() {
		var forceCompact = this.getSavedStateOrDefault('compactMode', null);
		return (window.userInterfaceMode === 'notebookbar' && forceCompact === null)
			|| forceCompact === false;
	},

	// Dark mode toggle

	loadLightMode: function() {
		document.documentElement.setAttribute('data-theme','light');
		this.setCanvasColorAfterModeChange();
		this.map.fire('darkmodechanged');
	},

	loadDarkMode: function() {
		document.documentElement.setAttribute('data-theme','dark');
		this.setCanvasColorAfterModeChange();
		this.map.fire('darkmodechanged');
	},

	getDarkModeState: function() {
		return this.getSavedStateOrDefault('darkTheme', window.uiDefaults['darkTheme'] ?  window.uiDefaults['darkTheme'] : false);
	},

	setCanvasColorAfterModeChange: function() {
		if (app.sectionContainer) {
			app.sectionContainer.setBackgroundColorMode(false);
			app.sectionContainer.setClearColor(window.getComputedStyle(document.documentElement).getPropertyValue('--color-canvas'));
			//change back to it's default value after setting canvas color
			app.sectionContainer.setBackgroundColorMode(true);
		}
	},

	toggleDarkMode: function() {
		// get the initial mode
		var selectedMode = this.getDarkModeState();
		// swap them by invoking the appropriate load function and saving the state
		if (selectedMode) {
			this.setSavedState('darkTheme',false);
			this.loadLightMode();
			this.activateDarkModeInCore(false);
		}
		else {
			this.setSavedState('darkTheme',true);
			this.loadDarkMode();
			this.activateDarkModeInCore(true);
		}
		if (!window.mode.isMobile())
			this.refreshAfterThemeChange();

		this.map.fire('themechanged');
	},

	initDarkModeFromSettings: function() {
		var selectedMode = this.getDarkModeState();

		if (window.ThisIsTheAndroidApp) {
			selectedMode = window.uiDefaults['darkTheme'] ?  window.uiDefaults['darkTheme'] : false;
			this.setSavedState('darkTheme', selectedMode);
		}

		if (selectedMode) {
			this.loadDarkMode();
		}
		else {
			this.loadLightMode();
		}
		this.activateDarkModeInCore(selectedMode);
	},

	activateDarkModeInCore: function(activate) {
		var cmd = { 'NewTheme': { 'type': 'string', 'value': '' } };
		activate ? cmd.NewTheme.value = 'Dark' : cmd.NewTheme.value = 'Light';
		app.socket.sendMessage('uno .uno:ChangeTheme ' + JSON.stringify(cmd));
	},

	renameDocument: function() {
		// todo: does this need _('rename document)
		var docNameInput = this.documentNameInput;
		var fileName = this.map['wopi'].BaseFileName ? this.map['wopi'].BaseFileName : '';
		this.showInputModal('rename-modal', _('Rename Document'), _('Enter new name'), fileName, _('Rename'),
			function(newName) {
				docNameInput.documentNameConfirm(newName);
		});
	},

	toggleWasm: function () {
		if (window.ThisIsTheEmscriptenApp) {
			//TODO: Should use the "external" socket.
			// app.socket.sendMessage('switch_request online');
		} else {
			app.socket.sendMessage('switch_request offline');
		}

		// Wait for Coolwsd to initiate the switch.
	},

	getAccessibilityState: function() {
		return window.isLocalStorageAllowed && window.localStorage.getItem('accessibilityState') === 'true';
	},

	toggleAccessibilityState: function() {
		var savedA11yState = this.getAccessibilityState();
		if (window.isLocalStorageAllowed)
			window.localStorage.setItem('accessibilityState', !savedA11yState ? 'true' : 'false');
		this.map.fire('a11ystatechanged');
		this.map.setAccessibilityState(!savedA11yState);
	},

	initializeBasicUI: function() {
		var enableNotebookbar = this.shouldUseNotebookbarMode();
		var that = this;

		this.map._accessibilityState = this.getAccessibilityState();

		if (window.mode.isMobile() || !enableNotebookbar) {
			var menubar = L.control.menubar();
			this.map.menubar = menubar;
			this.map.addControl(menubar);
		}

		if (window.mode.isMobile()) {
			$('#toolbar-mobile-back').on('click', function() {
				that.enterReadonlyOrClose();
			});
		}

		if (!window.mode.isMobile()) {
			if (!enableNotebookbar) {
				this.map.topToolbar = L.control.topToolbar();
				this.map.addControl(this.map.topToolbar);
			}

			this.map.addControl(L.control.statusBar());

			this.map.jsdialog = L.control.jsDialog();
			this.map.addControl(this.map.jsdialog);

			this.map.sidebar = L.control.sidebar({animSpeed: 200});
			this.map.addControl(this.map.sidebar);

			this.map.addControl(L.control.mention());
		}

		setupToolbar(this.map);

		this.documentNameInput = L.control.documentNameInput();
		this.map.addControl(this.documentNameInput);
		this.map.addControl(L.control.alertDialog());
		this.mobileWizard = L.control.mobileWizard();
		this.map.addControl(this.mobileWizard);
		this.map.addControl(L.control.languageDialog());
		this.map.dialog = L.control.lokDialog();
		this.map.addControl(this.map.dialog);
		this.map.addControl(L.control.contextMenu());
		this.map.userList = L.control.userList();
		this.map.addControl(this.map.userList);

		var openBusyPopup = function(label) {
			this.busyPopupTimer = setTimeout(function() {
				var json = {
					id: 'busypopup',
					jsontype: 'dialog',
					type: 'modalpopup',
					children: [
						{
							id: 'busycontainer',
							type: 'container',
							vertical: 'true',
							children: [
								{id: 'busyspinner', type: 'spinnerimg'},
								{id: 'busylabel', type: 'fixedtext', text: label}
							]
						}
					]
				};
				if (app.socket) {
					var builderCallback = function() { /* Do nothing. */ };
					app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json), callback: builderCallback});
				}
			}, 700);
		};

		var fadeoutBusyPopup = function() {
			clearTimeout(this.busyPopupTimer);
			var json = {
				id: 'busypopup',
				jsontype: 'dialog',
				type: 'modalpopup',
				action: 'fadeout'
			};
			if (app.socket)
				app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json)});
		};

		this.map.on('showbusy', function(e) {
			fadeoutBusyPopup();
			openBusyPopup(e.label);
		});

		this.map.on('hidebusy', function() {
			fadeoutBusyPopup();
		});
	},

	initializeSpecializedUI: function(docType) {
		var isDesktop = window.mode.isDesktop();
		var currentMode = this.getCurrentMode();
		var enableNotebookbar = currentMode === 'notebookbar' && !app.isReadOnly();
		var hasShare = this.map.wopi.EnableShare;

		document.body.setAttribute('data-userInterfaceMode', currentMode);

		if (hasShare)
			document.body.setAttribute('data-integratorSidebar', 'true');

		if (window.mode.isMobile()) {
			$('#mobile-edit-button').show();
			this.map.addControl(L.control.mobileBottomBar(docType));
			this.map.addControl(L.control.mobileTopBar(docType));
			this.map.addControl(L.control.searchBar());
		} else if (enableNotebookbar) {
			this.createNotebookbarControl(docType);
			// makeSpaceForNotebookbar call in onUpdatePermission
		}

		if (window.uiDefaults[docType] && window.uiDefaults[docType]['ShowToolbar'] === false) {
			this.collapseNotebookbar();
		}

		this.initDarkModeFromSettings();

		if (docType === 'spreadsheet') {
			this.map.addControl(L.control.sheetsBar({shownavigation: isDesktop || window.mode.isTablet()}));
			this.map.addControl(L.control.formulaBar());
			var formulabar = L.control.formulaBarJSDialog();
			this.map.formulabar = formulabar;
			this.map.addControl(formulabar);
			$('#toolbar-wrapper').addClass('spreadsheet');

			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('presentation-controls-wrapper'));
			document.getElementById('selectbackground').parentNode.removeChild(document.getElementById('selectbackground'));
		}

		if (this.map.isPresentationOrDrawing()) {
			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('spreadsheet-toolbar'));
			$('#presentation-controls-wrapper').show();
		}

		if (docType === 'text') {
			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('spreadsheet-toolbar'));
			L.DomUtil.remove(L.DomUtil.get('presentation-controls-wrapper'));
			document.getElementById('selectbackground').parentNode.removeChild(document.getElementById('selectbackground'));

			if ((window.mode.isTablet() || window.mode.isDesktop()) && !app.isReadOnly()) {
				var showRuler = this.getSavedStateOrDefault('ShowRuler');
				var interactiveRuler = this.map.isEditMode();
				var isRTL = document.documentElement.dir === 'rtl';
				L.control.ruler({position: (isRTL ? 'topright' : 'topleft'), interactive:interactiveRuler, showruler: showRuler}).addTo(this.map);
				this.map.fire('rulerchanged');
			}

			var showResolved = this.getSavedStateOrDefault('ShowResolved');
			if (showResolved === false || showResolved === 'false')
				this.map.sendUnoCommand('.uno:ShowResolvedAnnotations');
		}

		if (this.map.isPresentationOrDrawing() && (isDesktop || window.mode.isTablet())) {
			this.map.addControl(L.control.presentationBar());
		}

		if (window.mode.isMobile() || (window.mode.isTablet() && !enableNotebookbar)) {
			this.map.on('updatetoolbarcommandvalues', function() {
				w2ui['editbar'].refresh();
			});
		}

		this.map.on('changeuimode', this.onChangeUIMode, this);

		if (typeof window.initializedUI === 'function') {
			window.initializedUI();
		}

		var startPresentationGet = this.map.isPresentationOrDrawing() && window.coolParams.get('startPresentation');
		if (startPresentationGet === 'true' || startPresentationGet === '1') {
			this._map.dispatch('presentation');
		}
	},

	initializeSidebar: function() {
		// Hide the sidebar on start if saved state or UIDefault is set.
		if (window.mode.isDesktop() && !window.ThisIsAMobileApp) {
			var showSidebar = this.getSavedStateOrDefault('ShowSidebar');

			if (this.getSavedStateOrDefault('PropertyDeck')) {
				app.socket.sendMessage('uno .uno:SidebarShow');
			}

			if (this.map.getDocType() === 'presentation') {
				if (this.getSavedStateOrDefault('SdSlideTransitionDeck', false)) {
					app.socket.sendMessage('uno .uno:SidebarShow');
					app.socket.sendMessage('uno .uno:SlideChangeWindow');
					this.map.sidebar.setupTargetDeck('.uno:SlideChangeWindow');
				} else if (this.getSavedStateOrDefault('SdCustomAnimationDeck', false)) {
					app.socket.sendMessage('uno .uno:SidebarShow');
					app.socket.sendMessage('uno .uno:CustomAnimation');
					this.map.sidebar.setupTargetDeck('.uno:CustomAnimation');
				} else if (this.getSavedStateOrDefault('SdMasterPagesDeck', false)) {
					app.socket.sendMessage('uno .uno:SidebarShow');
					app.socket.sendMessage('uno .uno:MasterSlidesPanel');
					this.map.sidebar.setupTargetDeck('.uno:MasterSlidesPanel');
				} else if (this.getSavedStateOrDefault('NavigatorDeck', false)) {
					app.socket.sendMessage('uno .uno:SidebarShow');
					app.socket.sendMessage('uno .uno:Navigator');
					this.map.sidebar.setupTargetDeck('.uno:Navigator');
				}
			} else if (this.getSavedStateOrDefault('NavigatorDeck', false)) {
				app.socket.sendMessage('uno .uno:SidebarShow');
				app.socket.sendMessage('uno .uno:Navigator');
				this.map.sidebar.setupTargetDeck('.uno:Navigator');
			}

			if (!showSidebar)
				app.socket.sendMessage('uno .uno:SidebarHide');
		}
		else if (window.mode.isChromebook()) {
			// HACK - currently the sidebar shows when loaded,
			// with the exception of mobile phones & tablets - but
			// there, it does not show only because they start
			// with read/only mode which hits an early exit in
			// _launchSidebar() in Control.LokDialog.js
			// So for the moment, let's just hide it on
			// Chromebooks early
			app.socket.sendMessage('uno .uno:SidebarHide');
		}
	},

	removeClassicUI: function() {
		if (this.map.menubar)
		{
			this.map.removeControl(this.map.menubar);
			this.map.menubar = null;
		}
		if (this.map.topToolbar)
		{
			this.map.removeControl(this.map.topToolbar);
			this.map.topToolbar = null;
		}
	},

	addClassicUI: function() {
		this.map.menubar = L.control.menubar();
		this.map.addControl(this.map.menubar);
		this.map.topToolbar = L.control.topToolbar();
		this.map.addControl(this.map.topToolbar);

		//update the toolbar according to CheckFileInfo
		this.map.topToolbar.onWopiProps(this.map.wopi);

		this.map.menubar._onDocLayerInit();
		this.map.topToolbar.onDocLayerInit();
		this.map.sendInitUNOCommands();
		this.map._docLayer._resetClientVisArea();
		this.map._docLayer._requestNewTiles();

		this.map.topToolbar.updateControlsState();

		if (this._menubarShouldBeHidden)
			this.hideMenubar();
	},

	createNotebookbarControl: function(docType) {
		if (docType === 'spreadsheet') {
			var notebookbar = L.control.notebookbarCalc();
		} else if (docType === 'presentation') {
			notebookbar = L.control.notebookbarImpress();
		} else if (docType === 'drawing') {
			notebookbar = L.control.notebookbarDraw();
		} else {
			notebookbar = L.control.notebookbarWriter();
		}

		this.notebookbar = notebookbar;
		this.map.addControl(notebookbar);
		this.map.fire('a11ystatechanged');
		app.UI.notebookbarAccessibility.initialize();
	},

	refreshAfterThemeChange: function() {
		if (this.getCurrentMode() === 'classic' || this.map.isReadOnlyMode()) {
			this.refreshMenubar();
			this.refreshToolbar();
		}
		// jsdialog components like notebookbar or sidebar
		// doesn't require reload to change icons
	},

	refreshNotebookbar: function() {
			var selectedTab = $('.ui-tab.notebookbar[aria-selected="true"]').attr('id') || 'Home-tab-label';
			this.removeNotebookbarUI();
			this.createNotebookbarControl(this.map.getDocType());
			if (this._map._permission === 'edit') {
				$('.main-nav').removeClass('readonly');
			}
			$('#' + selectedTab).click();
			this.makeSpaceForNotebookbar();
			this.notebookbar._showNotebookbar = true;
			this.notebookbar.showTabs();
			$('#map').addClass('notebookbar-opened');
			this.insertCustomButtons();
			this.map.sendInitUNOCommands();
			if (this.map.getDocType() === 'presentation')
				this.map.fire('toggleslidehide');
	},

	refreshMenubar: function() {
		this.map.menubar._onRefresh();
	},
	refreshSidebar: function(ms) {
		ms = ms !== undefined ? ms : 400;
		setTimeout(function () {
			var message = 'dialogevent ' +
			    (window.sidebarId !== undefined ? window.sidebarId : -1) +
			    ' {"id":"-1"}';
			app.socket.sendMessage(message);
		}, ms);

	},
	refreshToolbar: function() {
		if (w2ui['editbar'])
			w2ui['editbar'].refresh();
		if (w2ui['actionbar'])
			w2ui['actionbar'].refresh();
	},
	addNotebookbarUI: function() {
		this.refreshNotebookbar();
		this.map._docLayer._resetClientVisArea();
		this.map._docLayer._requestNewTiles();
		var menubarWasHidden = this.isMenubarHidden();
		this.showMenubar();
		this._menubarShouldBeHidden = menubarWasHidden;
	},

	removeNotebookbarUI: function() {
		if (this.notebookbar) {
			this.map.removeControl(this.notebookbar);
			this.notebookbar = null;
		}
		$('#map').removeClass('notebookbar-opened');
	},

	onChangeUIMode: function(uiMode) {
		if (window.mode.isMobile())
			return;

		var currentMode = this.getCurrentMode();

		if (uiMode.mode === currentMode && !uiMode.force)
			return;

		if (uiMode.mode !== 'classic' && uiMode.mode !== 'notebookbar')
			return;

		document.body.setAttribute('data-userInterfaceMode', uiMode.mode);

		this.map.fire('postMessage', {msgId: 'Action_ChangeUIMode_Resp', args: {Mode: uiMode.mode}});

		switch (currentMode) {
		case 'classic':
			this.removeClassicUI();
			break;

		case 'notebookbar':
			this.removeNotebookbarUI();
			break;
		}

		window.userInterfaceMode = uiMode.mode;

		switch (uiMode.mode) {
		case 'classic':
			this.addClassicUI();
			break;

		case 'notebookbar':
			this.addNotebookbarUI();
			break;
		}

		this.setSavedState('compactMode', uiMode.mode === 'classic');
		this.initializeSidebar();
		this.insertCustomButtons();

		// this code ensures that elements in the notebookbar have their "selected" status
		// displayed correctly
		this.map.fire('rulerchanged');
		this.map.fire('statusbarchanged');

		if (typeof window.initializedUI === 'function')
			window.initializedUI();
		this.map.fire('darkmodechanged');
		this.map.fire('rulerchanged');
		this.map.fire('statusbarchanged');
		this.map.fire('a11ystatechanged');
	},

	// UI modification

	insertButtonToClassicToolbar: function(button) {
		if (w2ui['editbar'] && !w2ui['editbar'].get(button.id)) {
			if (this.map.isEditMode()) {
				// add the css rule for the image
				var style = $('html > head > style');
				if (style.length == 0)
					$('html > head').append('<style/>');
				$('html > head > style').append('.w2ui-icon.' + encodeURIComponent(button.id) +
					'{background: url("' + encodeURI(button.imgurl) + '") no-repeat center !important; }');

				// Position: Either specified by the caller, or defaulting to first position (before save)
				var insertBefore = button.insertBefore || 'save';
				// add the item to the toolbar
				w2ui['editbar'].insert(insertBefore, [
					{
						type: 'button',
						uno: button.unoCommand,
						id: button.id,
						img: button.id,
						hint: _(button.hint.replaceAll('\"', '&quot;')), /* "Try" to localize ! */
						/* Notify the host back when button is clicked (only when unoCommand is not set) */
						postmessage: !Object.prototype.hasOwnProperty.call(button, 'unoCommand')
					}
				]);
				if (button.mobile)
				{
					// Add to our list of items to preserve when in mobile mode
					// FIXME: Wrap the toolbar in a class so that we don't make use
					// global variables and functions like this
					var idx = toolbarUpMobileItems.indexOf(insertBefore);
					toolbarUpMobileItems.splice(idx, 0, button.id);
				}
			}
			else if (this.map.isReadOnlyMode()) {
				// Just add a menu entry for it
				this.map.fire('addmenu', {id: button.id, label: button.hint});
			}
		}
	},

	// called by the WOPI API to register new custom button
	insertButton: function(button) {
		for (var i in this.customButtons) {
			var item = this.customButtons[i];
			if (item.id === button.id)
				return;
		}

		this.customButtons.push(button);
		this.insertCustomButton(button);
	},

	// insert custom button to the current UI
	insertCustomButton: function(button) {
		if (button.tablet === false && window.mode.isTablet()) {
			return;
		}
		if (!this.notebookbar)
			this.insertButtonToClassicToolbar(button);
		else
			this.notebookbar.insertButtonToShortcuts(button);
	},

	// add all custom buttons to the current UI - on view mode change
	insertCustomButtons: function() {
		for (var i in this.customButtons)
			this.insertCustomButton(this.customButtons[i]);
	},

	showButtonInClassicToolbar: function(buttonId, show) {
		var toolbars = [w2ui['toolbar-up'], w2ui['actionbar'], w2ui['editbar']];
		var found = false;

		toolbars.forEach(function(toolbar) {
			if (toolbar && toolbar.get(buttonId)) {
				found = true;
				if (show) {
					toolbar.show(buttonId);
				} else {
					toolbar.hide(buttonId);
				}
			}
		});

		if (!found) {
			window.app.console.error('Toolbar button with id "' + buttonId + '" not found.');
			return;
		}
	},

	showButton: function(buttonId, show) {
		if (!this.notebookbar) {
			this.showButtonInClassicToolbar(buttonId, show);
		} else {
			if (show) {
				delete this.hiddenButtons[buttonId];
			} else {
				this.hiddenButtons[buttonId] = true;
			}
			this.notebookbar.reloadShortcutsBar();
			this.notebookbar.showNotebookbarButton(buttonId, show);
		}
	},

	isButtonVisible: function(buttonId) {
		return !(buttonId in this.hiddenButtons);
	},

	// Commands

	showCommandInMenubar: function(command, show) {
		var menubar = this._map.menubar;
		if (show) {
			menubar.showUnoItem(command);
		} else {
			menubar.hideUnoItem(command);
		}
	},

	showCommandInClassicToolbar: function(command, show) {
		var toolbars = [w2ui['toolbar-up'], w2ui['actionbar'], w2ui['editbar']];
		var found = false;

		toolbars.forEach(function(toolbar) {
			if (!toolbar)
				return;
			toolbar.items.forEach(function(item) {
				var commands = this.map._extractCommand(item);
				if (commands.indexOf(command) != -1) {
					found = true;
					if (show) {
						toolbar.show(item.id);
					} else {
						toolbar.hide(item.id);
					}
				}
			}.bind(this));
		}.bind(this));

		if (!found) {
			window.app.console.error('Toolbar item with command "' + command + '" not found.');
			return;
		}
	},

	showCommand: function(command, show) {
		if (show) {
			delete this.hiddenCommands[command];
		} else {
			this.hiddenCommands[command] = true;
		}
		if (!this.notebookbar) {
			this.showCommandInClassicToolbar(command, show);
			this.showCommandInMenubar(command, show);
		} else {
			this.notebookbar.reloadShortcutsBar();
			this.notebookbar.showNotebookbarCommand(command, show);
		}
	},

	isCommandVisible: function(command) {
		return !(command in this.hiddenCommands);
	},

	// Menubar

	showMenubar: function() {
		this._menubarShouldBeHidden = false;
		if (!this.isMenubarHidden())
			return;
		$('.main-nav').show();
		if (L.Params.closeButtonEnabled && !window.mode.isTablet()) {
			$('#closebuttonwrapper').show();
		}

		var obj = $('.unfold');
		obj.removeClass('w2ui-icon unfold');
		obj.addClass('w2ui-icon fold');
		$('#tb_editbar_item_fold').prop('title', _('Hide Menu'));

		if (this._notebookbarShouldBeCollapsed)
			this.collapseNotebookbar();
	},

	hideMenubar: function() {
		this._menubarShouldBeHidden = true;
		if (this.isMenubarHidden() || this.shouldUseNotebookbarMode())
			return;

		var notebookbarWasCollapsed = this.isNotebookbarCollapsed();
		this.extendNotebookbar();  // The notebookbar has the button to show the menu bar, so having it hidden at the same time softlocks you
		this._notebookbarShouldBeCollapsed = notebookbarWasCollapsed;

		$('.main-nav').hide();
		if (L.Params.closeButtonEnabled) {
			$('#closebuttonwrapper').hide();
		}

		var obj = $('.fold');
		obj.removeClass('w2ui-icon fold');
		obj.addClass('w2ui-icon unfold');
		$('#tb_editbar_item_fold').prop('title', _('Show Menu'));
	},

	isMenubarHidden: function() {
		return $('.main-nav').css('display') === 'none';
	},

	toggleMenubar: function() {
		if (this.isMenubarHidden())
			this.showMenubar();
		else
			this.hideMenubar();
	},

	// Ruler

	showRuler: function() {
		$('.cool-ruler').show();
		$('#map').addClass('hasruler');
		this.setSavedState('ShowRuler', true);
		this.map.fire('rulerchanged');
	},

	hideRuler: function() {
		$('.cool-ruler').hide();
		$('#map').removeClass('hasruler');
		this.setSavedState('ShowRuler', false);
		this.map.fire('rulerchanged');
	},

	toggleRuler: function() {
		if (this.isRulerVisible())
			this.hideRuler();
		else
			this.showRuler();
	},

	isRulerVisible: function() {
		return $('.cool-ruler').is(':visible');
	},

	isFullscreen: function() {
		if (!document.fullscreenElement &&
			!document.mozFullscreenElement &&
			!document.msFullscreenElement &&
			!document.webkitFullscreenElement)
			return false;
		else
			return true;
	},

	// Notebookbar helpers

	hasNotebookbarShown: function() {
		return $('#map').hasClass('notebookbar-opened');
	},

	makeSpaceForNotebookbar: function() {
		if (this.hasNotebookbarShown())
			return;

		$('#map').addClass('notebookbar-opened');
	},

	collapseNotebookbar: function() {
		this._notebookbarShouldBeCollapsed = true;

		if (this.isNotebookbarCollapsed() || this.isMenubarHidden())
			return;

		this.moveObjectVertically($('#formulabar'), -1);
		$('#toolbar-wrapper').css('display', 'none');

		$('#document-container').addClass('tabs-collapsed');

		this.map._docLayer._syncTileContainerSize();
	},

	extendNotebookbar: function() {
		this._notebookbarShouldBeCollapsed = false;

		if (!this.isNotebookbarCollapsed())
			return;

		this.moveObjectVertically($('#formulabar'), 1);
		$('#toolbar-wrapper').css('display', '');

		$('#document-container').removeClass('tabs-collapsed');

		this.map._docLayer._syncTileContainerSize();
	},

	isNotebookbarCollapsed: function() {
		return $('#document-container').hasClass('tabs-collapsed');
	},

	// UI Defaults functions

	showStatusBar: function() {
		$('#document-container').css('bottom', this.documentBottom);
		$('#toolbar-down').show();
		this.setSavedState('ShowStatusbar', true);
		this.map.fire('statusbarchanged');
	},

	hideStatusBar: function(firstStart) {
		if (!firstStart && !this.isStatusBarVisible())
			return;

		this.documentBottom = $('#document-container').css('bottom');
		$('#document-container').css('bottom', '0px');
		$('#toolbar-down').hide();
		if (!firstStart)
			this.setSavedState('ShowStatusbar', false);
		this.map.fire('statusbarchanged');
	},

	toggleStatusBar: function() {
		if (this.isStatusBarVisible())
			this.hideStatusBar();
		else
			this.showStatusBar();
	},

	focusSearch: function() {
		this.showStatusBar();
		document.getElementById('search-input').focus();
	},

	isStatusBarVisible: function() {
		return $('#toolbar-down').is(':visible');
	},

	// Event handlers

	onUpdatePermission: function(e) {
		if (window.mode.isMobile()) {
			if (e.perm === 'edit') {
				history.pushState({context: 'app-started'}, 'edit-mode');
				$('#toolbar-down').show();
			}
			else {
				history.pushState({context: 'app-started'}, 'readonly-mode');
				$('#toolbar-down').hide();
			}
		}

		var enableNotebookbar = this.shouldUseNotebookbarMode();
		if (enableNotebookbar && !window.mode.isMobile()) {
			if (e.perm === 'edit') {
				if (this.map.menubar) {
					this.map.removeControl(this.map.menubar);
					this.map.menubar = null;
				}
				this.makeSpaceForNotebookbar();
			} else if (e.perm === 'readonly') {
				if (!this.map.menubar) {
					var menubar = L.control.menubar();
					this.map.menubar = menubar;
					this.map.addControl(menubar);
				}

				if (this.notebookbar && $('#mobile-edit-button').is(':hidden')) {
					this.map.removeControl(this.notebookbar);
					this.notebookbar = null;
				}
			} else {
				app.socket.sendMessage('uno .uno:SidebarHide');
			}
		}

		// We've resized the document container.
		this.map.invalidateSize();
	},

	onUpdateViews: function () {
		if (!this.map._docLayer)
			return;

		var myViewId = this.map._docLayer._viewId;
		var myViewData = this.map._viewInfo[myViewId];
		if (!myViewData) {
			console.error('Not found view data for viewId: "' + myViewId + '"');
			return;
		}

		var userPrivateInfo = myViewData.userprivateinfo;
		if (userPrivateInfo) {
			var apiKey = userPrivateInfo.ZoteroAPIKey;
			if (apiKey !== undefined && !this.map.zotero) {
				this.map.zotero = L.control.zotero(this.map);
				this.map.zotero.apiKey = apiKey;
				this.map.addControl(this.map.zotero);
				this.map.zotero.updateUserID();
			}
		}
	},

	enterReadonlyOrClose: function() {
		if (this.map.isEditMode()) {
			// in edit mode, passing 'edit' actually enters readonly mode
			// and bring the blue circle editmode button back
			this.map.setPermission('edit');
			var toolbar = w2ui['actionbar'];
			if (toolbar) {
				toolbar.uncheck('closemobile');
				toolbar.uncheck('close');
			}
		} else {
			window.onClose();
		}
	},

	onGoBack: function(popStateEvent) {
		if (popStateEvent.state && popStateEvent.state.context) {
			if (popStateEvent.state.context === 'mobile-wizard' && this.mobileWizard) {
				if (this.mobileWizard.isOpen()) {
					this.mobileWizard.goLevelUp(true);
				} else {
					this.enterReadonlyOrClose();
				}
			} else if (popStateEvent.state.context === 'app-started') {
				this.enterReadonlyOrClose();
			}
		}
	},

	// Blocking UI

	isUIBlocked: function() {
		return this.blockedUI;
	},

	blockUI: function(event) {
		this.blockedUI = true;
		this.map.fire('showbusy', {label: event ? event.message : null});
	},

	unblockUI: function() {
		this.blockedUI = false;
		this.map.fire('hidebusy');
	},

	// Document area tooltip

	/// Shows general tooltips in the document area
	/// tooltipInfo contains rectangle (position in twips) and text properties
	showDocumentTooltip: function(tooltipInfo) {
		var split = tooltipInfo.rectangle.split(',');
		var latlng = this.map._docLayer._twipsToLatLng(new L.Point(+split[0], +split[1]));
		var pt = this.map.latLngToContainerPoint(latlng);
		var elem = $('.leaflet-layer');

		elem.tooltip();
		elem.tooltip('enable');
		elem.tooltip('option', 'content', tooltipInfo.text);
		elem.tooltip('option', 'items', elem[0]);
		elem.tooltip('option', 'position', { my: 'left bottom',  at: 'left+' + pt.x + ' top+' + pt.y, collision: 'fit fit' });
		elem.tooltip('open');
		document.addEventListener('mousemove', function() {
			elem.tooltip('close');
			elem.tooltip('disable');
		}, {once: true});
	},

	// Calc function tooltip

	/// Shows tooltip over the cell while typing a function in a cell.
	/// tooltipInfo contains possible function list. If you type a valid
	/// function it'll show the usage of the function.
	showFormulaTooltip: function(tooltipInfo, pos) {
		var elem = $('.leaflet-layer');
		var pt = this.map.latLngToContainerPoint(pos);
		pt.y -=35; //Show tooltip above the cursor.

		if ($('.ui-tooltip').length > 0) {
			elem.tooltip('option', 'content', tooltipInfo);
		}
		else {
			elem.tooltip({
				tooltipClass: 'functiontooltip',
				content: tooltipInfo,
				items: elem[0],
                position: { my: 'left top', at: 'left+' + pt.x +  ' top+' +pt.y, collision: 'fit fit' }
			});
			elem.tooltip('option', 'customClass', 'functiontooltip');
			elem.tooltip('open');
			elem.off('mouseleave');
		}
	},

	hideFormulaTooltip: function() {
		var elem = $('.leaflet-layer');
		if ($('.ui-tooltip').length > 0)
			elem.tooltip('option', 'disabled', true);
	},

	// Snack bar

	closeSnackbar: function() {
		var closeMessage = { id: 'snackbar', jsontype: 'dialog', type: 'snackbar', action: 'close' };
		app.socket._onMessage({ textMsg: 'jsdialog: ' + JSON.stringify(closeMessage) });
	},

	showSnackbar: function(label, action, callback, timeout, hasProgress, withDismiss) {
		if (!app.socket)
			return;

		this.closeSnackbar();

		var buttonId = 'button';
		var labelId = 'label';

		var json = {
			id: 'snackbar',
			jsontype: 'dialog',
			type: 'snackbar',
			timeout: timeout,
			'init_focus_id': action ? buttonId : undefined,
			children: [
				{
					id: hasProgress ? 'snackbar-container-progress' : 'snackbar-container',
					type: 'container',
					children: [
						action ? {id: labelId, type: 'fixedtext', text: label, labelFor: buttonId} : {id: 'label-no-action', type: 'fixedtext', text: label},
						withDismiss ? {id: 'snackbar-dismiss-button', type: 'pushbutton', text: _('Dismiss')} : {},
						hasProgress ? {id: 'progress', type: 'progressbar', value: 0, maxValue: 100} : {},
						action ? {id: buttonId, type: 'pushbutton', text: action, labelledBy: labelId} : {}
					]
				}
			]
		};

		var that = this;
		var builderCallback = function(objectType, eventType, object, data) {
			window.app.console.debug('control: \'' + objectType + '\' id:\'' + object.id + '\' event: \'' + eventType + '\' state: \'' + data + '\'');

			if (object.id === buttonId && objectType === 'pushbutton' && eventType === 'click') {
				if (callback)
					callback();

				that.closeSnackbar();
			} else if (object.id === '__POPOVER__' && objectType === 'popover' && eventType === 'close') {
				that.closeSnackbar();
			}

			if (object.id === 'snackbar-dismiss-button' && objectType === 'pushbutton' && eventType === 'click') {
				that.closeSnackbar();
			}
		};

		app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json), callback: builderCallback});
	},

	/// shows snackbar with progress
	showProgressBar: function(message, buttonText, callback, timeout, withDismiss) {
		this.showSnackbar(message, buttonText, callback, timeout ? timeout : -1, true, withDismiss);
	},

	/// sets progressbar status, value should be in range 0-100
	setSnackbarProgress: function(value) {
		if (!app.socket)
			return;

		var json = {
			id: 'snackbar',
			jsontype: 'dialog',
			type: 'snackbar',
			action: 'update',
			control: {
				id: 'progress',
				type: 'progressbar',
				value: value,
				maxValue: 100
			}
		};

		app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json)});
	},

	// Modals

	/// shows modal dialog
	/// json - JSON for building the dialog
	/// callbacks - array of { id: widgetId, type: eventType, func: functionToCall }
	showModal: function(json, callbacks, cancelButtonId) {
		var that = this;
		var builderCallback = function(objectType, eventType, object, data) {
			window.app.console.debug('modal action: \'' + objectType + '\' id:\'' + object.id + '\' event: \'' + eventType + '\' state: \'' + data + '\'');

			// default close methods
			callbacks.push({id: (cancelButtonId ? cancelButtonId: 'response-cancel'), func: function() { that.closeModal(json.id); }});
			callbacks.push({id: '__POPOVER__', func: function() { that.closeModal(json.id); }});

			for (var i in callbacks) {
				var callback = callbacks[i];
				if (object.id === callback.id && (!callback.type || eventType === callback.type)) {
					callback.func();
				}
			}
		};

		app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json), callback: builderCallback});
	},

	closeModal: function(dialogId) {
		var closeMessage = { id: dialogId, jsontype: 'dialog', type: 'modalpopup', action: 'close' };
		app.socket._onMessage({ textMsg: 'jsdialog: ' + JSON.stringify(closeMessage) });
	},

	closeAll: function() {
		if (this.map.jsdialog)
			this.map.jsdialog.closeAll();
		else
			this.mobileWizard._closeWizard();
	},

	isAnyDialogOpen: function() {
		if (this.map.jsdialog)
			return this.map.jsdialog.hasDialogOpened();
		else
			return this.mobileWizard.isOpen();
	},

	// TODO: remove and use JSDialog.generateModalId directly
	generateModalId: function(givenId) {
		return JSDialog.generateModalId(givenId);
	},

	_modalDialogJSON: function(id, title, cancellable, widgets, focusId, clickToDismiss) {
		var dialogId = this.generateModalId(id);
		focusId = focusId ? focusId : 'response';
		return {
			id: dialogId,
			dialogid: id,
			type: 'modalpopup',
			title: title,
			hasClose: true,
			hasOverlay: true,
			cancellable: cancellable,
			jsontype: 'dialog',
			'init_focus_id': focusId,
			clickToDismiss: clickToDismiss,
			children: [
				{
					id: 'info-modal-container',
					type: 'container',
					vertical: true,
					children: widgets,
				},
			]
		};
	},

	/// DEPRECATED: use JSDialog.showInfoModalWithOptions instead
	/// shows simple info modal (message + ok button)
	/// When called with just an id (one argument), the popup will be click dismissable.
	/// id - id of a dialog
	/// title - title of a dialog
	/// message1 - 1st line of message
	/// message2 - 2nd line of message
	/// buttonText - text inside button
	/// callback - callback on button press
	/// withCancel - specifies if needs cancal button also
	showInfoModal: function(id, title, message1, message2, buttonText, callback, withCancel, focusId) {
		var dialogId = this.generateModalId(id);
		var responseButtonId = id + '-response';
		var cancelButtonId = id + '-cancel';
		// If called with only id, then we want clickToDismiss.
		var clickToDismiss = arguments.length < 2;

		var json = this._modalDialogJSON(id, title, true, [
			{
				id: 'info-modal-tile-m',
				type: 'fixedtext',
				text: title,
				hidden: !window.mode.isMobile()
			},
			{
				id: 'info-modal-label1',
				type: 'fixedtext',
				text: message1
			},
			{
				id: 'info-modal-label2',
				type: 'fixedtext',
				text: message2
			},
			{
				id: '',
				type: 'buttonbox',
				text: '',
				enabled: true,
				children: [
					withCancel ? {
						id: cancelButtonId,
						type: 'pushbutton',
						text: _('Cancel')
					} : { type: 'container' },
					{
						id: responseButtonId,
						type: 'pushbutton',
						text: buttonText,
						'has_default': true,
						hidden: buttonText ? false: true // Hide if no text is given. So we can use one modal type for various purposes.
					}
				],
				vertical: false,
				layoutstyle: 'end'
			},
		], focusId, clickToDismiss);

		var that = this;
		this.showModal(json, [
			{id: responseButtonId, func: function() {
				var dontClose = false;
				if (typeof callback === 'function')
					dontClose = callback();
				if (!dontClose)
					that.closeModal(dialogId);
			}}
		], cancelButtonId);
		if (!buttonText && !withCancel) {
			// if no buttons better to set tabIndex to negative so the element is not reachable via sequential keyboard navigation but can be focused programatically
			document.getElementById(dialogId).tabIndex = -1;
			// We hid the OK button, we need to set focus manually on the popup.
			document.getElementById(dialogId).focus();
			document.getElementById(dialogId).className += ' focus-hidden';
		}
	},

	/// shows modal dialog with progress
	showProgressBarDialog: function(id, title, message, buttonText, callback, value, cancelCallback) {
		var dialogId = this.generateModalId(id);
		var responseButtonId = id + '-response';
		var cancelButtonId = id + '-cancel';

		var json = this._modalDialogJSON(id, title, true, [
			{
				id: 'info-modal-tile-m',
				type: 'fixedtext',
				text: title,
				hidden: !window.mode.isMobile()
			},
			{
				id: 'info-modal-label1',
				type: 'fixedtext',
				text: message
			},
			{
				id: dialogId + '-progressbar',
				type: 'progressbar',
				value: (value !== undefined && value !== null ? value: 0),
				maxValue: 100
			},
			{
				id: '',
				type: 'buttonbox',
				text: '',
				enabled: true,
				children: [
					{
						id: cancelButtonId,
						type: 'pushbutton',
						text: _('Cancel')
					},
					{
						id: responseButtonId,
						type: 'pushbutton',
						text: buttonText,
						'has_default': true,
						hidden: buttonText ? false: true // Hide if no text is given. So we can use one modal type for various purposes.
					}
				],
				vertical: false,
				layoutstyle: 'end'
			},
		], buttonText ? responseButtonId : cancelButtonId);

		var that = this;
		this.showModal(json, [
			{id: responseButtonId, func: function() {
				var dontClose = false;
				if (typeof callback === 'function')
					dontClose = callback();
				if (!dontClose)
					that.closeModal(dialogId);
			}},
			{id: cancelButtonId, func: function() {
				if (typeof cancelCallback === 'function')
					cancelCallback();
			}}
		], cancelButtonId);
	},

	/// sets progressbar status, value should be in range 0-100
	setDialogProgress: function(id, value) {
		if (!app.socket)
			return;

		var dialogId = this.generateModalId(id);

		var json = {
			id: dialogId,
			jsontype: 'dialog',
			type: 'modalpopup',
			action: 'update',
			control: {
				id: dialogId + '-progressbar',
				type: 'progressbar',
				value: value,
				maxValue: 100
			}
		};

		app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json)});
	},

	/// buttonObjectList: [{id: button's id, text: button's text, ..other properties if needed}, ...]
	/// callbackList: [{id: button's id, func_: function}, ...]
	showModalWithCustomButtons: function(id, title, message, cancellable, buttonObjectList, callbackList) {
		var dialogId = this.generateModalId(id);

		for (var i = 0; i < buttonObjectList.length; i++)
			buttonObjectList[i].type = 'pushbutton';

		var json = this._modalDialogJSON(id, title, !!cancellable, [
			{
				id: 'info-modal-tile-m',
				type: 'fixedtext',
				text: title,
				hidden: !window.mode.isMobile()
			},
			{
				id: 'info-modal-label1',
				type: 'fixedtext',
				text: message
			},
			{
				id: '',
				type: 'buttonbox',
				text: '',
				enabled: true,
				children: buttonObjectList,
				vertical: false,
				layoutstyle: 'end'
			},
		]);

		buttonObjectList.forEach(function(button) {
			callbackList.forEach(function(callback) {
				if (button.id === callback.id) {
					if (typeof callback.func_ === 'function') {
						callback.func = function() {
							callback.func_();
							this.closeModal(dialogId);
						}.bind(this);
					}
					else
						callback.func = function() { this.closeModal(dialogId); }.bind(this);
				}
			}.bind(this));
		}.bind(this));

		this.showModal(json, callbackList);
	},

	/// shows simple input modal (message + input + (cancel + ok) button)
	/// id - id of a dialog
	/// title - title of a dialog
	/// message - message
	/// defaultValue - default value of an input
	/// buttonText - text inside OK button
	/// callback - callback on button press
	showInputModal: function(id, title, message, defaultValue, buttonText, callback, passwordInput) {
		var dialogId = this.generateModalId(id);
		var json = this._modalDialogJSON(id, title, !window.mode.isDesktop(), [
			{
				id: 'info-modal-label1',
				type: 'fixedtext',
				text: message,
				labelFor: 'input-modal-input',
			},
			{
				id: 'input-modal-input',
				type: 'edit',
				password: !!passwordInput,
				text: defaultValue,
				labelledBy: 'info-modal-label1'
			},
			{
				id: '',
				type: 'buttonbox',
				text: '',
				enabled: true,
				children: [
					{
						id: 'response-cancel',
						type: 'pushbutton',
						text: _('Cancel'),
					},
					{
						id: 'response-ok',
						type: 'pushbutton',
						text: buttonText,
						'has_default': true,
					}
				],
				vertical: false,
				layoutstyle: 'end'
			},
		], 'input-modal-input');

		var that = this;
		this.showModal(json, [
			{id: 'response-ok', func: function() {
				if (typeof callback === 'function') {
					var input = document.getElementById('input-modal-input');
					callback(input.value);
				}
				that.closeModal(dialogId);
			}}
		]);
	},

	/// Shows an info bar at the bottom right of the view.
	/// This is called by map.fire('infobar', {data}).
	showInfoBar: function(e) {

		var message = e.msg;
		var link = e.action;
		var linkText = e.actionLabel;

		var id = 'infobar' + Math.round(Math.random() * 10);
		var dialogId = this.generateModalId(id);
		var json = this._modalDialogJSON(id, ' ', !window.mode.isDesktop(), [
			{
				id: dialogId + '-text',
				type: 'fixedtext',
				text: message
			},
		]);

		this.showModal(json);

		if (!window.mode.isMobile()) {
			document.getElementById(dialogId).style.marginRight = '0';
			document.getElementById(dialogId).style.marginBottom = '0';
		}

		if (link && linkText) {
			document.getElementById(dialogId + '-text').style.textDecoration = 'underline';
			document.getElementById(dialogId + '-text').onclick = function() {
				var win = window.open(link, '_blank');
				win.focus();
			};
		}
	},

	// Opens a yesno modal with configurable buttons.
	showYesNoButton: function(id, title, message, yesButtonText, noButtonText, yesFunction, noFunction, cancellable) {
		var dialogId = this.generateModalId(id);

		var json = this._modalDialogJSON(id, title, cancellable, [
			{
				id:  dialogId + '-title',
				type: 'fixedtext',
				text: title,
				hidden: !window.mode.isMobile()
			},
			{
				id: dialogId + '-label',
				type: 'fixedtext',
				text: message
			},
			{
				id: '',
				type: 'buttonbox',
				text: '',
				enabled: true,
				children: [
					noButtonText ? {
						id: dialogId + '-nobutton',
						type: 'pushbutton',
						text: noButtonText
					} : { type: 'container' },
					{
						id: dialogId + '-yesbutton',
						type: 'pushbutton',
						text: yesButtonText,
					}
				],
				vertical: false,
				layoutstyle: 'end'
			},
		]);

		this.showModal(json,
		[
			{
				id: dialogId + '-nobutton',
				func: function() {
					if (typeof noFunction === 'function')
						noFunction();
					this.closeModal(dialogId);
				}.bind(this)
			},
			{
				id: dialogId + '-yesbutton',
				func: function() {
					if (typeof yesFunction === 'function')
						yesFunction();
					this.closeModal(dialogId);
				}.bind(this)
			}
		]);
	},

	/// shows simple confirm modal (message + (cancel + ok) button)
	/// id - id of a dialog
	/// title - title of a dialog
	/// message - message
	/// buttonText - text inside OK button
	/// callback - callback on button press
	showConfirmModal: function(id, title, message, buttonText, callback, hideCancelButton) {
		var dialogId = this.generateModalId(id);
		var json = this._modalDialogJSON(id, title, !window.mode.isDesktop(), [
			{
				id: 'info-modal-label1',
				type: 'fixedtext',
				text: message
			},
			{
				id: '',
				type: 'buttonbox',
				text: '',
				enabled: true,
				children: [
					{
						id: 'response-cancel',
						type: 'pushbutton',
						text: _('Cancel'),
						hidden: hideCancelButton === true ? true: false
					},
					{
						id: 'response-ok',
						type: 'pushbutton',
						text: buttonText,
						'has_default': true,
					}
				],
				vertical: false,
				layoutstyle: 'end'
			},
		]);

		var that = this;
		this.showModal(json, [
			{id: 'response-ok', func: function() {
				if (typeof callback === 'function') {
					callback();
				}
				that.closeModal(dialogId);
			}}
		]);
	},

	// Helper functions

	moveObjectVertically: function(obj, diff) {
		if (obj) {
			var prevTop = obj.css('top');
			if (prevTop) {
				prevTop = parseInt(prevTop.slice(0, -2)) + diff;
			}
			else {
				prevTop = 0 + diff;
			}
			obj.css({'top': String(prevTop) + 'px'});
		}
	},

	setSavedState: function(name, state) {
		var docType = (name === 'compactMode') ? null : this.map.getDocType();
		if (window.isLocalStorageAllowed)
			localStorage.setItem('UIDefaults_' + docType + '_' + name, state);
	},

	getSavedStateOrDefault: function(name, forcedDefault) {
		var retval = forcedDefault !== undefined ? forcedDefault : true;
		// we request compactMode very early, no info about doctype so unify all the calls
		var docType = (name === 'compactMode') ? null : this.map.getDocType();
		var state = null;
		if (window.savedUIState && window.isLocalStorageAllowed)
			state = localStorage.getItem('UIDefaults_' + docType + '_' + name);
		switch (state) {
		case 'true':
			return true;
		case 'false':
			return false;
		default:
			// no saved state; must check the UIDefaults
			if (window.uiDefaults && window.uiDefaults[docType])
				retval = window.uiDefaults[docType][name];

			// check UIDefaults root without limiting to the doctype
			if (retval === undefined || retval === null)
				retval = window.uiDefaults[name];

			if (retval === undefined || retval === null) {
				if (forcedDefault !== undefined)
					return forcedDefault;
				else
					return true;
			} else
				return retval;
		}
	},

	enableTooltip: function(element) {
		var elem = $(element);
		if (window.mode.isDesktop()) {
			elem.tooltip();
			elem.click(function() {
				$('.ui-tooltip').fadeOut(function() {
					$(this).remove();
				});
			});
		}
		else {
			elem.tooltip({disabled: true});
			(new Hammer(elem.get(0), {recognizers: [[Hammer.Press]]}))
				.on('press', function () {
					elem.tooltip('enable');
					elem.tooltip('open');
					document.addEventListener('touchstart', function closeTooltip () {
						elem.tooltip('close');
						elem.tooltip('disable');
						document.removeEventListener('touchstart', closeTooltip);
					});
				}.bind(this));

		}
	}
});

L.control.uiManager = function () {
	return new L.Control.UIManager();
};
