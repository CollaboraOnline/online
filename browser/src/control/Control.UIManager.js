/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.UIManager - initializes the UI elements like toolbars, menubar or ruler
			 and allows to controll them (show/hide)
 */

/* global app $ setupToolbar w2ui toolbarUpMobileItems _ Hammer */
L.Control.UIManager = L.Control.extend({
	mobileWizard: null,
	blockedUI: false,
	busyPopupTimer: null,
	customButtons: [], // added by WOPI InsertButton
	modalIdPretext: 'modal-dialog-',

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
		var forceCompact = this.getSavedStateOrDefault('CompactMode', null);
		return (window.userInterfaceMode === 'notebookbar' && forceCompact === null)
			|| forceCompact === false;
	},

	initializeBasicUI: function() {
		var enableNotebookbar = this.shouldUseNotebookbarMode();
		var that = this;

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

			this.map.addControl(L.control.signingBar());
			this.map.addControl(L.control.statusBar());

			this.map.jsdialog = L.control.jsDialog();
			this.map.addControl(this.map.jsdialog);

			this.map.sidebar = L.control.sidebar({animSpeed: 200});
			this.map.addControl(this.map.sidebar);

			this.map.addControl(L.control.mobileWizardPopup());

			this.map.addControl(L.control.mention());
		}

		setupToolbar(this.map);

		this.map.addControl(L.control.documentNameInput());
		this.map.addControl(L.control.alertDialog());
		this.mobileWizard = L.control.mobileWizard();
		this.map.addControl(this.mobileWizard);
		this.map.addControl(L.control.languageDialog());
		this.map.dialog = L.control.lokDialog();
		this.map.addControl(this.map.dialog);
		this.map.addControl(L.control.contextMenu());
		this.map.addControl(L.control.infobar());
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
		var enableNotebookbar = currentMode === 'notebookbar';
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

			if ((window.mode.isTablet() || window.mode.isDesktop()) && this.map.canUserWrite()) {
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

		if (typeof window.initializedUI === 'function')
			window.initializedUI();
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
				}
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
	},

	refreshNotebookbar: function() {
		this.removeNotebookbarUI();
		this.createNotebookbarControl(this.map.getDocType());
		this.makeSpaceForNotebookbar();
		this.notebookbar._showNotebookbar = true;
		this.notebookbar.showTabs();
		$('.main-nav').removeClass('readonly');
		$('#map').addClass('notebookbar-opened');
		this.insertCustomButtons();
		this.map.sendInitUNOCommands();
	},

	refreshMenubar: function() {
		this.map.menubar._onRefresh();
	},

	addNotebookbarUI: function() {
		this.refreshNotebookbar();
		this.map._docLayer._resetClientVisArea();
		this.map._docLayer._requestNewTiles();
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

		this.setSavedState('CompactMode', uiMode.mode === 'classic');
		this.initializeSidebar();
		this.insertCustomButtons();

		// this code ensures that elements in the notebookbar have their "selected" status
		// displayed correctly
		this.map.fire('rulerchanged');
		this.map.fire('statusbarchanged');

		if (typeof window.initializedUI === 'function')
			window.initializedUI();
	},

	// UI modification

	insertButtonToClassicToolbar: function(button) {
		if (!w2ui['editbar'].get(button.id)) {
			if (this.map.isEditMode()) {
				// add the css rule for the image
				var style = $('html > head > style');
				if (style.length == 0)
					$('html > head').append('<style/>');
				$('html > head > style').append('.w2ui-icon.' + button.id + '{background: url(' + button.imgurl + ') no-repeat center !important; }');

				// Position: Either specified by the caller, or defaulting to first position (before save)
				var insertBefore = button.insertBefore || 'save';
				// add the item to the toolbar
				w2ui['editbar'].insert(insertBefore, [
					{
						type: 'button',
						uno: button.unoCommand,
						id: button.id,
						img: button.id,
						hint: _(button.hint), /* "Try" to localize ! */
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
		if (!this.notebookbar)
			this.showButtonInClassicToolbar(buttonId, show);
		else
			this.notebookbar.showShortcutsButton(buttonId, show);
	},

	// Menubar

	showMenubar: function() {
		if (!this.isMenubarHidden())
			return;
		$('.main-nav').show();
		if (L.Params.closeButtonEnabled && !window.mode.isTablet()) {
			$('#closebuttonwrapper').show();
		}

		var obj = $('.unfold');
		obj.removeClass('w2ui-icon unfold');
		obj.addClass('w2ui-icon fold');
	},

	hideMenubar: function() {
		if (this.isMenubarHidden())
			return;
		$('.main-nav').hide();
		if (L.Params.closeButtonEnabled) {
			$('#closebuttonwrapper').hide();
		}

		var obj = $('.fold');
		obj.removeClass('w2ui-icon fold');
		obj.addClass('w2ui-icon unfold');
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
		if (this.isNotebookbarCollapsed())
			return;

		this.moveObjectVertically($('#formulabar'), -1);
		$('#toolbar-wrapper').css('display', 'none');

		$('#document-container').addClass('tabs-collapsed');

		this.map._docLayer._syncTileContainerSize();
	},

	extendNotebookbar: function() {
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
		var userPrivateInfo = this.map._docLayer ? this.map._viewInfo[this.map._docLayer._viewId].userprivateinfo : null;
		if (userPrivateInfo) {
			var apiKey = userPrivateInfo.ZoteroAPIKey;
			if (apiKey) {
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

	// Snack bar

	showSnackbar: function(label, action, callback) {
		if (!app.socket)
			return;

		var closeJson = {
			id: 'snackbar',
			jsontype: 'dialog',
			type: 'snackbar',
			action: 'fadeout'
		};

		app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(closeJson)});

		var json = {
			id: 'snackbar',
			jsontype: 'dialog',
			type: 'snackbar',
			children: [
				{
					type: 'container',
					children: [
						action ? {id: 'label', type: 'fixedtext', text: label} : {id: 'label-no-action', type: 'fixedtext', text: label},
						action ? {id: 'button', type: 'pushbutton', text: action} : {}
					]
				}
			]
		};

		var builderCallback = function(objectType, eventType, object, data) {
			window.app.console.debug('control: \'' + objectType + '\' id:\'' + object.id + '\' event: \'' + eventType + '\' state: \'' + data + '\'');

			if (object.id === 'button' && objectType === 'pushbutton' && eventType === 'click') {
				if (callback)
					callback();
			}
		};

		app.socket._onMessage({textMsg: 'jsdialog: ' + JSON.stringify(json), callback: builderCallback});
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

	/// Returns generated (or to be generated) id for the modal container.
	generateModalId: function(givenId) {
		return this.modalIdPretext + givenId;
	},

	_modalDialogJSON: function(id, title, cancellable, widgets, focusId) {
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

	/// shows simple info modal (message + ok button)
	/// id - id of a dialog
	/// title - title of a dialog
	/// message1 - 1st line of message
	/// message2 - 2nd line of message
	/// buttonText - text inside button
	/// callback - callback on button press
	/// withCancel - specifies if needs cancal button also
	showInfoModal: function(id, title, message1, message2, buttonText, callback, withCancel) {
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
		]);

		var that = this;
		this.showModal(json, [
			{id: responseButtonId, func: function() {
				if (typeof callback === 'function')
					callback();
				that.closeModal(dialogId);
			}}
		], cancelButtonId);
	},

	/// shows simple input modal (message + input + (cancel + ok) button)
	/// id - id of a dialog
	/// title - title of a dialog
	/// message - message
	/// defaultValue - default value of an input
	/// buttonText - text inside OK button
	/// callback - callback on button press
	showInputModal: function(id, title, message, defaultValue, buttonText, callback) {
		var dialogId = this.generateModalId(id);
		var json = this._modalDialogJSON(id, title, !window.mode.isDesktop(), [
			{
				id: 'info-modal-label1',
				type: 'fixedtext',
				text: message
			},
			{
				id: 'input-modal-input',
				type: 'edit',
				text: defaultValue
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
		]);

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

	/// shows simple confirm modal (message + (cancel + ok) button)
	/// id - id of a dialog
	/// title - title of a dialog
	/// message - message
	/// buttonText - text inside OK button
	/// callback - callback on button press
	showConfirmModal: function(id, title, message, buttonText, callback) {
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
		var docType = (name === 'CompactMode') ? null : this.map.getDocType();
		if (window.isLocalStorageAllowed)
			localStorage.setItem('UIDefaults_' + docType + '_' + name, state);
	},

	getSavedStateOrDefault: function(name, forcedDefault) {
		var retval = forcedDefault !== undefined ? forcedDefault : true;
		// we request CompactMode very early, no info about doctype so unify all the calls
		var docType = (name === 'CompactMode') ? null : this.map.getDocType();
		var state = null;
		if (window.isLocalStorageAllowed)
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
