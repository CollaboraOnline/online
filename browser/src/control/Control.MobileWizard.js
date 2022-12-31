/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileWizard - main container can contain few MobileWizardWindows
 */

/* global app $ w2ui */
L.Control.MobileWizard = L.Control.extend({

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this.map = map;

		// for the moment, the mobile-wizard is mobile phone only
		if (!window.mode.isMobile())
			return;

		this.contents = [];

		map.on('mobilewizard', this._onMobileWizard, this);
		map.on('closemobilewizard', this._closeWizard, this);
		map.on('showwizardsidebar', this._showWizardSidebar, this);
		map.on('mobilewizardback', this.goLevelUp, this);
		map.on('resize', this._onResize, this);
		map.on('jsdialogupdate', this.onJSUpdate, this);
		map.on('jsdialogaction', this.onJSAction, this);

		this._setupBackButton();
	},

	onRemove: function() {
		this.map.off('mobilewizard', this._onMobileWizard, this);
		this.map.off('closemobilewizard', this._closeWizard, this);
		this.map.off('showwizardsidebar', this._showWizardSidebar, this);
		this.map.off('mobilewizardback', this.goLevelUp, this);
		this.map.off('resize', this._onResize, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	},

	_setupBackButton: function() {
		this.backButton = $('#mobile-wizard-back');
		this.backButton.click(function() { history.back(); });
	},

	_showWizardSidebar: function(event) {
		this.map.showSidebar = true;
		if (!event || !event.noRefresh)
			this._refreshSidebar();
	},

	_closeWizard: function() {
		var items = this.contents.length;
		while (items--)
			this.removeWindow(this.contents[0]);
	},

	_hideWizard: function() {
		$('.jsdialog-overlay').remove();

		// dialog
		if (this.map.dialog.hasDialogInMobilePanelOpened()) {
			// TODO: use jsdialog approach
			this.map.dialog._onDialogClose(window.mobileDialogId, true);
			window.mobileDialogId = undefined;
		}

		if (window.commentWizard === true && app.sectionContainer) {
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).removeHighlighters();
		}

		if (!this.contents.length)
			$('#mobile-wizard').hide();

		document.getElementById('mobile-wizard').classList.remove('menuwizard');
		document.getElementById('mobile-wizard').classList.remove('shapeswizard');
		if (!document.getElementById('document-container').classList.contains('landscape')) {
			var pcw = document.getElementById('presentation-controls-wrapper');
			if (pcw)
				pcw.style.display = 'block';
		}

		if (this.map.isEditMode()) {
			$('#toolbar-down').show();
		}
		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('MOBILEWIZARD hide');

		this.map.showSidebar = false;
		this._isActive = false;
		this._dialogid = '';
		this._currentPath = [];

		window.pageMobileWizard = false;

		if (window.mobileWizard === true)
			window.mobileWizard = false;

		if (window.insertionMobileWizard === true)
			window.insertionMobileWizard = false;

		if (window.pageMobileWizard === true)
			window.pageMobilewizard = false;

		if (this.map.getDocType() === 'presentation' || this.map.getDocType() === 'drawing')
			this._hideSlideSorter();

		if (window.commentWizard === true)
			window.commentWizard = false;

		this._updateToolbarItemStateByClose();

		if (!this.map.hasFocus()) {
			this.map.focus();
		}

		var stb = document.getElementById('spreadsheet-toolbar');
		if (stb)
			stb.style.display = 'block';
	},

	isOpen: function() {
		return $('#mobile-wizard').is(':visible');
	},

	_updateToolbarItemStateByClose: function() {
		var toolbar = w2ui['actionbar'];
		if (toolbar)
		{
			if (window.mobileWizard === false && toolbar.get('mobile_wizard').checked)
				toolbar.uncheck('mobile_wizard');

			if (window.insertionMobileWizard === false && toolbar.get('insertion_mobile_wizard').checked)
				toolbar.uncheck('insertion_mobile_wizard');
			if (window.commentWizard === false && toolbar.get('comment_wizard').checked)
				toolbar.uncheck('comment_wizard');
		}
	},

	goLevelDown: function(contentToShow, options) {
		if (this.contents.length)
			this.contents[this.contents.length - 1].goLevelDown(contentToShow, options);
	},

	goLevelUp: function() {
		if (this.contents.length)
			this.contents[this.contents.length - 1].goLevelUp();
	},

	_onResize: function() {
		L.DomUtil.updateElementsOrientation(['mobile-wizard', 'mobile-wizard-content']);
	},

	selectedTab: function(tabText) {
		var topWindow = this.contents.length ? this.contents[this.contents.length - 1] : null;
		if (topWindow)
			topWindow.selectedTab(tabText);
	},

	_getContentForWindowId: function(id) {
		for (var i in this.contents) {
			if (this.contents[i].id === 'mobile-wizard-content-' + id)
				return this.contents[i];
		}

		return null;
	},

	_refreshSidebar: function(ms) {
		ms = ms !== undefined ? ms : 400;
		setTimeout(function () {
			var message = 'dialogevent ' +
			    (window.sidebarId !== undefined ? window.sidebarId : -1) +
			    ' {"id":"-1"}';
			app.socket.sendMessage(message);
		}, ms);
	},

	_onMobileWizard: function(data) {
		var callback = data.callback;
		data = data.data;
		if (data) {
			var existingWindow = this._getContentForWindowId(data.id);
			if (existingWindow) {
				existingWindow._onMobileWizard(data, callback);
			} else {
				var newWindow = L.control.mobileWizardWindow(this, 'mobile-wizard-content-' + data.id);
				for (var i in this.contents)
					this.contents[i].hideWindow();
				this.contents.push(newWindow);
				this.map.addControl(newWindow);
				newWindow._onMobileWizard(data, callback);
			}
		}
	},

	removeWindow: function(window) {
		var pos = this.contents.indexOf(window);
		if (pos >= 0) {
			var wasPopup = false;
			// popup was closed so go level up in parent
			if (pos > 0 && this.contents[pos].isPopup) {
				wasPopup = true;
			}

			this.map.removeControl(window);
			this.contents.splice(pos, 1);
			if (this.contents.length) {
				var parentWindow = this.contents[this.contents.length - 1];
				parentWindow.showWindow();
				if (wasPopup)
					parentWindow.goLevelUp();
			}
			this._hideWizard();
		}
	},

	_hideSlideSorter: function() {
		document.getElementById('mobile-wizard-header').style.display = 'none';
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype === 'notebookbar')
			return;

		var existingWindow = this._getContentForWindowId(data.id);
		if (existingWindow) {
			existingWindow.onJSUpdate(e);
		}
	},

	onJSAction: function (e) {
		var data = e.data;

		if (data.jsontype === 'notebookbar')
			return;

		var existingWindow = this._getContentForWindowId(data.id);
		if (existingWindow) {
			existingWindow.onJSAction(e);
		}
	},
});

L.control.mobileWizard = function (options) {
	return new L.Control.MobileWizard(options);
};
