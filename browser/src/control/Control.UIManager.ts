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

/**
 * Type for the toolbar button configuration.
 */
interface ToolbarButton {
	type: string;
	uno: string;
	id: string;
	img: string;
	hint: string;
	postmessage: boolean;
	command?: string; // Optional because it's added later
	w2icon?: string; // Optional because it's added later
	text?: string; // Optional because it's added later
}

/**
 * UIManager class – initializes UI elements (toolbars, menubar, ruler, etc.) and controls their visibility.
 */
class UIManager extends L.Control {
	mobileWizard: any = null;
	documentNameInput: any = null;
	blockedUI: any = false;
	busyPopupTimer: number | null = null;
	customButtons: any[] = []; // added by WOPI InsertButton
	hiddenButtons: { [key: string]: boolean } = {};
	hiddenCommands: { [key: string]: boolean } = {};
	// Hidden Notebookbar tabs.
	hiddenTabs: { [key: string]: boolean } = {};

	/**
	 * Called when the UIManager control is added to the map.
	 * Initializes UI elements, clones original templates, and sets up event listeners.
	 * @param map - The Leaflet map instance.
	 * @returns A dummy container HTMLElement.
	 */
	onAdd(map: ReturnType<typeof L.Map>) {
		this.map = map;
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

		$('#toolbar-wrapper').on('click', (event) => {
			const target = event.target as HTMLElement;
			if (target.parentElement?.id === 'toolbar-up') // checks if clicked on empty part of the toolbar on tabbed view
				this.map.fire('editorgotfocus');
		});

		$('.main-nav').on('click', (event) => {
			const target = event.target as HTMLElement;
			if (target.parentElement?.nodeName === 'NAV' || // checks if clicked on an container of an element
				target.nodeName === 'NAV' || // checks if clicked on navigation bar itself
				target.parentElement?.id === 'document-titlebar') { // checks if clicked on the document titlebar container
				this.map.fire('editorgotfocus');}
		});

		this.map.on('updateviewslist', this.onUpdateViews, this);

		this.map['stateChangeHandler'].setItemValue('toggledarktheme', 'false');
		this.map['stateChangeHandler'].setItemValue('invertbackground', 'false');
		this.map['stateChangeHandler'].setItemValue('showannotations', 'true');
	}

	// UI initialization

	/**
	 * Returns the current UI mode ("notebookbar" or "classic").
	 */
	getCurrentMode(): string {
		// no notebookbar on mobile
		if (window.mode.isMobile())
			return 'classic';

		return this.shouldUseNotebookbarMode() ? 'notebookbar' : 'classic';
	}

	/**
	 * Returns if the highlight of column/row is enabled.
	 */
	getHighlightMode(): boolean {
		return window.prefs.getBoolean('ColumnRowHighlightEnabled', false);
	}

	/**
	 * Changes status of the highlight of column/row is enabled.
	 */
	setHighlightMode(newState: boolean): void {
		window.prefs.set('ColumnRowHighlightEnabled', newState);
		const highlightState = newState? 'true' : 'false';
		this.map['stateChangeHandler'].setItemValue('columnrowhighlight', highlightState);
		this._map.fire('commandstatechanged', {commandName : 'columnrowhighlight', state : highlightState});
	}

	/**
	 * Determines whether to use notebookbar mode based on user preferences.
	 */
	shouldUseNotebookbarMode(): boolean {
		const forceCompact = window.prefs.get('compactMode', null); // getBoolean() does not accept null as the default value
		// all other cases should default to notebookbar
		const shouldUseClassic = (window.userInterfaceMode === 'classic' && forceCompact == null) || forceCompact === 'true';
		return !shouldUseClassic;
	}

	// Dark mode toggle

	/**
	 * Switches the UI to light mode.
	 */
	loadLightMode(): void {
		document.documentElement.setAttribute('data-theme','light');
		this._map.fire('commandstatechanged', {commandName : 'toggledarktheme', state : 'false'});
		this.map.fire('darkmodechanged');
	}

	/**
	 * Switches the UI to dark mode.
	 */
	loadDarkMode(): void {
		document.documentElement.setAttribute('data-theme','dark');
		this._map.fire('commandstatechanged', {commandName : 'toggledarktheme', state : 'true'});
		this.map.fire('darkmodechanged');
	}

	/**
	 * Adjusts the canvas color after a mode change.
	 */
	setCanvasColorAfterModeChange(): void {
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
	}

	/**
	 * Sets the document background based on the activation flag.
	 */
	setDarkBackground(activate: boolean): void {
		var cmd = { 'NewTheme': { 'type': 'string', 'value': '' } };
		activate ? cmd.NewTheme.value = 'Dark' : cmd.NewTheme.value = 'Light';
		app.socket.sendMessage('uno .uno:InvertBackground ' + JSON.stringify(cmd));
		this.initDarkBackgroundUI(activate);
	}

