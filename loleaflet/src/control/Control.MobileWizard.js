/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileWizard
 */

/* global $ w2ui */
L.Control.MobileWizard = L.Control.extend({
	options: {
		maxHeight: '45%',
		idPrefix: '#mobile-wizard',
		classPrefix: '.mobile-wizard',
		nameElement: 'mobile-wizard'
	},

	_inMainMenu: true,
	_isActive: false,
	_inBuilding: false,
	_currentDepth: 0,
	_mainTitle: '',
	_isTabMode: false,
	_currentPath: [],
	_tabs: [],
	_currentScrollPosition: 0,

	initialize: function (options) {
		L.setOptions(this, options);
		this._container = L.DomUtil.get(this.options.idPrefix);
	},

	onAdd: function (map) {
		this._map = map;

		// for the moment, the mobile-wizard is mobile phone only
		if (!window.mode.isMobile())
			return;

		map.on('mobilewizard', this._onMobileWizard, this);
		map.on('closemobilewizard', this._hideWizard, this);
		map.on('showwizardsidebar', this._showWizardSidebar, this);
		map.on('mobilewizardback', this.goLevelUp, this);
		map.on('resize', this._onResize, this);

		this._setupBackButton();
	},

	_reset: function() {
		this._currentDepth = 0;
		this._inMainMenu = true;
		this.content.empty();
		this.backButton.addClass('close-button');
		$(this.options.idPrefix + '-tabs').empty();
		$(this.options.idPrefix + '-tabs').hide();
		$(this.options.idPrefix + '-titlebar').show();
		$(this.options.idPrefix + '-titlebar').css('top', '0px');
		$(this.options.idPrefix).removeClass('menuwizard');
		$(this.options.idPrefix).removeClass('funcwizard');
		this._isTabMode = false;
		this._currentPath = [];
		this._tabs = [];
		this._currentScrollPosition = 0;
	},

	_setupBackButton: function() {
		this.content = $(this.options.idPrefix + '-content', $(this._container));
		this.backButton = $(this.options.idPrefix + '-back');
		this.backButton.click(function() { history.back(); });
		$(this.backButton).addClass('close-button');
	},

	_showWizard: function(ContentsLength) {
		var docType = this._map.getDocType();
		//console.log('ContentsLength: ' + ContentsLength + ' | docType: ' + docType + '$(#mobile-wizard-content).scrollTop();'  + 'this._isTabMode: ' + this._isTabMode + ' | _tabs: ' + this._tabs);
		var maxScrolled = 52;
		if ((ContentsLength > 5 || this._tabs) && !window.mobileMenuWizard) {
			$(this.options.idPrefix + '-content').append('<div id="' + this.options.nameElement + '-scroll-indicator" style="width: 100%;height: 0px;position: fixed;z-index: 2;bottom: -7px;box-shadow: 0 -8px 20px 4px #0b87e770, 0 1px 10px 6px #0b87e7;"></div>');
		}
		if (docType == 'spreadsheet')
			maxScrolled = 30;
		else if (docType == 'presentation')
			maxScrolled = 20;
		$(this.options.idPrefix).show();
		$(this.options.idPrefix + '-content').on('scroll', function() {
			var mWizardContentScroll = $(this.options.idPrefix + '-content').scrollTop();
			var height = $(this.options.idPrefix + '-content').prop('scrollHeight');
			var scrolled = (mWizardContentScroll / height) * 100;
			if (scrolled > maxScrolled) {$(this.options.idPrefix + '-scroll-indicator').css('display','none');}
			else {$(this.options.idPrefix + '-scroll-indicator').css('display','block');}
		});
		$('#toolbar-down').hide();
		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('MOBILEWIZARD show');
		if (window.mobileMenuWizard)
			this._map.showSidebar = false;
	},

	_showWizardSidebar: function() {
		this._map.showSidebar = true;
		this._refreshSidebar();
	},

	_hideWizard: function() {
		// dialog
		if (this._map.dialog.hasDialogInMobilePanelOpened()) {
			this._map.dialog._onDialogClose(window.mobileDialogId, true);
			window.mobileDialogId = undefined;
		}

		$(this.options.idPrefix).hide();
		$(this.options.idPrefix + '-content').empty();
		if (this._map.isPermissionEdit()) {
			$('#toolbar-down').show();
		}
		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('MOBILEWIZARD hide');

		this._map.showSidebar = false;
		this._isActive = false;
		this._currentPath = [];
		if (window.mobileWizard === true)
			window.mobileWizard = false;

		if (window.insertionMobileWizard === true)
			window.insertionMobileWizard = false;

		if (window.pageMobileWizard === true)
			window.pageMobilewizard = false;

		if (this._map.getDocType() === 'presentation')
			this._hideSlideSorter();

		this._updateToolbarItemStateByClose();

		if (!this._map.hasFocus()) {
			this._map.focus();
		}

		this._updateMapSize();
	},

	isOpen: function() {
		return $(this.options.idPrefix).is(':visible');
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
		$(this.options.idPrefix + '-tabs').show();
		$(this.options.idPrefix + '-tabs').empty();
		$(this.options.idPrefix + '-tabs').append(tabs);
		$(this.options.idPrefix + '-titlebar').hide();
		this._isTabMode = true;
	},

	setCurrentScrollPosition: function() {
		this._currentScrollPosition = $(this.options.idPrefix + '-content').scrollTop();
	},

	goLevelDown: function(contentToShow, options) {
		var animate = (options && options.animate != undefined) ? options.animate : true;

		if (!this._isTabMode || this._currentDepth > 0)
			this.backButton.removeClass('close-button');

		if (this._isTabMode && this._currentDepth > 0) {
			$(this.options.idPrefix + '-titlebar').show();
			$(this.options.idPrefix + '-tabs').hide();
		}

		var titles = '.ui-header.level-' + this.getCurrentLevel() + this.options.classPrefix + ':visible';

		if (animate)
			$(titles).hide('slide', { direction: 'left' }, 'fast');
		else
			$(titles).hide();

		$(this.options.idPrefix + ' .ui-effects-placeholder').hide();

		var nodesToHide = $(contentToShow).siblings();

		var duration = 10;
		if (animate)
			nodesToHide.hide('slide', { direction: 'left' }, duration);
		else
			nodesToHide.hide();

		$(this.options.idPrefix + '.funcwizard div' + this.options.idPrefix + '-content').removeClass('hideHelpBG');
		$(this.options.idPrefix + '.funcwizard div' + this.options.idPrefix + '-content').addClass('showHelpBG');

		if (animate)
			$(contentToShow).show('slide', { direction: 'right' }, 'fast');
		else
			$(contentToShow).show();

		this._currentDepth++;
		if (!this._inBuilding)
			history.pushState({context: this.options.nameElement, level: this._currentDepth}, this.options.nameElement + '-level-' + this._currentDepth);
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
				w2ui['actionbar'].click('mobile_wizard');
			} else if (window.insertionMobileWizard === true) {
				w2ui['actionbar'].click('insertion_mobile_wizard');
			} else if (window.mobileMenuWizard === true) {
				$('#main-menu-state').click();
			} else if (window.contextMenuWizard) {
				window.contextMenuWizard = false;
				this._map.fire('closemobilewizard');
			}
		} else {
			this._currentDepth--;

			var parent = $('.ui-content' + this.options.classPrefix + ':visible');
			if (this._currentDepth > 0 && parent)
				this._setTitle(parent.get(0).title);
			else
				this._setTitle(this._mainTitle);

			var headers;
			if (this._currentDepth === 0) {
				headers = $('.ui-header.level-' + this._currentDepth + this.options.classPrefix);
				
			} else {
				headers = $('.ui-content.level-' + this._currentDepth + this.options.classPrefix + ':visible').siblings()
					.not('.ui-content.level-' + this._currentDepth + this.options.classPrefix);
			}

			$('.ui-content.level-' + this._currentDepth + this.options.classPrefix + ':visible').hide();
			$(this.options.idPrefix + '.funcwizard div' + this.options.idPrefix + '-content').removeClass('showHelpBG');
			$(this.options.idPrefix + '.funcwizard div' + this.options.idPrefix + '-content').addClass('hideHelpBG');
			headers.show('slide', { direction: 'left' }, 'fast');

			if (this._currentDepth == 0 || (this._isTabMode && this._currentDepth == 1)) {
				this._inMainMenu = true;
				this.backButton.addClass('close-button');
				if (this._isTabMode) {
					$(this.options.idPrefix + '-titlebar').hide();
					$(this.options.idPrefix + '-tabs').show();
				}
			}
		}
	},

	_onResize: function() {
		L.DomUtil.updateElementsOrientation([this.options.nameElement, this.options.nameElement + '-content']);
	},

	_setTitle: function(title) {
		var right = $(this.options.idPrefix + '-title', $(this._container));
		right.text(title);
	},

	_scrollToPosition: function(position) {
		if (this._currentScrollPosition) {
			$(this.options.idPrefix + '-content').animate({ scrollTop: position }, 0);
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
		// when dialog has tabs, tab selection triggers the callback, causes infinite regenetate loop
		if (this._tabs && path && path.length && !this._map.dialog.hasDialogInMobilePanelOpened())
			this._selectTab(path[0]);

		var _path = [];
		var goBack = false;

		for (var index in path) {
			var elem = $('[title=\'' + path[index] + '\'').prev();
			if (elem.length) {
				$(elem).trigger('click', {animate: false});
				_path.push(path[index]);
			}
			else
				goBack = true;
		}

		if (goBack) {
			this._currentScrollPosition = 0;
			$(this.options.idPrefix + '-content').animate({ scrollTop: 0 }, 0);
		}

		this._currentPath = _path;
	},

	_refreshSidebar: function(ms) {
		ms = ms !== undefined ? ms : 400;
		var map = this._map;
		setTimeout(function () {
			var message = 'dialogevent ' +
			    (window.sidebarId !== undefined ? window.sidebarId : -1) +
			    ' {"id":"-1"}';
			map._socket.sendMessage(message);
		}, ms);
	},

	_updateMapSize: function() {
		window.updateMapSizeForWizard = this._map.getDocType() === 'presentation' && this._isActive;
		this._map.invalidateSize();
	},

	_onMobileWizard: function(data) {
		if (data) {
			this._inBuilding = true;

			var isSidebar = (data.children && data.children.length >= 1 &&
					 data.children[0].type == 'deck');

			if (!this._isActive && isSidebar) {
				if (this._map.showSidebar == false)
					return;
			}
			if (isSidebar && !this._map.showSidebar) {
				return;
			}

			var isMobileDialog = data.id && !isNaN(data.id) && !isSidebar;
			if (isMobileDialog) {
				// id is a number - remember window id for interaction
				window.mobileDialogId = data.id;
			}

			if (this._map.getDocType() === 'presentation' && this._isSlidePropertyPanel(data))
				this._showSlideSorter();

			this._isActive = true;
			var currentPath = null;
			var lastScrollPosition = null;
			var alreadyOpen = this.isOpen();

			if (this._currentPath)
				currentPath = this._currentPath;
			if (this._currentScrollPosition)
				lastScrollPosition = this._currentScrollPosition;

			this._reset();

			var mWizardContentLength = 0;
			if (data.children.length > 0) {
				if (data.children[0].type == 'menuitem' || data.children[0].children === undefined)
					mWizardContentLength = data.children.length;
				else mWizardContentLength = data.children[0].children.length;
			}

			this._showWizard(mWizardContentLength);
			if (!this._map._docLayer.isCalc()) {
				// In Calc, the wizard is used for the formulas,
				// and it's easier to allow the user to search
				// for a formula by typing the first few characters.
				this._hideKeyboard();
			}

			// Morph the sidebar into something prettier
			if (isSidebar)
				this._modifySidebarLayout(data);

			if (!alreadyOpen) {
				history.pushState({context: this.options.nameElement}, this.options.nameElement + '-opened');
				history.pushState({context: this.options.nameElement, level: 0}, this.options.nameElement + '-level-0');
			}

			var builder = L.control.jsDialogBuilder({mobileWizard: this, map: this._map, cssClass: this.options.nameElement});
			builder.build(this.content.get(0), [data]);

			this._mainTitle = data.text ? data.text : '';
			this._setTitle(this._mainTitle);

			if (data.id === 'menubar' || data.id === 'insertshape') {
				$(this.options.idPrefix).height('100%');
				if (data.id === 'menubar')
					$(this.options.idPrefix).addClass('menuwizard');
				else if (data.id === 'insertshape') {
					$(this.options.idPrefix).addClass('shapeswizard');
				}
				if (this._map.getDocType() === 'spreadsheet')
					$(this.options.idPrefix).css('top', $('#spreadsheet-row-column-frame').css('top'));
				else
					$(this.options.idPrefix).css('top', $('#document-container').css('top'));
			} else if (data.id === 'funclist') {
				$(this.options.idPrefix).height('100%');
				$(this.options.idPrefix).css('top', $('#spreadsheet-row-column-frame').css('top'));
				$(this.options.idPrefix).addClass('funcwizard');
			} else {
				$(this.options.idPrefix).height(this.options.maxHeight);
				$(this.options.idPrefix).css('top', '');
			}

			if (this._isActive && currentPath.length) {
				this._goToPath(currentPath);
				this._scrollToPosition(lastScrollPosition);
			}

			this._updateMapSize();

			this._inBuilding = false;
		}
	},

	// These 2 functions show/hide mobile-slide-sorter.
	_showSlideSorter: function() {
		document.getElementById(this.options.nameElement + '-header').style.display = 'block';
	},

	_hideSlideSorter: function() {
		document.getElementById(this.options.nameElement + '-header').style.display = 'none';
	},

	_isSlidePropertyPanel: function(data) {
		if (data.children.length > 0 && data.children[0].children && data.children[0].children.length > 1) {
			var panels = data.children[0].children;
			return panels[0].id === 'SlideBackgroundPanel' && panels[1].id === 'SdLayoutsPanel';
		} else {
			return false;
		}
	},

	_insertCalcBorders: function(deck) {
		var replaceMe = L.LOUtil.findItemWithAttributeRecursive(deck, 'id', 'cellbordertype');
		if (replaceMe) {
			replaceMe.id = 'borderstyle';
			replaceMe.type = 'borderstyle';
			replaceMe.text = '';
			replaceMe.enabled = 'true';
			replaceMe.children = [];
		}
	},

	_modifySidebarLayout: function (data) {
		var deck = L.LOUtil.findItemWithAttributeRecursive(data, 'type', 'deck');
		if (deck)
		{
			// merge styles into text-panel for elegance
			var stylesIdx = L.LOUtil.findIndexInParentByAttribute(deck, 'id', 'StylesPropertyPanel');
			var textIdx = L.LOUtil.findIndexInParentByAttribute(deck, 'id', 'TextPropertyPanel');

			if (stylesIdx >= 0 && this._map.getDocType() === 'spreadsheet')
			{       // remove rather useless calc styles panel
				deck.children.splice(stylesIdx, 1);
			}
			else if (stylesIdx >= 0 && textIdx >= 0)
			{
				var moveContent = deck.children[stylesIdx].children[0].children;
				deck.children[textIdx].children[0].children = moveContent.concat(deck.children[textIdx].children[0].children);
				deck.children.splice(stylesIdx, 1); //remove the styles property
			}
			var removeItems = ['borderlinestyle', 'editcontour', 'spacingbar',
					   'linespacing', 'stylenew', 'styleupdate',
					   'beginarrowstyle', 'endarrowstyle'];

			if (this._map.getDocType() === 'presentation')
				removeItems.push('indentfieldbox');

			this._removeItems(deck, removeItems);

			this._insertCalcBorders(deck);
		}
	},

	_removeItems: function (data, items) {
		if (data.children) {
			for (var i = 0; i < data.children.length;) {
				var childRemoved = false;
				for (var j = 0; j < items.length; j++) {
					if (data.children[i].id === items[j]) {
						data.children.splice(i, 1);
						childRemoved = true;
						break;
					}
				}
				if (!childRemoved)
				{
					if (data.children[i])
						this._removeItems(data.children[i], items);
					i++;
				}
			}
		}
	},
});

L.control.mobileWizard = function (options) {
	return new L.Control.MobileWizard(options);
};
