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

/* global app $ setupToolbar _ JSDialog SlideShow */
L.Control.UIManager = L.Control.extend({
	mobileWizard: null,
	documentNameInput: null,
	blockedUI: false,
	busyPopupTimer: null,
	customButtons: [], // added by WOPI InsertButton
	hiddenButtons: {},
	hiddenCommands: {},
	// Hidden Notebookbar tabs.
	hiddenTabs: {},

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
		app.events.on('updatepermission', this.onUpdatePermission.bind(this));

		if (window.mode.isMobile()) {
			window.addEventListener('popstate', this.onGoBack.bind(this));

			// provide entries in the history we can catch to close the app
			history.pushState({context: 'app-started'}, 'app-started');
			history.pushState({context: 'app-started'}, 'app-started');
		}

		map.on('blockUI', this.blockUI, this);
		map.on('unblockUI', this.unblockUI, this);

		$('#toolbar-wrapper').on('click', function (event) {
			if (event.target.parentElement.id === 'toolbar-up') // checks if clicked on empty part of the toolbar on tabbed view
				that.map.fire('editorgotfocus');
		});

		$('.main-nav').on('click', function (event) {
			if (event.target.parentElement.nodeName === 'NAV' || // checks if clicked on an container of an element
				event.target.nodeName === 'NAV' || // checks if clicked on navigation bar itself
				event.target.parentElement.id === 'document-titlebar') { // checks if clicked on the document titlebar container
				that.map.fire('editorgotfocus');}
		});

		this.map.on('updateviewslist', this.onUpdateViews, this);

		this.map['stateChangeHandler'].setItemValue('toggledarktheme', 'false');
		this.map['stateChangeHandler'].setItemValue('invertbackground', 'false');
		this.map['stateChangeHandler'].setItemValue('showannotations', 'true');
	},

	// UI initialization

	getCurrentMode: function() {
		return this.shouldUseNotebookbarMode() ? 'notebookbar' : 'classic';
	},

	getHighlightMode: function() {
		return window.prefs.getBoolean('ColumnRowHighlightEnabled', false);
	},

	setHighlightMode: function( newState ) {
		window.prefs.set('ColumnRowHighlightEnabled', newState);
		let highlightState = newState? 'true' : 'false';
		this.map['stateChangeHandler'].setItemValue('columnrowhighlight', highlightState);
		this._map.fire('commandstatechanged', {commandName : 'columnrowhighlight', state : highlightState});
	},

	shouldUseNotebookbarMode: function() {
		let forceCompact = window.prefs.getBoolean('compactMode', null);
		// all other cases should default to notebookbar
		let shouldUseClassic = (window.userInterfaceMode === 'classic' && forceCompact == null) || forceCompact === true;
		return !shouldUseClassic;
	},

	// Dark mode toggle

	loadLightMode: function() {
		document.documentElement.setAttribute('data-theme','light');
		this._map.fire('commandstatechanged', {commandName : 'toggledarktheme', state : 'false'});
		this.map.fire('darkmodechanged');
	},

	loadDarkMode: function() {
		document.documentElement.setAttribute('data-theme','dark');
		this._map.fire('commandstatechanged', {commandName : 'toggledarktheme', state : 'true'});
		this.map.fire('darkmodechanged');
	},

	setCanvasColorAfterModeChange: function() {
		if (app.sectionContainer) {
			app.sectionContainer.setBackgroundColorMode(false);

			if (this.map.getDocType() == 'spreadsheet') {
				app.sectionContainer.setClearColor(window.getComputedStyle(document.documentElement).getPropertyValue('--color-background-document'));
			} else {
				app.sectionContainer.setClearColor(window.getComputedStyle(document.documentElement).getPropertyValue('--color-canvas'));
			}

			//change back to it's default value after setting canvas color
			app.sectionContainer.setBackgroundColorMode(true);
		}
	},

	setDarkBackground: function(activate) {
		var cmd = { 'NewTheme': { 'type': 'string', 'value': '' } };
		activate ? cmd.NewTheme.value = 'Dark' : cmd.NewTheme.value = 'Light';
		app.socket.sendMessage('uno .uno:InvertBackground ' + JSON.stringify(cmd));
		this.initDarkBackgroundUI(activate);
	},

	initDarkBackgroundUI: function(activate) {
		document.documentElement.setAttribute('data-bg-theme', activate ? 'dark' : 'light');
		if (activate) {
			this._map.fire('commandstatechanged', {commandName : 'invertbackground', state : 'false'});
		}
		else {
			this._map.fire('commandstatechanged', {commandName : 'invertbackground', state : 'true'});
		}
		this.setCanvasColorAfterModeChange();
	},

	applyInvert: function(skipCore) {
		// get the initial mode
		var backgroundDark = this.isBackgroundDark();

		if (skipCore) {
			this.initDarkBackgroundUI(backgroundDark);
		} else {
			this.setDarkBackground(backgroundDark);
		}
	},

	isBackgroundDark: function() {
		// get the initial mode If document background is inverted or not
		var inDarkTheme = window.prefs.getBoolean('darkTheme');
		var darkBackgroundPrefName = 'darkBackgroundForTheme.' + (inDarkTheme ? 'dark' : 'light');
		var backgroundDark = window.prefs.getBoolean(darkBackgroundPrefName, inDarkTheme);
		return backgroundDark;
	},

	toggleInvert: function() {
		// get the initial mode
		var inDarkTheme = window.prefs.getBoolean('darkTheme');
		var darkBackgroundPrefName = 'darkBackgroundForTheme.' + (inDarkTheme ? 'dark' : 'light');
		var backgroundDark = window.prefs.getBoolean(darkBackgroundPrefName, inDarkTheme);

		// swap them by invoking the appropriate load function and saving the state
		if (backgroundDark) {
			window.prefs.set(darkBackgroundPrefName, false);
			this.setDarkBackground(false);
		}
		else {
			window.prefs.set(darkBackgroundPrefName, true);
			this.setDarkBackground(true);
		}
	},

	toggleDarkMode: function() {
		// get the initial mode
		var inDarkTheme = window.prefs.getBoolean('darkTheme');
		// swap them by invoking the appropriate load function and saving the state
		if (inDarkTheme) {
			window.prefs.set('darkTheme', false);
			this.loadLightMode();
			this.activateDarkModeInCore(false);
		}
		else {
			window.prefs.set('darkTheme', true);
			this.loadDarkMode();
			this.activateDarkModeInCore(true);
		}
		this.applyInvert();
		this.setCanvasColorAfterModeChange();
		if (!window.mode.isMobile())
			this.refreshAfterThemeChange();

		if (app.map._docLayer._docType === 'spreadsheet') {
			const calcGridSection = app.sectionContainer.getSectionWithName(L.CSections.CalcGrid.name);
			if (calcGridSection)
				calcGridSection.resetStrokeStyle();
		}

		this.map.fire('themechanged');
	},

	initDarkModeFromSettings: function() {
		var inDarkTheme = window.prefs.getBoolean('darkTheme');

		if (inDarkTheme) {
			this.loadDarkMode();
		} else {
			this.loadLightMode();
		}

		this.applyInvert(true);
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

	initializeMenubarAndTopToolbar: function () {
		let enableNotebookbar = this.shouldUseNotebookbarMode();
		let isMobile = window.mode.isMobile();
		if (isMobile || !enableNotebookbar) {
			var menubar = L.control.menubar();
			this.map.menubar = menubar;
			this.map.addControl(menubar);
		}

		if (!isMobile && !enableNotebookbar)
			this.map.topToolbar = JSDialog.TopToolbar(this.map);
	},

	initializeBasicUI: function () {
		var that = this;

		this.initializeMenubarAndTopToolbar();

		if (window.mode.isMobile()) {
			$('#toolbar-mobile-back').on('click', function () {
				that.enterReadonlyOrClose();
			});
		}

		if (!window.mode.isMobile()) {
			this.map.statusBar = JSDialog.StatusBar(this.map);

			this.map.sidebar = JSDialog.Sidebar(this.map, {animSpeed: 200});

			this.map.navigator = JSDialog.NavigatorPanel(this.map, { animSpeed: 200 });

			this.map.mention = L.control.mention(this.map);
			this.map.formulaautocomplete = L.control.formulaautocomplete(this.map);
			this.map.formulausage = L.control.formulausage(this.map);
			this.map.autofillpreviewtooltip = L.control.autofillpreviewtooltip(this.map);
		}

		this.map.jsdialog = L.control.jsDialog();
		this.map.addControl(this.map.jsdialog);

		setupToolbar(this.map);

		this.documentNameInput = L.control.documentNameInput();
		this.map.addControl(this.documentNameInput);
		this.map.addControl(L.control.alertDialog());
		if (window.mode.isMobile()) {
			this.mobileWizard = L.control.mobileWizard();
			this.map.addControl(this.mobileWizard);
		}
		this.map.addControl(L.control.languageDialog());
		this.map.dialog = L.control.lokDialog();
		this.map.addControl(this.map.dialog);
		this.map.addControl(L.control.contextMenu());
		this.map.userList = L.control.userList();
		this.map.addControl(this.map.userList);
		this.map.aboutDialog = JSDialog.aboutDialog(this.map);

		if (L.Map.versionBar && window.allowUpdateNotification)
			this.map.addControl(L.Map.versionBar);

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
		document.body.setAttribute('data-docType', docType);

		if (hasShare)
			document.body.setAttribute('data-integratorSidebar', 'true');

		if (window.mode.isMobile()) {
			$('#mobile-edit-button').show();
			this.map.mobileBottomBar = JSDialog.MobileBottomBar(this.map);
			this.map.mobileTopBar = JSDialog.MobileTopBar(this.map);
			this.map.mobileSearchBar = JSDialog.MobileSearchBar(this.map);
		} else if (enableNotebookbar) {
			this.createNotebookbarControl(docType);
			// makeSpaceForNotebookbar call in onUpdatePermission
		}

		if (!window.prefs.getBoolean(`${docType}.ShowToolbar`, true)) {
			this.collapseNotebookbar();
		}

		this.initDarkModeFromSettings();

		if (docType === 'spreadsheet') {
			this.sheetsBar = JSDialog.SheetsBar(this.map, isDesktop || window.mode.isTablet());

			let formulabarRow = document.getElementById('formulabar-row');
			let spreadsheetToolbar = document.getElementById('spreadsheet-toolbar');
			spreadsheetToolbar.classList.remove('hidden');
			formulabarRow.classList.remove('hidden');
			this.map.formulabar = JSDialog.FormulaBar(this.map);
			this.map.addressInputField = JSDialog.AddressInputField(this.map);
			$('#toolbar-wrapper').addClass('spreadsheet');

			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('presentation-controls-wrapper'));
			document.getElementById('selectbackground').parentNode.removeChild(document.getElementById('selectbackground'));

			let highlightState = this.getHighlightMode()? 'true' : 'false';
			this.map['stateChangeHandler'].setItemValue('columnrowhighlight', highlightState);
			this._map.fire('commandstatechanged', {commandName : 'columnrowhighlight', state : highlightState});
		}

		if (this.map.isPresentationOrDrawing()) {
			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('spreadsheet-toolbar'));
			$('#presentation-controls-wrapper').show();
			this.initializeRuler();
			this.map.slideShowPresenter = new SlideShow.SlideShowPresenter(this.map);
			this.map.presenterConsole = new SlideShow.PresenterConsole(this.map, this.map.slideShowPresenter);
		}

		if (docType === 'text') {
			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('spreadsheet-toolbar'));
			L.DomUtil.remove(L.DomUtil.get('presentation-controls-wrapper'));
			document.getElementById('selectbackground').parentNode.removeChild(document.getElementById('selectbackground'));

			this.initializeRuler();

			var showResolved = this.getBooleanDocTypePref('ShowResolved', true);
			if (showResolved === false || showResolved === 'false')
				this.map.sendUnoCommand('.uno:ShowResolvedAnnotations');
			// Notify the initial status of comments
			var initialCommentState = this.map['stateChangeHandler'].getItemValue('showannotations');
			this._map.fire('commandstatechanged', {commandName : 'showannotations', state : initialCommentState});
			this.map.mention = L.control.mention(this.map);
		}

		if (this.map.isPresentationOrDrawing() && (isDesktop || window.mode.isTablet())) {
			JSDialog.PresentationBar(this.map);
		}

		this.map.on('changeuimode', this.onChangeUIMode, this);

		this.refreshTheme();

		var startPresentationGet = this.map.isPresentationOrDrawing() && window.coolParams.get('startPresentation');
		// check for "presentation" dispatch event only after document gets fully loaded
		this.map.on('docloaded', function() {
			if (startPresentationGet === 'true' || startPresentationGet === '1') {
				app.dispatcher.dispatch('presentation');
			}
		});
	},

	initializeSidebar: function() {
		// Hide the sidebar on start if saved state or UIDefault is set.
		if (window.mode.isDesktop() && !window.ThisIsAMobileApp) {
			var showSidebar = this.getBooleanDocTypePref('ShowSidebar', true);

			if (this.getBooleanDocTypePref('PropertyDeck', true)) {
				app.socket.sendMessage('uno .uno:SidebarShow');
			}

			if (this.map.getDocType() === 'presentation') {
				if (this.getBooleanDocTypePref('SdSlideTransitionDeck', false)) {
					app.socket.sendMessage('uno .uno:SidebarShow');
					app.socket.sendMessage('uno .uno:SlideChangeWindow');
					this.map.sidebar.setupTargetDeck('.uno:SlideChangeWindow');
				} else if (this.getBooleanDocTypePref('SdCustomAnimationDeck', false)) {
					app.socket.sendMessage('uno .uno:SidebarShow');
					app.socket.sendMessage('uno .uno:CustomAnimation');
					this.map.sidebar.setupTargetDeck('.uno:CustomAnimation');
				} else if (this.getBooleanDocTypePref('SdMasterPagesDeck', false)) {
					app.socket.sendMessage('uno .uno:SidebarShow');
					app.socket.sendMessage('uno .uno:MasterSlidesPanel');
					this.map.sidebar.setupTargetDeck('.uno:MasterSlidesPanel');
				} else if (this.getBooleanDocTypePref('NavigatorDeck', false)) {
					app.socket.sendMessage('uno .uno:SidebarShow');
					//app.socket.sendMessage('uno .uno:Navigator');
					//this.map.sidebar.setupTargetDeck('.uno:Navigator');
				}
			} else if (this.getBooleanDocTypePref('NavigatorDeck', false)) {
				app.socket.sendMessage('uno .uno:SidebarShow');
				//app.socket.sendMessage('uno .uno:Navigator');
				//this.map.sidebar.setupTargetDeck('.uno:Navigator');
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

	// Initialize ruler
	initializeRuler: function() {
		if ((window.mode.isTablet() || window.mode.isDesktop()) && !app.isReadOnly()) {
			var showRuler = this.getBooleanDocTypePref('ShowRuler');
			var interactiveRuler = this.map.isEditMode();
			// Call the static method from the Ruler class
			app.definitions.ruler.initializeRuler(this.map, {
				interactive: interactiveRuler,
				showruler: showRuler
			});
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
			this.map.topToolbar.onRemove();
			this.map.topToolbar = null;
		}
	},

	addClassicUI: function() {
		this.map.menubar = L.control.menubar();
		this.map.addControl(this.map.menubar);
		this.map.topToolbar = JSDialog.TopToolbar(this.map);

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
		if (this.map.menubar)
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
		// TODO
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

		window.prefs.set('compactMode', uiMode.mode === 'classic');
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
		if (this.map.isEditMode()) {
			// Position: Either specified by the caller, or defaulting to first position (before save)
			var insertBefore = button.insertBefore || 'save';

			var newButton = [
				{
					type: 'button',
					uno: button.unoCommand,
					id: button.id,
					img: button.id,
					hint: _(button.hint.replaceAll('\"', '&quot;')), /* "Try" to localize ! */
					/* Notify the host back when button is clicked (only when unoCommand is not set) */
					postmessage: !Object.prototype.hasOwnProperty.call(button, 'unoCommand')
				}
			];

			// TODO: other
			var topToolbar = window.app.map.topToolbar;
			if (topToolbar && !topToolbar.hasItem(button.id)) {
				// translate to JSDialog JSON
				newButton[0].command = newButton[0].uno;
				newButton[0].type = 'toolitem';
				newButton[0].w2icon = newButton[0].img;
				newButton[0].text = newButton[0].hint;
				topToolbar.insertItem(insertBefore, newButton);

				// updated css rules to show custom button images
				this.setCssRulesForCustomButtons();
			}
		}

		if (this.map.isReadOnlyMode()) {
			// Just add a menu entry for it
			this.map.fire('addmenu', {id: button.id, label: button.hint});
		}
	},

	setCssRulesForCustomButtons: function() {
		for (var button of this.customButtons) {
			const item = document.querySelector(".w2ui-icon." + encodeURIComponent(button.id));
			var imgUrl = button.imgurl;
			if (item) {
				if(button.imgurl === undefined || button.imgurl === "") {
					var iconName = app.LOUtil.getIconNameOfCommand(button.unoCommand);
					imgUrl = app.LOUtil.getImageURL(iconName);
				}
				item.style.background = 'url("' + encodeURI(imgUrl) + '")';
				item.style.backgroundRepeat = 'no-repeat';
				item.style.backgroundPosition = 'center';
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
		// TODO: other
		var toolbars = [];
		var found = false;

		toolbars.forEach(function(toolbar) {
			if (toolbar && toolbar.get(buttonId)) {
				found = true;
				if (show) {
					toolbar.showItem(buttonId, true);
				} else {
					toolbar.showItem(buttonId, false);
				}
			}
		});

		var topToolbarHas = window.app.map.topToolbar.hasItem(buttonId);
		found = found | topToolbarHas;
		if (topToolbarHas)
			window.app.map.topToolbar.showItem(buttonId, show);

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
		// TODO: other
		var toolbars = [];
		var found = false;

		toolbars.forEach(function(toolbar) {
			if (!toolbar)
				return;
			toolbar.items.forEach(function(item) {
				var commands = this.map._extractCommand(item);
				if (commands.indexOf(command) != -1) {
					found = true;
					if (show) {
						toolbar.showItem(item.id, true);
					} else {
						toolbar.showItem(item.id, false);
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
			$('#closebuttonwrapperseparator').show();
		}
		const obj = document.getElementById('fold-button');
		obj.style.transform = 'rotate(0deg)';

		$('#fold').prop('title', _('Hide Menu'));

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
			$('#closebuttonwrapperseparator').hide();
		}
		const obj = document.getElementById('fold-button');
		obj.style.transform = 'rotate(180deg)';

		$('#fold').prop('title', _('Show Menu'));
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
		this._map.sendUnoCommand('.uno:ShowRuler');
		$('.cool-ruler').show();
		$('#map').addClass('hasruler');
		this.setDocTypePref('ShowRuler', true);
		this.map.fire('rulerchanged');
	},

	hideRuler: function() {
		$('.cool-ruler').hide();
		$('#map').removeClass('hasruler');
		this.setDocTypePref('ShowRuler', false);
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

	showNotebookTab: function(id, show) {
		if (show) {
			delete this.hiddenTabs[id];
		} else {
			this.hiddenTabs[id] = true;
		}
		if (this.notebookbar) {
			this.notebookbar.refreshContextTabsVisibility();
		}
	},

	isTabVisible: function(name) {
		return !(name in this.hiddenTabs);
	},

	isNotebookbarCollapsed: function() {
		return $('#document-container').hasClass('tabs-collapsed');
	},

	// UI Defaults functions

	showStatusBar: function() {
		$('#document-container').css('bottom', this.documentBottom);
		this.map.statusBar.show();
		this.setDocTypePref('ShowStatusbar', true);
		this.map.fire('statusbarchanged');
	},

	hideStatusBar: function(firstStart) {
		if (!firstStart && !this.isStatusBarVisible())
			return;

		this.documentBottom = $('#document-container').css('bottom');
		$('#document-container').css('bottom', '0px');
		this.map.statusBar.hide();
		if (!firstStart)
			this.setDocTypePref('ShowStatusbar', false);
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
		this.map.fire('focussearch');
	},

	isStatusBarVisible: function() {
		return document.getElementById('toolbar-down').style.display !== 'none';
	},

	// Event handlers

	onUpdatePermission: function(e) {
		if (window.mode.isMobile()) {
			if (e.detail.perm === 'edit') {
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
			if (e.detail.perm === 'edit') {
				if (this.map.menubar) {
					this.map.removeControl(this.map.menubar);
					this.map.menubar = null;
				}
				this.makeSpaceForNotebookbar();
			} else if (e.detail.perm === 'readonly') {
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

	refreshUI: function () {
		if (this.notebookbar && !this.map._shouldStartReadOnly())
			this.refreshNotebookbar();
		else
			this.refreshMenubar();

		this.refreshTheme();
	},

	refreshTheme: function () {
		if (typeof window.initializedUI === 'function') {
			window.initializedUI();
		}
	},

	onUpdateViews: function () {
		if (!this.map._docLayer || typeof this.map._docLayer._viewId === 'undefined')
			return;

		var myViewId = this.map._docLayer._viewId;
		var myViewData = this.map._viewInfo[myViewId];
		if (!myViewData) {
			console.error('Not found view data for viewId: "' + myViewId + '"');
			return;
		}

		var userPrivateInfo = myViewData.userprivateinfo;
		if (userPrivateInfo && window.zoteroEnabled) {
			var apiKey = userPrivateInfo.ZoteroAPIKey;
			if (apiKey !== undefined && !this.map.zotero) {
				this.map.zotero = L.control.zotero(this.map);
				this.map.zotero.apiKey = apiKey;
				this.map.addControl(this.map.zotero);
				this.map.zotero.updateUserID();
			}
		}
		if (window.documentSigningEnabled) {
			if (userPrivateInfo && this.notebookbar) {
				const show = userPrivateInfo.SignatureCert && userPrivateInfo.SignatureKey;
				// Show or hide the signature button on the notebookbar depending on if we
				// have a signing cert/key specified.
				this.showButton('signature', show);
			}
			const serverPrivateInfo = myViewData.serverprivateinfo;
			if (serverPrivateInfo) {
				const baseUrl = serverPrivateInfo.ESignatureBaseUrl;
				const clientId = serverPrivateInfo.ESignatureClientId;
				if (baseUrl !== undefined && !this.map.eSignature) {
					this.map.eSignature = L.control.eSignature(baseUrl, clientId);
				}
			}
		}
	},

	enterReadonlyOrClose: function() {
		if (this.map.isEditMode()) {
			// in edit mode, passing 'edit' actually enters readonly mode
			// and bring the blue circle editmode button back
			this.map.setPermission('edit');
			var toolbar = app.map.topToolbar;
			if (toolbar) {
				toolbar.selectItem('closemobile', false);
				toolbar.selectItem('close', false);
			}
		} else {
			app.dispatcher.dispatch('closeapp');
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

	_setTooltipText: function(element, text) {
		var dummyNode = L.DomUtil.create('div');
		dummyNode.innerText = text;
		element.tooltip('option', 'content', dummyNode.innerHTML);
	},

	/// Shows general tooltips in the document area
	/// tooltipInfo contains rectangle (position in twips) and text properties
	showDocumentTooltip: function(tooltipInfo) {
		var split = tooltipInfo.rectangle.split(',');
		var latlng = this.map._docLayer._twipsToLatLng(new L.Point(+split[0], +split[1]));
		var pt = this.map.latLngToContainerPoint(latlng);
		var elem = $('.leaflet-layer');

		elem.tooltip();
		elem.tooltip('enable');
		this._setTooltipText(elem, tooltipInfo.text);
		elem.tooltip('option', 'items', elem[0]);
		elem.tooltip('option', 'position', { my: 'left bottom',  at: 'left+' + pt.x + ' top+' + pt.y, collision: 'fit fit' });
		elem.tooltip('open');
		document.addEventListener('mousemove', function() {
			elem.tooltip('close');
			elem.tooltip('disable');
		}, {once: true});
	},

	// Snack bar

	closeSnackbar: function() {
		JSDialog.SnackbarController.closeSnackbar();
	},

	showSnackbar: function(label, action, callback, timeout, hasProgress, withDismiss) {
		JSDialog.SnackbarController.showSnackbar(label, action, callback, timeout, hasProgress, withDismiss);
	},

	/// shows snackbar with progress
	showProgressBar: function(message, buttonText, callback, timeout, withDismiss) {
		JSDialog.SnackbarController.showSnackbar(message, buttonText, callback, timeout ? timeout : -1, true, withDismiss);
	},

	/// sets progressbar status, value should be in range 0-100
	setSnackbarProgress: function(value) {
		JSDialog.SnackbarController.setSnackbarProgress(value);
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
					callback.func(objectType, eventType, object, data);
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
	/// withCancel - specifies if needs cancel button also
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
				labelFor: 'input-modal',
			},
			{
				id: 'input-modal',
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
			{
				id: '',
				type: 'buttonbox',
				text: '',
				enabled: true,
				children: [
					{
						id: dialogId + '-response',
						type: 'pushbutton',
						text: _(linkText),
						'has_default': true,
					}
				],
				vertical: false,
				layoutstyle: 'end'
			},
		]);

		this.showModal(json,
		[{
			id : dialogId + '-response',
			func : () => {
				if (!link || !linkText)
					return;
				var win = window.open(window.sanitizeUrl(link), '_blank');
				win.focus();
			}
		}]);

		if (!window.mode.isMobile()) {
			document.getElementById(dialogId).style.marginRight = '0';
			document.getElementById(dialogId).style.marginBottom = '0';
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

	setDocTypePref: function(name, value) {
		const docType = this.map.getDocType();
		return window.prefs.set(`${docType}.${name}`, value);
	},

	getBooleanDocTypePref: function(name, defaultValue = false) {
		const docType = this.map.getDocType();
		return window.prefs.getBoolean(`${docType}.${name}`, defaultValue);
	},
});

L.control.uiManager = function () {
	return new L.Control.UIManager();
};
