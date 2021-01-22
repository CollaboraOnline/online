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
	_inBuilding: false,
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

		// for the moment, the mobile-wizard is mobile phone only
		if (!window.mode.isMobile())
			return;

		map.on('mobilewizard', this._onMobileWizard, this);
		map.on('closemobilewizard', this._hideWizard, this);
		map.on('showwizardsidebar', this._showWizardSidebar, this);
		map.on('mobilewizardback', this.goLevelUp, this);
		map.on('resize', this._onResize, this);
		map.on('jsdialogupdate', this.onJSUpdate, this);

		this._setupBackButton();
	},

	onRemove: function() {
		this.map.off('mobilewizard', this._onMobileWizard, this);
		this.map.off('closemobilewizard', this._hideWizard, this);
		this.map.off('showwizardsidebar', this._showWizardSidebar, this);
		this.map.off('mobilewizardback', this.goLevelUp, this);
		this.map.off('resize', this._onResize, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
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
		$('#mobile-wizard').removeClass('funcwizard');
		this._isTabMode = false;
		this._currentPath = [];
		this._tabs = [];
		this._currentScrollPosition = 0;
	},

	_setupBackButton: function() {
		this.content = $('#mobile-wizard-content');
		this.backButton = $('#mobile-wizard-back');
		this.backButton.click(function() { history.back(); });
		$(this.backButton).addClass('close-button');
	},

	_showWizard: function(ContentsLength) {
		var docType = this._map.getDocType();
		//console.log('ContentsLength: ' + ContentsLength + ' | docType: ' + docType + '$(#mobile-wizard-content).scrollTop();'  + 'this._isTabMode: ' + this._isTabMode + ' | _tabs: ' + this._tabs);
		var maxScrolled = 52;
		if ((ContentsLength > 5 || this._tabs) && !window.mobileMenuWizard) {
			$('#mobile-wizard-content').append('<div id="mobile-wizard-scroll-indicator" style="width: 100%;height: 0px;position: fixed;z-index: 2;bottom: -7px;box-shadow: 0 -8px 20px 4px #0b87e770, 0 1px 10px 6px #0b87e7;"></div>');
		}
		if (docType == 'spreadsheet')
			maxScrolled = 30;
		else if (docType == 'presentation')
			maxScrolled = 20;
		$('#mobile-wizard').show();
		$('#mobile-wizard-content').on('scroll', function() {
			var mWizardContentScroll = $('#mobile-wizard-content').scrollTop();
			var height = $('#mobile-wizard-content').prop('scrollHeight');
			var scrolled = (mWizardContentScroll / height) * 100;
			if (scrolled > maxScrolled) {$('#mobile-wizard-scroll-indicator').css('display','none');}
			else {$('#mobile-wizard-scroll-indicator').css('display','block');}
		});
		$('#toolbar-down').hide();
		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('MOBILEWIZARD show');
		if (window.mobileMenuWizard)
			this.map.showSidebar = false;
	},

	_showWizardSidebar: function() {
		this.map.showSidebar = true;
		this._refreshSidebar();
	},

	_hideWizard: function() {
		// dialog
		if (this.map.dialog.hasDialogInMobilePanelOpened()) {
			this.map.dialog._onDialogClose(window.mobileDialogId, true);
			window.mobileDialogId = undefined;
		}

		if (window.commentWizard === true) {
			var map = this._map;
			$('.ui-header.level-0.mobile-wizard').each(function() {
				map._docLayer._removeHighlightSelectedWizardComment(this.annotation);
			});
		}

		$('#mobile-wizard').hide();
		$('#mobile-wizard-content').empty();
		if (this.map.isPermissionEdit()) {
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

		if (window.pageMobileWizard === true)
			window.pageMobilewizard = false;

		if (this._map.getDocType() === 'presentation')
			this._hideSlideSorter();

		if (window.commentWizard === true)
			window.commentWizard = false;

		this._updateToolbarItemStateByClose();

		if (!this.map.hasFocus()) {
			this.map.focus();
		}

		this._updateMapSize();
	},

	isOpen: function() {
		return $('#mobile-wizard').is(':visible');
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
			if (window.commentWizard === false && toolbar.get('comment_wizard').checked)
				toolbar.uncheck('comment_wizard');
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

		var titles = '.ui-header.level-' + this.getCurrentLevel() + '.mobile-wizard:visible';

		if (animate)
			$(titles).hide('slide', { direction: 'left' }, 'fast');
		else
			$(titles).hide();

		$('#mobile-wizard .ui-effects-placeholder').hide();

		var nodesToHide = $(contentToShow).siblings();

		var duration = 10;
		if (animate)
			nodesToHide.hide('slide', { direction: 'left' }, duration);
		else
			nodesToHide.hide();

		$('#mobile-wizard.funcwizard div#mobile-wizard-content').removeClass('hideHelpBG');
		$('#mobile-wizard.funcwizard div#mobile-wizard-content').addClass('showHelpBG');

		if (animate)
			$(contentToShow).show('slide', { direction: 'right' }, 'fast');
		else
			$(contentToShow).show();

		this._currentDepth++;
		if (!this._inBuilding)
			history.pushState({context: 'mobile-wizard', level: this._currentDepth}, 'mobile-wizard-level-' + this._currentDepth);
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
			} else if (window.commentWizard === true) {
				w2ui['actionbar'].click('comment_wizard');
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

			var headers;
			if (this._currentDepth === 0) {
				headers = $('.ui-header.level-' + this._currentDepth + '.mobile-wizard');
			} else {
				headers = $('.ui-content.level-' + this._currentDepth + '.mobile-wizard:visible').siblings()
					.not('.ui-content.level-' + this._currentDepth + '.mobile-wizard');
			}

			$('.ui-content.level-' + this._currentDepth + '.mobile-wizard:visible').hide();
			$('#mobile-wizard.funcwizard div#mobile-wizard-content').removeClass('showHelpBG');
			$('#mobile-wizard.funcwizard div#mobile-wizard-content').addClass('hideHelpBG');
			headers.show('slide', { direction: 'left' }, 'fast');

			if (this._currentDepth == 0 || (this._isTabMode && this._currentDepth == 1)) {
				this._inMainMenu = true;
				this.backButton.addClass('close-button');
				if (this._isTabMode) {
					$('#mobile-wizard-titlebar').hide();
					$('#mobile-wizard-tabs').show();
				}
			}
			var map = this._map;
			if (window.commentWizard === true) {
				$('.ui-header.level-0.mobile-wizard').each(function() {
					map._docLayer._removeHighlightSelectedWizardComment(this.annotation);
				});

			}
		}
	},

	_onResize: function() {
		L.DomUtil.updateElementsOrientation(['mobile-wizard', 'mobile-wizard-content']);
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
		// when dialog has tabs, tab selection triggers the callback, causes infinite regenetate loop
		if (this._tabs && path && path.length && !this.map.dialog.hasDialogInMobilePanelOpened())
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
			$('#mobile-wizard-content').animate({ scrollTop: 0 }, 0);
		}

		this._currentPath = _path;
	},

	_refreshSidebar: function(ms) {
		ms = ms !== undefined ? ms : 400;
		var map = this.map;
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
				if (this.map.showSidebar == false)
					return;
			}
			if (isSidebar && !this.map.showSidebar) {
				return;
			}

			var isMobileDialog = data.id && !isNaN(data.id) && !isSidebar;
			if (isMobileDialog) {
				// id is a number - remember window id for interaction
				window.mobileDialogId = data.id;
			}

			if (this.map.getDocType() === 'presentation' && this._isSlidePropertyPanel(data))
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
				history.pushState({context: 'mobile-wizard'}, 'mobile-wizard-opened');
				history.pushState({context: 'mobile-wizard', level: 0}, 'mobile-wizard-level-0');
			}

			var builder = L.control.mobileWizardBuilder({mobileWizard: this, map: this.map, cssClass: 'mobile-wizard'});
			builder.build(this.content.get(0), [data]);

			this._mainTitle = data.text ? data.text : '';
			this._setTitle(this._mainTitle);

			if (data.id === 'menubar' || data.id === 'insertshape') {
				$('#mobile-wizard').height('100%');
				if (data.id === 'menubar')
					$('#mobile-wizard').addClass('menuwizard');
				else if (data.id === 'insertshape') {
					$('#mobile-wizard').addClass('shapeswizard');
				}
				if (this.map.getDocType() === 'spreadsheet')
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

			this._updateMapSize();

			this._inBuilding = false;
		}
	},

	// These 2 functions show/hide mobile-slide-sorter.
	_showSlideSorter: function() {
		document.getElementById('mobile-wizard-header').style.display = 'block';
	},

	_hideSlideSorter: function() {
		document.getElementById('mobile-wizard-header').style.display = 'none';
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

			if (stylesIdx >= 0 && this.map.getDocType() === 'spreadsheet')
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

			if (this.map.getDocType() === 'presentation')
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

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype === 'notebookbar')
			return;

		if (data.id !== window.mobileDialogId)
			return;

		var container = this.content.get(0);
		if (!container)
			return;

		var control = container.querySelector('#' + data.control.id);
		if (!control) {
			console.warn('jsdialogupdate: not found control with id: "' + data.control.id + '"');
			return;
		}

		var parent = control.parentNode;
		if (!parent)
			return;

		var oldFocus = document.activeElement;

		control.style.visibility = 'hidden';
		var builder = new L.control.mobileWizardBuilder({windowId: data.id,
			mobileWizard: this,
			map: this.map,
			cssClass: 'mobile-wizard'});

		var temporaryParent = L.DomUtil.create('div');
		builder.build(temporaryParent, [data.control], false);
		parent.insertBefore(temporaryParent.firstChild, control.nextSibling);
		L.DomUtil.remove(control);

		oldFocus.focus();
	},
});

L.control.mobileWizard = function (options) {
	return new L.Control.MobileWizard(options);
};
