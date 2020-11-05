/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.UIManager - initializes the UI elements like toolbars, menubar or ruler
                         and allows to controll them (show/hide)
 */

/* global $ setupToolbar w2ui w2utils */
L.Control.UIManager = L.Control.extend({
	mobileWizard: null,

	onAdd: function (map) {
		this.map = map;
		this.notebookbar = null;

		map.on('updatepermission', this.onUpdatePermission, this);

		if (window.mode.isMobile()) {
			window.addEventListener('popstate', this.onGoBack.bind(this));

			// provide entries in the history we can catch to close the app
			history.pushState({context: 'app-started'}, 'app-started');
			history.pushState({context: 'app-started'}, 'app-started');
		}
	},

	// UI initialization

	initializeBasicUI: function() {
		var enableNotebookbar = window.userInterfaceMode === 'notebookbar';

		if (window.mode.isMobile() || !enableNotebookbar) {
			var menubar = L.control.menubar();
			this.map.menubar = menubar;
			this.map.addControl(menubar);
		}

		if (window.mode.isMobile()) {
			$('#mobile-edit-button').show();
		} else {
			if (!enableNotebookbar) {
				this.map.addControl(L.control.topToolbar());
			}

			this.map.addControl(L.control.signingBar());
			this.map.addControl(L.control.statusBar());
		}

		setupToolbar(this.map);

		this.map.addControl(L.control.documentNameInput());
		this.map.addControl(L.control.scroll());
		this.map.addControl(L.control.alertDialog());
		this.mobileWizard = L.control.mobileWizard();
		this.map.addControl(this.mobileWizard);
		this.map.addControl(L.control.languageDialog());
		this.map.dialog = L.control.lokDialog();
		this.map.addControl(this.map.dialog);
		this.map.addControl(L.control.contextMenu());
		this.map.addControl(L.control.infobar());
		this.map.addControl(L.control.userList());

		this.map.on('showbusy', function(e) {
			if (w2ui['actionbar'])
				w2utils.lock(w2ui['actionbar'].box, e.label, true);
		});

		this.map.on('hidebusy', function() {
			// If locked, unlock
			if (w2ui['actionbar'] && w2ui['actionbar'].box.firstChild.className === 'w2ui-lock') {
				w2utils.unlock(w2ui['actionbar'].box);
			}
		});
	},

	initializeSpecializedUI: function(docType) {
		var isDesktop = window.mode.isDesktop();
		var enableNotebookbar = window.userInterfaceMode === 'notebookbar';

		if (window.mode.isMobile()) {
			this.map.addControl(L.control.mobileBottomBar(docType));
			this.map.addControl(L.control.mobileTopBar(docType));
			this.map.addControl(L.control.searchBar());
		} else if (enableNotebookbar) {
			if (docType === 'spreadsheet') {
				var notebookbar = L.control.notebookbarCalc();
			} else if (docType === 'presentation') {
				notebookbar = L.control.notebookbarImpress();
			} else {
				notebookbar = L.control.notebookbarWriter();
			}

			this.notebookbar = notebookbar;
			this.map.addControl(notebookbar);

			// makeSpaceForNotebookbar call in onUpdatePermission
		}

		if (docType === 'spreadsheet') {
			this.map.addControl(L.control.sheetsBar({shownavigation: isDesktop || window.mode.isTablet()}));
			this.map.addControl(L.control.formulaBar());

			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('presentation-controls-wrapper'));
		}

		if (docType === 'presentation') {
			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('spreadsheet-row-column-frame'));
			L.DomUtil.remove(L.DomUtil.get('spreadsheet-toolbar'));
		}

		if (docType === 'text') {
			// remove unused elements
			L.DomUtil.remove(L.DomUtil.get('spreadsheet-row-column-frame'));
			L.DomUtil.remove(L.DomUtil.get('spreadsheet-toolbar'));
			L.DomUtil.remove(L.DomUtil.get('presentation-controls-wrapper'));

			if ((window.mode.isTablet() || window.mode.isDesktop())) {
				var showRuler = this.getSavedStateOrDefault('ShowRuler');
				var interactiveRuler = this.map.isPermissionEdit();
				L.control.ruler({position:'topleft', interactive:interactiveRuler, showruler: showRuler}).addTo(this.map);
			}
		}

		if (docType === 'presentation' && (isDesktop || window.mode.isTablet())) {
			this.map.addControl(L.control.presentationBar());
		}

		if (window.mode.isMobile() || (window.mode.isTablet() && !enableNotebookbar)) {
			this.map.on('updatetoolbarcommandvalues', function() {
				w2ui['editbar'].refresh();
			});
		}
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

		this.moveObjectVertically($('#spreadsheet-row-column-frame'), 36);
		this.moveObjectVertically($('#document-container'), 36);
		this.moveObjectVertically($('#presentation-controls-wrapper'), 36);
		this.moveObjectVertically($('#sidebar-dock-wrapper'), 36);
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

		this.moveObjectVertically($('#spreadsheet-row-column-frame'), -36);
		this.moveObjectVertically($('#document-container'), -36);
		this.moveObjectVertically($('#presentation-controls-wrapper'), -36);
		this.moveObjectVertically($('#sidebar-dock-wrapper'), -36);
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
		$('.loleaflet-ruler').show();
		$('#map').addClass('hasruler');
		this.setSavedState('ShowRuler', true);
	},

	hideRuler: function() {
		$('.loleaflet-ruler').hide();
		$('#map').removeClass('hasruler');
		this.setSavedState('ShowRuler', false);
	},

	toggleRuler: function() {
		if (this.isRulerVisible())
			this.hideRuler();
		else
			this.showRuler();
	},

	isRulerVisible: function() {
		return $('.loleaflet-ruler').is(':visible');
	},

	// Notebookbar helpers

	hasNotebookbarShown: function() {
		return $('#map').hasClass('notebookbar-opened');
	},

	makeSpaceForNotebookbar: function(docType) {
		if (this.hasNotebookbarShown())
			return;

		var additionalOffset = 0;
		if (docType === 'spreadsheet') {
			if (window.mode.isTablet())
				additionalOffset = -7;
			else
				additionalOffset = 53;
		}

		this.moveObjectVertically($('#spreadsheet-row-column-frame'), 36);
		this.moveObjectVertically($('#document-container'), 43 + additionalOffset);
		this.moveObjectVertically($('#presentation-controls-wrapper'), 43);
		this.moveObjectVertically($('#sidebar-dock-wrapper'), 43);

		$('#map').addClass('notebookbar-opened');
	},

	collapseNotebookbar: function() {
		if (this.isNotebookbarCollapsed())
			return;

		this.moveObjectVertically($('#spreadsheet-row-column-frame'), -85);
		this.moveObjectVertically($('#document-container'), -85);
		this.moveObjectVertically($('#presentation-controls-wrapper'), -85);
		this.moveObjectVertically($('#sidebar-dock-wrapper'), -85);
		this.moveObjectVertically($('#formulabar'), -1);
		$('#toolbar-up').css('display', 'none');

		$('#document-container').addClass('tabs-collapsed');
	},

	extendNotebookbar: function() {
		if (!this.isNotebookbarCollapsed())
			return;

		this.moveObjectVertically($('#spreadsheet-row-column-frame'), 85);
		this.moveObjectVertically($('#document-container'), 85);
		this.moveObjectVertically($('#presentation-controls-wrapper'), 85);
		this.moveObjectVertically($('#sidebar-dock-wrapper'), 85);
		this.moveObjectVertically($('#formulabar'), 1);
		$('#toolbar-up').css('display', '');

		$('#document-container').removeClass('tabs-collapsed');
	},

	isNotebookbarCollapsed: function() {
		return $('#document-container').hasClass('tabs-collapsed');
	},

	// UI Defaults functions

	showStatusBar: function() {
		$('#document-container').css('bottom', this.documentBottom);
		$('#presentation-controls-wrapper').css('bottom', this.presentationControlBottom);
		$('#toolbar-down').show();
		this.setSavedState('ShowStatusbar', true);
	},

	hideStatusBar: function(firstStart) {
		if (!firstStart && !this.isStatusBarVisible())
			return;

		this.documentBottom = $('#document-container').css('bottom');
		this.presentationControlBottom = $('#presentation-controls-wrapper').css('bottom');
		$('#document-container').css('bottom', '0px');
		$('#presentation-controls-wrapper').css('bottom','33px');
		$('#toolbar-down').hide();
		if (!firstStart)
			this.setSavedState('ShowStatusbar', false);
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

		var enableNotebookbar = window.userInterfaceMode === 'notebookbar';
		if (enableNotebookbar && !window.mode.isMobile()) {
			if (e.perm === 'edit') {
				this.makeSpaceForNotebookbar(this.map._docLayer._docType);
			} else if (e.perm === 'readonly' && $('#mobile-edit-button').is(':hidden')) {
				var menubar = L.control.menubar();
				this.map.menubar = menubar;
				this.map.addControl(menubar);

				if (this.notebookbar) {
					this.map.removeControl(this.notebookbar);
					this.notebookbar = null;
				}
			}
		}

		// We've resized the document container.
		this.map.invalidateSize();
	},

	enterReadonlyOrClose: function() {
		if (this.map.isPermissionEdit()) {
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
		if (window.isLocalStorageAllowed)
			localStorage.setItem('UIDefaults_' + this.map.getDocType() + '_' + name, state);
	},

	getSavedStateOrDefault: function(name) {
		var retval = true;
		var docType = this.map.getDocType();
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

			if (retval === undefined || retval === null)
				return true;
			else
				return retval;
		}
	}
});

L.control.uiManager = function () {
	return new L.Control.UIManager();
};