	/**
	 * Initializes UI changes related to the dark background.
	 */
	initDarkBackgroundUI(activate: boolean): void {
		document.documentElement.setAttribute('data-bg-theme', activate ? 'dark' : 'light');
		if (activate) {
			this._map.fire('commandstatechanged', {commandName : 'invertbackground', state : 'false'});
		}
		else {
			this._map.fire('commandstatechanged', {commandName : 'invertbackground', state : 'true'});
		}
		this.setCanvasColorAfterModeChange();
	}

	/**
	 * Applies background inversion (with an option to skip core changes).
	 */
	applyInvert(skipCore: boolean = false): void {
		// get the initial mode
		var backgroundDark = this.isBackgroundDark();

		if (skipCore) {
			this.initDarkBackgroundUI(backgroundDark);
		} else {
			this.setDarkBackground(backgroundDark);
		}
	}

	/**
	 * Returns whether the document background should be dark.
	 */
	isBackgroundDark(): boolean {
		// get the initial mode If document background is inverted or not
		var inDarkTheme = window.prefs.getBoolean('darkTheme');
		var darkBackgroundPrefName = 'darkBackgroundForTheme.' + (inDarkTheme ? 'dark' : 'light');
		var backgroundDark = window.prefs.getBoolean(darkBackgroundPrefName, inDarkTheme);
		return backgroundDark;
	}

	/**
	 * Toggles the background inversion setting.
	 */
	toggleInvert(): void {
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
	}

	/**
	 * Toggles the overall dark mode setting and refreshes related UI components.
	 */
	toggleDarkMode(): void {
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
	}

	/**
	 * Initializes dark mode based on user settings.
	 */
	initDarkModeFromSettings(): void {
		var inDarkTheme = window.prefs.getBoolean('darkTheme');

		if (inDarkTheme) {
			this.loadDarkMode();
		} else {
			this.loadLightMode();
		}

		this.applyInvert(true);
	}

	/**
	 * Informs the core system about the dark mode change.
	 */
	activateDarkModeInCore(activate: boolean): void {
		var cmd = { 'NewTheme': { 'type': 'string', 'value': '' } };
		activate ? cmd.NewTheme.value = 'Dark' : cmd.NewTheme.value = 'Light';
		app.socket.sendMessage('uno .uno:ChangeTheme ' + JSON.stringify(cmd));
	}

	/**
	 * Shows a modal dialog asking to rename document.
	 */
	renameDocument(): void {
		// todo: does this need _('rename document)
		var docNameInput = this.documentNameInput;
		var fileName = this.map['wopi'].BaseFileName ? this.map['wopi'].BaseFileName : '';
		this.showInputModal('rename-modal', _('Rename Document'), _('Enter new name'), fileName, _('Rename'),
			(newName: string) => {
				docNameInput.documentNameConfirm(newName);
		});
	}

	/**
	 * Toggles WASM mode (if applicable).
	 */
	toggleWasm(): void {
		if (window.ThisIsTheEmscriptenApp) {
			//TODO: Should use the "external" socket.
			// app.socket.sendMessage('switch_request online');
		} else {
			app.socket.sendMessage('switch_request offline');
		}

		// Wait for Coolwsd to initiate the switch.
	}

	/**
	 * Setup menubar and the top toolbar.
	 */
	initializeMenubarAndTopToolbar(): void {
		const enableNotebookbar = this.shouldUseNotebookbarMode();
		const isMobile = window.mode.isMobile();
		if (isMobile || !enableNotebookbar) {
			var menubar = L.control.menubar();
			this.map.menubar = menubar;
			this.map.addControl(menubar);
		}

		if (!isMobile && !enableNotebookbar)
			this.map.topToolbar = JSDialog.TopToolbar(this.map);
	}

	/**
	 * Initializes basic UI components.
	 */
	initializeBasicUI(): void {
		this.initializeMenubarAndTopToolbar();

		if (window.mode.isMobile()) {
			$('#toolbar-mobile-back').on('click', () => {
				this.enterReadonlyOrClose();
			});
		}

		if (!window.mode.isMobile()) {
			this.map.statusBar = JSDialog.StatusBar(this.map);

			this.map.sidebar = JSDialog.Sidebar(this.map, {animSpeed: 200});

			this.map.navigator = JSDialog.NavigatorPanel(this.map, { animSpeed: 200 });

			this.map.formulaautocomplete = L.control.formulaautocomplete(this.map);
			this.map.formulausage = L.control.formulausage(this.map);
			this.map.autofillpreviewtooltip = L.control.autofillpreviewtooltip(this.map);
		}

		this.map.jsdialog = L.control.jsDialog();
		this.map.addControl(this.map.jsdialog);

		window.setupToolbar(this.map);

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

		var openBusyPopup = (label: string) => {
			this.busyPopupTimer = window.setTimeout(() => {
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

		var fadeoutBusyPopup = () => {
			if (this.busyPopupTimer != null)
				window.clearTimeout(this.busyPopupTimer);
			var json = {
				id: 'busypopup',
				jsontype: 'dialog',
				type: 'modalpopup',
				action: 'fadeout'
			};
			if (app.socket)
				app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json)});
		};

		this.map.on('showbusy', (e: any) => {
			fadeoutBusyPopup();
			openBusyPopup(e.label);
		});

		this.map.on('hidebusy', (e: any) => {
			fadeoutBusyPopup();
		});
	}

