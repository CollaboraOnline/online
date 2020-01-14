/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileWizard
 */

/* global $ w2ui */
L.Control.MobileWizard = L.Control.extend({
	options: {
		maxHeight: '45%'
	},

	_inMainMenu: true,
	_isActive: false,
	_currentDepth: 0,
	_mainTitle: '',
	_isTabMode: false,
	_currentPath: [],
	_tabs: [],
	_currentScrollPosition: 0,

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this.map = map;
		map.on('mobilewizard', this._onMobileWizard, this);
		map.on('closemobilewizard', this._hideWizard, this);
		map.on('showwizardsidebar', this._showWizardSidebar, this);
		map.on('mobilewizardback', this.goLevelUp, this);

		this._setupBackButton();
	},

	_reset: function() {
		this._currentDepth = 0;
		this._inMainMenu = true;
		this.content.empty();
		this.backButton.addClass('close-button');
		$('#mobile-wizard-tabs').empty();
		$('#mobile-wizard-tabs').hide();
		$('#mobile-wizard-titlebar').show();
		$('#mobile-wizard-titlebar').css('top', '0px');
		$('#mobile-wizard').removeClass('menuwizard');
		this._isTabMode = false;
		this._currentPath = [];
		this._tabs = [];
		this._currentScrollPosition = 0;
	},

	_setupBackButton: function() {
		var that = this;
		this.content = $('#mobile-wizard-content');
		this.backButton = $('#mobile-wizard-back');
		this.backButton.click(function() { that.goLevelUp(); });
		$(this.backButton).addClass('close-button');
	},

	_showWizard: function() {
		$('#mobile-wizard').show();
		$('#toolbar-down').hide();
		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('MOBILEWIZARD show');
	},

	_showWizardSidebar: function() {
		this.map.showSidebar = true;
		this._refreshSidebar();
		this._showWizard();
	},

	_hideWizard: function() {
		$('#mobile-wizard').hide();
		$('#mobile-wizard-content').empty();
		if (this.map._permission === 'edit') {
			$('#toolbar-down').show();
		}
		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('MOBILEWIZARD hide');

		this.map.showSidebar = false;
		this._isActive = false;
		this._currentPath = [];
		if (window.mobileWizard === true)
			window.mobileWizard = false;

		if (window.insertionMobileWizard === true)
			window.insertionMobileWizard = false;

		this._updateToolbarItemStateByClose();

		if (!this.map.hasFocus()) {
			this.map.focus();
		}
	},

	_hideKeyboard: function() {
		document.activeElement.blur();
	},

	_updateToolbarItemStateByClose: function() {
		var toolbar = w2ui['actionbar'];
		if (toolbar)
		{
			if (window.mobileWizard === false && toolbar.get('mobile_wizard').checked)
				toolbar.uncheck('mobile_wizard');

			if (window.insertionMobileWizard === false && toolbar.get('insertion_mobile_wizard').checked)
				toolbar.uncheck('insertion_mobile_wizard');
		}
	},

	getCurrentLevel: function() {
		return this._currentDepth;
	},

	setTabs: function(tabs) {
		this._tabs = tabs;
		$('#mobile-wizard-tabs').show();
		$('#mobile-wizard-tabs').empty();
		$('#mobile-wizard-tabs').append(tabs);
		$('#mobile-wizard-titlebar').hide();
		this._isTabMode = true;
	},

	setCurrentScrollPosition: function() {
		this._currentScrollPosition = $('#mobile-wizard-content').scrollTop();
	},

	goLevelDown: function(contentToShow, options) {
		var animate = (options && options.animate != undefined) ? options.animate : true;

		if (!this._isTabMode || this._currentDepth > 0)
			this.backButton.removeClass('close-button');

		if (this._isTabMode && this._currentDepth > 0) {
			$('#mobile-wizard-titlebar').show();
			$('#mobile-wizard-tabs').hide();
		}

		var titles = '.ui-header.level-' + this.getCurrentLevel() + '.mobile-wizard';

		if (animate)
			$(titles).hide('slide', { direction: 'left' }, 'fast');
		else
			$(titles).hide();

		$(contentToShow).siblings().hide();
		$('#mobile-wizard.funcwizard div#mobile-wizard-content').removeClass('hideHelpBG');
		$('#mobile-wizard.funcwizard div#mobile-wizard-content').addClass('showHelpBG');

		if (animate)
			$(contentToShow).show('slide', { direction: 'right' }, 'fast');
		else
			$(contentToShow).show();

		this._currentDepth++;
		this._setTitle(contentToShow.title);
		this._inMainMenu = false;

		this._currentPath.push(contentToShow.title);
	},

	goLevelUp: function() {
		this._currentPath.pop();
		if (this._inMainMenu || (this._isTabMode && this._currentDepth == 1)) {
			this._hideWizard();
			this._currentDepth = 0;
			if (window.mobileWizard === true) {
				w2ui['actionbar'].click('mobile_wizard')
			} else if (window.insertionMobileWizard === true) {
				w2ui['actionbar'].click('insertion_mobile_wizard')
			} else if (window.mobileMenuWizard === true) {
				$('#main-menu-state').click()
			} else if (window.contextMenuWizard) {
				window.contextMenuWizard = false;
				this.map.fire('closemobilewizard');
			}
		} else {
			this._currentDepth--;

			var parent = $('.ui-content.mobile-wizard:visible');
			if (this._currentDepth > 0 && parent)
				this._setTitle(parent.get(0).title);
			else
				this._setTitle(this._mainTitle);

			$('.ui-content.level-' + this._currentDepth + '.mobile-wizard').siblings().show('slide', { direction: 'left' }, 'fast');
			$('.ui-content.level-' + this._currentDepth + '.mobile-wizard').hide();
			$('#mobile-wizard.funcwizard div#mobile-wizard-content').removeClass('showHelpBG');
			$('#mobile-wizard.funcwizard div#mobile-wizard-content').addClass('hideHelpBG');
			$('.ui-header.level-' + this._currentDepth + '.mobile-wizard').show('slide', { direction: 'left' }, 'fast');

			if (this._currentDepth == 0 || (this._isTabMode && this._currentDepth == 1)) {
				this._inMainMenu = true;
				this.backButton.addClass('close-button');
				if (this._isTabMode) {
					$('#mobile-wizard-titlebar').hide();
					$('#mobile-wizard-tabs').show();
				}
			}
		}
	},

	_setTitle: function(title) {
		var right = $('#mobile-wizard-title');
		right.text(title);
	},

	_scrollToPosition: function(position) {
		if (this._currentScrollPosition) {
			$('#mobile-wizard-content').animate({ scrollTop: position }, 0);
		}
	},

	selectedTab: function(tabText) {
		if (this._currentPath && this._currentPath.length) {
			this._currentPath = [tabText];
		}
	},

	_selectTab: function(tabId) {
		if (this._tabs && tabId) {
			for (var index in this._tabs.children) {
				if (this._tabs.children[index].id === tabId) {
					$(this._tabs.children[index]).trigger('click', {animate: false});
					break;
				}
			}
		}
	},

	_goToPath: function(path) {
		if (this._tabs && path && path.length)
			this._selectTab(path[0]);

		for (var index in path) {
			$('[title=\'' + path[index] + '\'').prev().trigger('click', {animate: false});
		}

		this._currentPath = path;
	},

	_refreshSidebar: function() {
		var map = this.map;
		setTimeout(function () {
			var message = 'dialogevent ' +
			    (window.sidebarId !== undefined ? window.sidebarId : -1) +
			    ' {\"id\":\"-1\"}';
			map._socket.sendMessage(message);
		}, 400);
	},

	_onMobileWizard: function(data) {
		if (data) {
			var isSidebar = (data.children && data.children.length >= 1 &&
					 data.children[0].type == 'deck');

			if (!this._isActive && isSidebar) {
				if (this.map.showSidebar == false)
					return;
			}

			this._isActive = true;
			var currentPath = null;
			var lastScrollPosition = null;

			if (this._currentPath)
				currentPath = this._currentPath;
			if (this._currentScrollPosition)
				lastScrollPosition = this._currentScrollPosition;

			this._reset();

			this._showWizard();
			this._hideKeyboard();

			// Morph the sidebar into something prettier
			if (isSidebar)
				this._modifySidebarLayout(data);

			L.control.jsDialogBuilder({mobileWizard: this, map: this.map}).build(this.content.get(0), [data]);

			this._mainTitle = data.text ? data.text : '';
			this._setTitle(this._mainTitle);

			if (data.id === 'menubar' || data.id === 'insertshape') {
				$('#mobile-wizard').height('100%');
				if (data.id === 'menubar')
					$('#mobile-wizard').addClass('menuwizard');
				else if (data.id === 'insertshape') {
					$('#mobile-wizard').addClass('shapeswizard');
				}
				if (this.map .getDocType() === 'spreadsheet')
					$('#mobile-wizard').css('top', $('#spreadsheet-row-column-frame').css('top'));
				else
					$('#mobile-wizard').css('top', $('#document-container').css('top'));
			} else if (data.id === 'funclist') {
				$('#mobile-wizard').height('100%');
				$('#mobile-wizard').css('top', $('#spreadsheet-row-column-frame').css('top'));
				$('#mobile-wizard').addClass('funcwizard');
			} else {
				$('#mobile-wizard').height(this.options.maxHeight);
				$('#mobile-wizard').css('top', '');
			}

			if (this._isActive && currentPath.length) {
				this._goToPath(currentPath);
				this._scrollToPosition(lastScrollPosition);
			}
		}
	},

	_modifySidebarLayout: function (data) {
		var deck = this._findItemByTypeRecursive(data, 'deck');
		if (deck)
		{
			// merge styles into text-panel for elegance
			var stylesIdx = this._findIdxInParentById(deck, 'StylesPropertyPanel');
			var textName = 'TextPropertyPanel';
			var textIdx = this._findIdxInParentById(deck, textName);
			if (stylesIdx >= 0 && textIdx >= 0)
			{
				var moveContent = deck.children[stylesIdx].children;
				deck.children.splice(stylesIdx, 1); // remove
				textIdx = this._findIdxInParentById(deck, textName); // re-lookup
				deck.children[textIdx].children = moveContent.concat(deck.children[textIdx].children);
			}
		}

		this._removeItems(data, ['editcontour']);
	},

	_findItemByTypeRecursive: function(data, t) {
		var found = null;
		if (data.type === t)
			return data;
		if (data.children)
		{
			for (var i = 0; !found && i < data.children.length; i++)
				found = this._findItemByTypeRecursive(data.children[i], t);
		}
		return found;
	},

	_findIdxInParentById: function(data, id) {
		if (data.children)
		{
			for (var i = 0; i < data.children.length; i++)
				if (data.children[i].id === id)
					return i;
		}
		return -1;
	},

	_removeItems: function (data, items) {
		if (data.children) {
			var childRemoved = false;
			for (var i = 0; i < data.children.length; i++) {
				for (var j = 0; j < items.length; j++) {
					if (data.children[i].id === items[j]) {
						data.children.splice(i, 1);
						childRemoved = true;
						continue;
					}
				}
				if (childRemoved === true) {
					i = i - 1;
				} else {
					this._removeItems(data.children[i], items);
				}
			}
		}
	},
});

L.control.mobileWizard = function (options) {
	return new L.Control.MobileWizard(options);
};