	/**
	 * Initializes specialized UI components based on the document type.
	 * @param docType - Document type (e.g. 'spreadsheet', 'presentation', 'text').
	 */
	initializeSpecializedUI(docType: string): void {
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

			const formulabarRow = document.getElementById('formulabar-row');
			const spreadsheetToolbar = document.getElementById('spreadsheet-toolbar');
			spreadsheetToolbar?.classList?.remove('hidden');
			formulabarRow?.classList?.remove('hidden');
			this.map.formulabar = JSDialog.FormulaBar(this.map);
			this.map.addressInputField = JSDialog.AddressInputField(this.map);
			$('#toolbar-wrapper').addClass('spreadsheet');

			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('presentation-controls-wrapper'));
			const selectBackground = document.getElementById('selectbackground');
			if (selectBackground != null)
				selectBackground.parentNode?.removeChild(selectBackground);

			const highlightState = this.getHighlightMode()? 'true' : 'false';
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
			const selectBackground = document.getElementById('selectbackground');
			if (selectBackground != null)
				selectBackground.parentNode?.removeChild(selectBackground);

			this.initializeRuler();

			var showResolved = this.getBooleanDocTypePref('ShowResolved', true);
			if (showResolved === false)
				this.map.sendUnoCommand('.uno:ShowResolvedAnnotations');
			// Notify the initial status of comments
			var initialCommentState = this.map['stateChangeHandler'].getItemValue('showannotations');
			this._map.fire('commandstatechanged', {commandName : 'showannotations', state : initialCommentState});
			this.map.mention = L.control.mention(this.map);
		}

		if (this.map.isPresentationOrDrawing() && (isDesktop || window.mode.isTablet())) {
			JSDialog.PresentationBar(this.map);
		}
		if ((window.mode.isTablet() || window.mode.isDesktop()) && !app.isReadOnly()) {
			this.map.navigator.initializeNavigator(docType);
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
	}

	/**
	 * Initializes the sidebar based on saved state and preferences.
	 */
	initializeSidebar(): void {
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
				}
			} else if (this.getBooleanDocTypePref('NavigatorDeck', false)) {
				app.socket.sendMessage('uno .uno:SidebarShow');
			} else if (this.getBooleanDocTypePref('StyleListDeck', false)) {
				app.socket.sendMessage('uno .uno:SidebarShow');
				app.socket.sendMessage('uno .uno:SidebarDeck.StyleListDeck');
				this.map.sidebar.setupTargetDeck('.uno:SidebarDeck.StyleListDeck');
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
	}

	/**
	 * Initializes the ruler component.
	 */
	initializeRuler(): void {
		if ((window.mode.isTablet() || window.mode.isDesktop()) && !app.isReadOnly()) {
			var showRuler = this.getBooleanDocTypePref('ShowRuler');
			var interactiveRuler = this.map.isEditMode();
			// Call the static method from the Ruler class
			app.definitions.ruler.initializeRuler(this.map, {
				interactive: interactiveRuler,
				showruler: showRuler
			});
		}
	}

	/**
	 * Removes classic UI components.
	 */
	removeClassicUI(): void {
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
	}

	/**
	 * Adds classic UI components.
	 */
	addClassicUI(): void {
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
	}

	/**
	 * Creates and adds a notebookbar control based on document type.
	 * @param docType - Document type (e.g. 'spreadsheet', 'presentation', etc.)
	 */
	createNotebookbarControl(docType: string): void {
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
	}

	/**
	 * Refreshes UI components after a theme change.
	 */
	refreshAfterThemeChange(): void {
		if (this.getCurrentMode() === 'classic' || this.map.isReadOnlyMode()) {
			this.refreshMenubar();
			this.refreshToolbar();
		}
		// jsdialog components like notebookbar or sidebar
		// doesn't require reload to change icons
	}

	/**
	 * Refreshes the notebookbar.
	 */
	refreshNotebookbar(): void {
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
	}

	/**
	 * Refreshes the menubar.
	 */
	refreshMenubar(): void {
		if (this.map.menubar)
			this.map.menubar._onRefresh();
	}

	/**
	 * Refreshes the sidebar after a delay.
	 * @param ms - Milliseconds to delay the refresh (default 400ms).
	 */
	refreshSidebar(ms?: number): void {
		ms = ms !== undefined ? ms : 400;
		setTimeout(function () {
			var message = 'dialogevent ' +
				(window.sidebarId !== undefined ? window.sidebarId : -1) +
				' {"id":"-1"}';
			app.socket.sendMessage(message);
		}, ms);
	}

	/**
	 * Placeholder method for refreshing the toolbar.
	 */
	refreshToolbar(): void {
		// TODO
	}

	/**
	 * Adds notebookbar UI components.
	 */
	addNotebookbarUI(): void {
		this.refreshNotebookbar();
		this.map._docLayer._resetClientVisArea();
		this.map._docLayer._requestNewTiles();
		var menubarWasHidden = this.isMenubarHidden();
		this.showMenubar();
		this._menubarShouldBeHidden = menubarWasHidden;
	}

	/**
	 * Removes notebookbar UI components.
	 */
	removeNotebookbarUI(): void {
		if (this.notebookbar) {
			this.map.removeControl(this.notebookbar);
			this.notebookbar = null;
		}
		$('#map').removeClass('notebookbar-opened');
	}

	/**
	 * Handles UI mode changes.
	 * @param uiMode - Object containing the new UI mode and additional flags.
	 */
	onChangeUIMode(uiMode: any): void {
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
	}

	// UI modification

	/**
	 * Inserts a button into the classic toolbar.
	 * @param button - Button configuration object.
	 */
	insertButtonToClassicToolbar(button: any): void {
		if (this.map.isEditMode()) {
			// Position: Either specified by the caller, or defaulting to first position (before save)
			var insertBefore = button.insertBefore || 'save';

			var newButton: ToolbarButton[] = [
				{
					type: 'button',
					uno: button.unoCommand,
					id: button.id,
					img: button.id,
					hint: _(button.hint.replaceAll('"', '&quot;')), /* "Try" to localize ! */
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
	}

	setCssRulesForCustomButtons(): void {
		for (var button of this.customButtons) {
			const item = document.querySelector(".w2ui-icon." + encodeURIComponent(button.id)) as HTMLElement | null;
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
	}

	/**
	 * Registers a new custom button.
	 *
	 * Called by the WOPI API to register new custom button
	 * @param button - Button configuration object.
	 */
	insertButton(button: any): void {
		for (var i in this.customButtons) {
			var item = this.customButtons[i];
			if (item.id === button.id)
				return;
		}

		this.customButtons.push(button);
		this.insertCustomButton(button);
	}

	/**
	 * Inserts a custom button into the current UI.
	 * @param button - Button configuration object.
	 */
	insertCustomButton(button: any): void {
		if (button.tablet === false && window.mode.isTablet()) {
			return;
		}
		if (!this.notebookbar)
			this.insertButtonToClassicToolbar(button);
		else
			this.notebookbar.insertButtonToShortcuts(button);
	}

	/**
	 * Inserts all custom buttons into the current UI.
	 */
	insertCustomButtons(): void {
		for (var i in this.customButtons)
			this.insertCustomButton(this.customButtons[i]);
	}

	/**
	 * Shows or hides a button in the classic toolbar.
	 * @param buttonId - The button’s ID.
	 * @param show - Flag to show (true) or hide (false).
	 */
	showButtonInClassicToolbar(buttonId: string, show: boolean): boolean {
		// TODO: other
		const toolbars: any[] = [];
		let found = false;

		toolbars.forEach((toolbar) => {
			if (toolbar && toolbar.get(buttonId)) {
				found = true;
				toolbar.showItem(buttonId, show);
			}
		});

		const topToolbarHas = window.app.map.topToolbar.hasItem(buttonId);
		found = found || topToolbarHas;
		if (topToolbarHas)
			window.app.map.topToolbar.showItem(buttonId, show);

		return found;
	}

	/**
	 * Shows or hides a button in the current UI.
	 * @param buttonId - The button’s ID.
	 * @param show - Flag to show (true) or hide (false).
	 */
	showButton(buttonId: string, show: boolean): void {
		var found = false;
		if (!this.notebookbar) {
			found = this.showButtonInClassicToolbar(buttonId, show);
		} else {
			if (show) {
				delete this.hiddenButtons[buttonId];
			} else {
				this.hiddenButtons[buttonId] = true;
			}
			this.notebookbar.reloadShortcutsBar();
			found = this.notebookbar.showNotebookbarButton(buttonId, show);
		}

		if (!found) {
			window.app.console.error('Button with id "' + buttonId + '" not found.');
			return;
		}
	}

	/**
	 * Returns whether a button is currently visible.
	 * @param buttonId - The button’s ID.
	 */
	isButtonVisible(buttonId: string): boolean {
		return !(buttonId in this.hiddenButtons);
	}

	// Commands

	/**
	 * Shows or hides a command in the menubar.
	 * @param command - Command identifier.
	 * @param show - Flag to show (true) or hide (false).
	 */
	showCommandInMenubar(command: string, show: boolean): boolean {
		var menubar = this._map.menubar;
		if (show) {
			return menubar.showUnoItem(command);
		} else {
			return menubar.hideUnoItem(command);
		}
	}

	/**
	 * Shows or hides a command in the classic toolbar.
	 * @param command - Command identifier.
	 * @param show - Flag to show (true) or hide (false).
	 */
	showCommandInClassicToolbar(command: string, show: boolean): boolean {
		// TODO: other
		const toolbars: any[] = [];
		var found = false;

		toolbars.forEach((toolbar) => {
			if (!toolbar)
				return;
			toolbar.items.forEach((item: any) => {
				var commands = this.map._extractCommand(item);
				if (commands.indexOf(command) != -1) {
					found = true;
					if (show) {
						toolbar.showItem(item.id, true);
					} else {
						toolbar.showItem(item.id, false);
					}
				}
			});
		});

		return found;
	}

	/**
	 * Shows or hides a command in the current UI.
	 * @param command - Command identifier.
	 * @param show - Flag to show (true) or hide (false).
	 */
	showCommand(command: string, show: boolean): void {
		if (show) {
			delete this.hiddenCommands[command];
		} else {
			this.hiddenCommands[command] = true;
		}
		var found = false;
		if (!this.notebookbar) {
			found ||= this.showCommandInClassicToolbar(command, show);
			found ||= this.showCommandInMenubar(command, show);
		} else {
			this.notebookbar.reloadShortcutsBar();
			found ||= this.notebookbar.showNotebookbarCommand(command, show);
		}

		if (!found) {
			window.app.console.error('Item with command "' + command + '" not found.');
		}
	}

	/**
	 * Returns whether a command is visible.
	 * @param command - Command identifier.
	 */
	isCommandVisible(command: string): boolean {
		return !(command in this.hiddenCommands);
	}

	// Menubar

	/**
	 * Shows the menubar.
	 */
	showMenubar(): void {
		this._menubarShouldBeHidden = false;
		if (!this.isMenubarHidden())
			return;
		$('.main-nav').show();
		if (L.Params.closeButtonEnabled && !window.mode.isTablet()) {
			$('#closebuttonwrapper').show();
			$('#closebuttonwrapperseparator').show();
		}
		const obj = document.getElementById('fold-button');
		if (obj != null)
			obj.style.transform = 'rotate(0deg)';

		$('#fold').prop('title', _('Hide Menu'));

		if (this._notebookbarShouldBeCollapsed)
			this.collapseNotebookbar();
	}

	/**
	 * Hides the menubar.
	 */
	hideMenubar(): void {
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
		if (obj != null)
			obj.style.transform = 'rotate(180deg)';

		$('#fold').prop('title', _('Show Menu'));
	}

	/**
	 * Returns whether the menubar is hidden.
	 */
	isMenubarHidden(): boolean {
		return $('.main-nav').css('display') === 'none';
	}

	/**
	 * Toggles the menubar’s visibility.
	 */
	toggleMenubar(): void {
		if (this.isMenubarHidden())
			this.showMenubar();
		else
			this.hideMenubar();
	}

	// Ruler

	/**
	 * Shows the ruler.
	 */
	showRuler(): void {
		this._map.sendUnoCommand('.uno:ShowRuler');
		$('.cool-ruler').show();
		$('#map').addClass('hasruler');
		this.setDocTypePref('ShowRuler', true);
		this.map.fire('rulerchanged');
	}

	/**
	 * Hides the ruler.
	 */
	hideRuler(): void {
		$('.cool-ruler').hide();
		$('#map').removeClass('hasruler');
		this.setDocTypePref('ShowRuler', false);
		this.map.fire('rulerchanged');
	}

	/**
	 * Toggles the ruler’s visibility.
	 */
	toggleRuler(): void {
		if (this.isRulerVisible())
			this.hideRuler();
		else
			this.showRuler();
	}

	/**
	 * Returns whether the ruler is visible.
	 */
	isRulerVisible(): boolean {
		return $('.cool-ruler').is(':visible');
	}

	/**
	 * Returns whether the document is in fullscreen mode.
	 */
	isFullscreen(): boolean {
		if (!document.fullscreenElement &&
			!document.mozFullscreenElement &&
			!document.msFullscreenElement &&
			!document.webkitFullscreenElement)
			return false;
		else
			return true;
	}

	// Notebookbar helpers

	/**
	 * Returns whether the notebookbar is currently shown.
	 */
	hasNotebookbarShown(): boolean {
		return $('#map').hasClass('notebookbar-opened');
	}

	/**
	 * Adjusts layout to make space for the notebookbar.
	 */
	makeSpaceForNotebookbar(): void {
		if (this.hasNotebookbarShown())
			return;

		$('#map').addClass('notebookbar-opened');
	}

	/**
	 * Collapses the notebookbar.
	 */
	collapseNotebookbar(): void {
		this._notebookbarShouldBeCollapsed = true;

		if (this.isNotebookbarCollapsed() || this.isMenubarHidden())
			return;

		this.moveObjectVertically($('#formulabar'), -1);
		$('#toolbar-wrapper').css('display', 'none');

		$('#document-container').addClass('tabs-collapsed');

		this.map._docLayer._syncTileContainerSize();
	}

	/**
	 * Extends (uncollapses) the notebookbar.
	 */
	extendNotebookbar(): void {
		this._notebookbarShouldBeCollapsed = false;

		if (!this.isNotebookbarCollapsed())
			return;

		this.moveObjectVertically($('#formulabar'), 1);
		$('#toolbar-wrapper').css('display', '');

		$('#document-container').removeClass('tabs-collapsed');

		this.map._docLayer._syncTileContainerSize();
	}

	showNotebookTab(id: string, show: boolean): void {
		if (show) {
			delete this.hiddenTabs[id];
		} else {
			this.hiddenTabs[id] = true;
		}
		if (this.notebookbar) {
			this.notebookbar.refreshContextTabsVisibility();
		}
	}

	/**
	 * Is the notebookbar's tab visible?
	 */
	isTabVisible(name: string): boolean {
		return !(name in this.hiddenTabs);
	}

	/**
	 * Returns whether the notebookbar is collapsed.
	 */
	isNotebookbarCollapsed(): boolean {
		return $('#document-container').hasClass('tabs-collapsed');
	}

	// UI Defaults functions

	/**
	 * Shows the status bar.
	 */
	showStatusBar(): void {
		$('#document-container').css('bottom', this.documentBottom);
		this.map.statusBar.show();
		this.setDocTypePref('ShowStatusbar', true);
		this.map.fire('statusbarchanged');
	}

	/**
	 * Hides the status bar.
	 * @param firstStart - Optional flag indicating if this is the initial call.
	 */
	hideStatusBar(firstStart?: boolean): void {
		if (!firstStart && !this.isStatusBarVisible())
			return;

		this.documentBottom = $('#document-container').css('bottom');
		$('#document-container').css('bottom', '0px');
		this.map.statusBar.hide();
		if (!firstStart)
			this.setDocTypePref('ShowStatusbar', false);
		this.map.fire('statusbarchanged');
	}

	/**
	 * Toggles the status bar’s visibility.
	 */
	toggleStatusBar(): void {
		if (this.isStatusBarVisible())
			this.hideStatusBar();
		else
			this.showStatusBar();
	}

	/**
	 * Focuses the search functionality.
	 */
	focusSearch(): void {
		this.showStatusBar();
		this.map.fire('focussearch');
	}

	/**
	 * Returns whether the status bar is visible.
	 */
	isStatusBarVisible(): boolean {
		return document.getElementById('toolbar-down')?.style?.display !== 'none';
	}

	// Event handlers

	/**
	 * Event handler for updating document permission.
	 * @param e - The event object containing permission details.
	 */
	onUpdatePermission(e: any): void {
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
	}

	/**
	 * Refreshes the UI.
	 */
	refreshUI(): void {
		if (this.notebookbar && !this.map._shouldStartReadOnly())
			this.refreshNotebookbar();
		else
			this.refreshMenubar();

		this.refreshTheme();
	}

	refreshTheme(): void {
		if (typeof window.initializedUI === 'function') {
			window.initializedUI();
		}
	}

	/**
	 * Updates the view information.
	 */
	onUpdateViews(): void {
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
	}

	/**
	 * Enters read-only mode or closes the app.
	 */
	enterReadonlyOrClose(): void {
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
	}

	/**
	 * Handles mobile back navigation.
	 * @param popStateEvent - The popstate event.
	 */
	onGoBack(popStateEvent: any): void {
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
	}

	// Blocking UI

	/**
	 * Returns whether the UI is blocked.
	 */
	isUIBlocked(): boolean {
		return this.blockedUI;
	}

	/**
	 * Blocks the UI and displays a busy popup.
	 * @param event - Event containing an optional message.
	 */
	blockUI(event: any): void {
		this.blockedUI = true;
		this.map.fire('showbusy', {label: event ? event.message : null});
	}

	/**
	 * Unblocks the UI and hides the busy popup.
	 */
	unblockUI(): void {
		this.blockedUI = false;
		this.map.fire('hidebusy');
	}

	// Document area tooltip

	/**
	 * Sets the tooltip text for an element.
	 * @param element - The target element.
	 * @param text - Tooltip text.
	 */
	private _setTooltipText(element: any, text: string): void {
		var dummyNode = L.DomUtil.create('div');
		dummyNode.innerText = text;
		element.tooltip('option', 'content', dummyNode.innerHTML);
	}

	/**
	 * Shows general tooltips in the document area
	 * @param tooltipInfo - contains rectangle (position in twips) and text properties.
	 */
	showDocumentTooltip(tooltipInfo: any): void {
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
	}

	// Snack bar

	/**
	 * Closes the snackbar.
	 */
	closeSnackbar(): void {
		JSDialog.SnackbarController.closeSnackbar();
	}

	/**
	 * Displays a snackbar notification.
	 * @param label - Message text.
	 * @param action - Action text.
	 * @param callback - Callback to execute on action.
	 * @param timeout - Duration before auto-dismiss.
	 * @param hasProgress - Whether to show a progress bar.
	 * @param withDismiss - Whether a dismiss button is included.
	 */
	showSnackbar(
		label: string,
		action: string,
		callback: any,
		timeout: number,
		hasProgress: boolean,
		withDismiss: boolean,
	): void {
		JSDialog.SnackbarController.showSnackbar(label, action, callback, timeout, hasProgress, withDismiss);
	}

	/**
	 * Displays a snackbar with a progress bar.
	 */
	showProgressBar(
		message: string,
		buttonText: string,
		callback: any,
		timeout?: number,
		withDismiss?: boolean,
	): void {
		JSDialog.SnackbarController.showSnackbar(message, buttonText, callback, timeout ? timeout : -1, true, withDismiss);
	}

	/**
	 * Updates the progress value on the snackbar.
	 * @param value - Progress value (0–100).
	 */
	setSnackbarProgress(value: number): void {
		JSDialog.SnackbarController.setSnackbarProgress(value);
	}

	// Modals

	/**
	 * Displays a modal dialog.
	 * @param json - JSON configuration for the dialog.
	 * @param callbacks - Array of callback configurations.
	 * @param cancelButtonId - Optional ID for the cancel button.
	 */
	showModal(json: any, callbacks: any[], cancelButtonId?: string): void {
		var builderCallback = (objectType: any, eventType: any, object: any, data: any) => {
			window.app.console.debug("modal action: '" + objectType + "' id:'" + object.id + "' event: '" + eventType + "' state: '" + data + "'");

			// default close methods
			callbacks.push({id: (cancelButtonId ? cancelButtonId: 'response-cancel'), func: () => { this.closeModal(json.id); }});
			callbacks.push({id: '__POPOVER__', func: () => { this.closeModal(json.id); }});

			for (var i in callbacks) {
				var callback = callbacks[i];
				if (object.id === callback.id && (!callback.type || eventType === callback.type)) {
					callback.func(objectType, eventType, object, data);
				}
			}
		};

		app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json), callback: builderCallback});
	}

	/**
	 * Closes a modal dialog.
	 * @param dialogId - The ID of the dialog to close.
	 */
	closeModal(dialogId: string): void {
		var closeMessage = { id: dialogId, jsontype: 'dialog', type: 'modalpopup', action: 'close' };
		app.socket._onMessage({ textMsg: 'jsdialog: ' + JSON.stringify(closeMessage) });
	}

	/**
	 * Closes all open dialogs.
	 */
	closeAll(): void {
		if (this.map.jsdialog)
			this.map.jsdialog.closeAll();
		else
			this.mobileWizard._closeWizard();
	}

	/**
	 * Returns whether any dialog is currently open.
	 */
	isAnyDialogOpen(): boolean {
		if (this.map.jsdialog)
			return this.map.jsdialog.hasDialogOpened();
		else
			return this.mobileWizard.isOpen();
	}

	// TODO: remove and use JSDialog.generateModalId directly
	generateModalId(givenId: string): string {
		return JSDialog.generateModalId(givenId);
	}

	/**
	 * Constructs JSON for a modal dialog.
	 * @param id - Base ID.
	 * @param title - Dialog title.
	 * @param cancellable - Whether the dialog is cancellable.
	 * @param widgets - Array of widget configurations.
	 * @param focusId - Optional focus element ID.
	 * @param clickToDismiss - Optional flag for click-to-dismiss behavior.
	 */
	private _modalDialogJSON(
		id: string,
		title: string,
		cancellable: boolean,
		widgets: any[],
		focusId?: string,
		clickToDismiss?: boolean,
	): any {
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
	}

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
	showInfoModal(
		id: string,
		title: string,
		message1: string,
		message2: string,
		buttonText: string,
		callback: any,
		withCancel: boolean,
		focusId?: string,
	): void {
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

		this.showModal(json, [
			{id: responseButtonId, func: () => {
				var dontClose = false;
				if (typeof callback === 'function')
					dontClose = callback();
				if (!dontClose)
					this.closeModal(dialogId);
			}}
		], cancelButtonId);
		if (!buttonText && !withCancel) {
			// if no buttons better to set tabIndex to negative so the element is not reachable via sequential keyboard navigation but can be focused programatically
			const dialogElement = document.getElementById(dialogId);
			if (dialogElement != null) {
				dialogElement.tabIndex = -1;
				// We hid the OK button, we need to set focus manually on the popup.
				dialogElement.focus();
				dialogElement.className += ' focus-hidden';
			}
		}
	}

	/**
	 * Displays a modal dialog with a progress bar.
	 */
	showProgressBarDialog(
		id: string,
		title: string,
		message: string,
		buttonText: string,
		callback: any,
		value?: number,
		cancelCallback?: any,
	): void {
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

		this.showModal(json, [
			{id: responseButtonId, func: () => {
				var dontClose = false;
				if (typeof callback === 'function')
					dontClose = callback();
				if (!dontClose)
					this.closeModal(dialogId);
			}},
			{id: cancelButtonId, func: () => {
				if (typeof cancelCallback === 'function')
					cancelCallback();
			}}
		], cancelButtonId);
	}

	/**
	 * Updates the progress value in a progress dialog.
	 * @param value - Progress value (0–100).
	 */
	setDialogProgress(id: string, value: number): void {
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
	}

	/// buttonObjectList: [{id: button's id, text: button's text, ..other properties if needed}, ...]
	/// callbackList: [{id: button's id, func_: function}, ...]
	showModalWithCustomButtons(
		id: string,
		title: string,
		message: string,
		cancellable: boolean,
		buttonObjectList: any[],
		callbackList: any[],
	): void {
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

		buttonObjectList.forEach((button) => {
			callbackList.forEach((callback) => {
				if (button.id === callback.id) {
					if (typeof callback.func_ === 'function') {
						callback.func = () => {
							callback.func_();
							this.closeModal(dialogId);
						};
					}
					else
						callback.func = () => { this.closeModal(dialogId); };
				}
			});
		});

		this.showModal(json, callbackList);
	}

	/// shows simple input modal (message + input + (cancel + ok) button)
	/// id - id of a dialog
	/// title - title of a dialog
	/// message - message
	/// defaultValue - default value of an input
	/// buttonText - text inside OK button
	/// callback - callback on button press
	showInputModal(
		id: string,
		title: string,
		message: string,
		defaultValue: string,
		buttonText: string,
		callback: (input: string) => void,
		passwordInput?: boolean,
	): void {
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

		this.showModal(json, [
			{id: 'response-ok', func: () => {
				if (typeof callback === 'function') {
					var input = document.getElementById('input-modal-input') as HTMLInputElement;
					callback(input.value);
				}
				this.closeModal(dialogId);
			}}
		]);
	}

	/// Shows an info bar at the bottom right of the view.
	/// This is called by map.fire('infobar', {data}).
	showInfoBar(e: any): void {
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
				win?.focus();
			}
		}]);

		if (!window.mode.isMobile()) {
			const dialogElement = document.getElementById(dialogId);
			if (dialogElement != null) {
				dialogElement.style.marginRight = '0';
				dialogElement.style.marginBottom = '0';
			}
		}
	}

	/**
	 * Displays a yes/no confirmation modal dialog.
	 */
	showYesNoButton(
		id: string,
		title: string,
		message: string,
		yesButtonText: string,
		noButtonText: string,
		yesFunction: () => void,
		noFunction: () => void,
		cancellable: boolean,
	): void {
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
				func: () => {
					if (typeof noFunction === 'function')
						noFunction();
					this.closeModal(dialogId);
				}
			},
			{
				id: dialogId + '-yesbutton',
				func: () => {
					if (typeof yesFunction === 'function')
						yesFunction();
					this.closeModal(dialogId);
				}
			}
		]);
	}

	/// shows simple confirm modal (message + (cancel + ok) button)
	/// id - id of a dialog
	/// title - title of a dialog
	/// message - message
	/// buttonText - text inside OK button
	/// callback - callback on button press
	showConfirmModal(
		id: string,
		title: string,
		message: string,
		buttonText: string,
		callback: () => void,
		hideCancelButton?: boolean,
	): void {
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

		this.showModal(json, [
			{id: 'response-ok', func: () => {
				if (typeof callback === 'function') {
					callback();
				}
				this.closeModal(dialogId);
			}}
		]);
	}

	// Helper functions

	/**
	 * Moves a jQuery element vertically by a specified difference.
	 * @param obj - The jQuery element.
	 * @param diff - The vertical pixel difference.
	 */
	moveObjectVertically(obj: JQuery, diff: number): void {
		if (obj) {
			var prevTop = obj.css('top');
			if (prevTop) {
				prevTop = parseInt(prevTop.slice(0, -2)) + diff + 'px';
			}
			else {
				prevTop = diff + 'px';
			}
			obj.css({ top: prevTop });
			}
		}

	/**
	 * Sets a document type–specific preference.
	 * @param name - Preference name.
	 * @param value - Preference value.
	 */
	setDocTypePref(name: string, value: any): any {
		const docType = this.map.getDocType();
		return window.prefs.set(`${docType}.${name}`, value);
	}

	/**
	 * Sets several document type–specific preference items at once.
	 */
	setDocTypeMultiplePrefs(prefs: { [key: string]: string }) {
		const docType = this.map.getDocType();

		const deckPrefs: Record<string, string> = {};
		for (const [key, value] of Object.entries(prefs)) {
			deckPrefs[`${docType}.${key}`] = value
		}
		window.prefs.setMultiple(deckPrefs);
	}

	/**
	 * Retrieves a boolean preference for the current document type.
	 * @param name - Preference name.
	 * @param defaultValue - Default value if not set.
	 */
	getBooleanDocTypePref(name: string, defaultValue: boolean = false): boolean {
		const docType = this.map.getDocType();
		return window.prefs.getBoolean(`${docType}.${name}`, defaultValue);
	}
}

// Export a factory function for the UIManager control.
L.control.uiManager = function (): UIManager {
	return new UIManager();
};
