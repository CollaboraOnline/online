/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileWizard
 */

/* global app $ w2ui */
L.Control.MobileWizard = L.Control.extend({
	options: {
		maxHeight: '45vh',
		snackbarTimeout: 6000
	},

	_builder: null,
	_inMainMenu: true,
	_isActive: false,
	_inBuilding: false,
	_currentDepth: 0,
	_mainTitle: '',
	_customTitle: false,
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
		map.on('jsdialogaction', this.onJSAction, this);

		this._setupBackButton();
	},

	onRemove: function() {
		this.map.off('mobilewizard', this._onMobileWizard, this);
		this.map.off('closemobilewizard', this._hideWizard, this);
		this.map.off('showwizardsidebar', this._showWizardSidebar, this);
		this.map.off('mobilewizardback', this.goLevelUp, this);
		this.map.off('resize', this._onResize, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
		this.map.off('jsdialogaction', this.onJSAction, this);
	},

	_reset: function() {
		this._currentDepth = 0;
		this._inMainMenu = true;
		this.content.empty();
		this.backButton.show();
		this.backButton.addClass('close-button');
		$('#mobile-wizard-tabs').empty();
		$('#mobile-wizard-tabs').hide();
		$('#mobile-wizard-titlebar').show();
		$('#mobile-wizard-titlebar').css('top', '0px');
		$('#mobile-wizard').removeClass('menuwizard');
		$('#mobile-wizard').removeClass('funcwizard');
		$('#mobile-wizard').removeClass('popup');
		$('#mobile-wizard').removeClass('snackbar');
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
		if (this.snackBarTimout)
			clearTimeout(this.snackBarTimout);

		var docType = this._map.getDocType();
		//window.app.console.log('ContentsLength: ' + ContentsLength + ' | docType: ' + docType + '$(#mobile-wizard-content).scrollTop();'  + 'this._isTabMode: ' + this._isTabMode + ' | _tabs: ' + this._tabs);
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

		var stb = document.getElementById('spreadsheet-toolbar');
		if (stb)
			stb.style.display = 'none';

		if (!document.getElementById('document-container').classList.contains('landscape')) {
			var pcw = document.getElementById('presentation-controls-wrapper');
			if (pcw)
				pcw.style.display = 'none';
		}
	},

	_showWizardSidebar: function(event) {
		this.map.showSidebar = true;
		if (!event || !event.noRefresh)
			this._refreshSidebar();
	},

	_hideWizard: function() {
		$('.jsdialog-overlay').remove();

		// dialog
		if (this.map.dialog.hasDialogInMobilePanelOpened()) {
			this.map.dialog._onDialogClose(window.mobileDialogId, true);
			window.mobileDialogId = undefined;
		}

		if (window.commentWizard === true && app.sectionContainer) {
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).removeHighlighters();
		}

		$('#mobile-wizard').hide();
		document.getElementById('mobile-wizard').classList.remove('menuwizard');
		document.getElementById('mobile-wizard').classList.remove('shapeswizard');
		if (!document.getElementById('document-container').classList.contains('landscape')) {
			var pcw = document.getElementById('presentation-controls-wrapper');
			if (pcw)
				pcw.style.display = 'block';
		}
		$('#mobile-wizard-content').empty();
		if (this.map.isPermissionEdit()) {
			$('#toolbar-down').show();
		}
		if (window.ThisIsTheAndroidApp)
			window.postMobileMessage('MOBILEWIZARD hide');

		this.map.showSidebar = false;
		this._isActive = false;
		this._currentPath = [];

		window.pageMobileWizard = false;

		if (window.mobileWizard === true)
			window.mobileWizard = false;

		if (window.insertionMobileWizard === true)
			window.insertionMobileWizard = false;

		if (window.pageMobileWizard === true)
			window.pageMobilewizard = false;

		if (this._map.getDocType() === 'presentation' || this._map.getDocType() === 'drawing')
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

	_hideKeyboard: function() {
		this.map.blur();
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

		$('#mobile-wizard .ui-effects-placeholder').hide();

		var nodesToHide = $(contentToShow).siblings().not('.mobile-wizard-scroll-indicator');

		var parent = $(contentToShow).parent();
		if (parent.hasClass('toolbox'))
			nodesToHide = nodesToHide.add(parent.siblings().not('.mobile-wizard-scroll-indicator'));

		var duration = 10;
		if (animate) {
			nodesToHide.hide('slide', { direction: 'left' }, duration);
			// be sure all is hidden, sometimes jQuery doesn't work here ...
			// restoreStyle is called in some jQuery cleanup what causes showing nodes again
			setTimeout(function() { nodesToHide.hide(); }, duration + 5);
		}
		else
			nodesToHide.hide();

		$(contentToShow).children('.ui-header').hide();

		$('#mobile-wizard.funcwizard div#mobile-wizard-content').removeClass('hideHelpBG');
		$('#mobile-wizard.funcwizard div#mobile-wizard-content').addClass('showHelpBG');

		if (animate)
			$(contentToShow).children('.ui-content').first().show('slide', { direction: 'right' }, 'fast');
		else
			$(contentToShow).children('.ui-content').first().show();

		this._currentDepth++;
		if (!this._inBuilding)
			history.pushState({context: 'mobile-wizard', level: this._currentDepth}, 'mobile-wizard-level-' + this._currentDepth);

		var title = $(contentToShow).children('.ui-content').get(0).title;

		if (this._customTitle)
			this._setCustomTitle(this._customTitle);
		else
			this._setTitle(title);

		this._inMainMenu = false;

		this._currentPath.push(title);
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
				this._customTitle ? this._setCustomTitle(parent.get(0).customTitleBar) : this._setTitle(parent.get(0).title);
			else
				this._customTitle ? this._setCustomTitle(this._customTitle) : this._setTitle(this._mainTitle);

			var currentNode = $('.ui-explorable-entry.level-' + this._currentDepth + '.mobile-wizard:visible');
			var headers = currentNode.siblings();
			var currentHeader = currentNode.children('.ui-header');
			headers = headers.add(currentHeader);

			var parent = currentNode.parent();
			if (parent.hasClass('toolbox'))
				headers = headers.add(parent.siblings());

			headers = headers.not('.hidden');

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
			if (window.commentWizard === true) {
				app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).removeHighlighters();
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

	_setCustomTitle: function(title) {
		var right = $('#mobile-wizard-title');
		right.html(title);
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
			if (data.jsontype === 'autofilter' && (data.visible === 'false' || data.visible === false))
				return;

			this._inBuilding = true;

			var isPopup = data.type === 'modalpopup' || data.type === 'snackbar';
			var isSidebar = false;
			if (data.children) {
				for (var i in data.children) {
					if (data.children[i].type == 'deck')
						isSidebar = true;
				}
			}

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

			this._isActive = true;
			var currentPath = null;
			var lastScrollPosition = null;
			var alreadyOpen = this.isOpen();

			if (this._currentPath)
				currentPath = this._currentPath;
			if (this._currentScrollPosition)
				lastScrollPosition = this._currentScrollPosition;

			if (isPopup) {
				var popupContainer = $('.mobile-popup-container:visible');
				if (popupContainer.length) {
					// for menubutton we inject popup into menu structure
					if (data.action === 'close' || data.action === 'fadeout') {
						this.goLevelUp();
						popupContainer.empty();
					} else {
						this.backButton.hide();
						popupContainer.empty();
						this._builder = L.control.mobileWizardBuilder({windowId: data.id, mobileWizard: this, map: this.map, cssClass: 'mobile-wizard'});
						this._builder.build(popupContainer.get(0), [data]);
					}

					this._inBuilding = false;
					return;
				} else if (data.action === 'close' || data.action === 'fadeout') {
					this._hideWizard();
					return;
				} else {
					// normal popup - continue to open mobile wizard
					L.DomUtil.create('div', 'mobile-wizard jsdialog-overlay', document.body);
				}
			}

			this._reset();

			var mWizardContentLength = 0;
			if (data.children.length > 0) {
				if (data.children[0].type == 'menuitem' || data.children[0].children === undefined)
					mWizardContentLength = data.children.length;
				else mWizardContentLength = data.children[0].children.length;
			}

			this._showWizard(mWizardContentLength);
			if (this._map._docLayer && !this._map._docLayer.isCalc()) {
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

			this._builder = L.control.mobileWizardBuilder({windowId: data.id, mobileWizard: this, map: this.map, cssClass: 'mobile-wizard', callback: callback});
			this._builder.build(this.content.get(0), [data]);
			if (window.ThisIsTheAndroidApp)
				window.postMobileMessage('hideProgressbar');

			this._mainTitle = data.text ? data.text : '';
			this._customTitle = data.customTitle;

			this._customTitle ? this._setCustomTitle(this._customTitle) : this._setTitle(this._mainTitle);

			if (data.id === 'menubar' || data.id === 'insertshape') {
				document.getElementById('mobile-wizard').style.height = '100vh';
				if (data.id === 'menubar')
					$('#mobile-wizard').addClass('menuwizard');
				else if (data.id === 'insertshape') {
					$('#mobile-wizard').addClass('shapeswizard');
				}
				$('#mobile-wizard').css('top', $('#document-container').css('top'));
			} else if (data.id === 'funclist') {
				document.getElementById('mobile-wizard').style.height = '100vh';
				$('#mobile-wizard').css('top', $('#document-container').css('top'));
				$('#mobile-wizard').addClass('funcwizard');
			} else {
				document.getElementById('mobile-wizard').style.height = this.options.maxHeight;
				$('#mobile-wizard').css('top', '');
			}
			if (!this.map._docLoaded && !isPopup) {
				$('#mobile-wizard').height('100%');
				// Turn backButton icon from down to actually back
				// since it does not hide it, instead it goes back in this case
				this.backButton.removeClass('close-button');
			}
			if (this._isActive && currentPath.length) {
				this._goToPath(currentPath);
				this._scrollToPosition(lastScrollPosition);
			}

			if (isPopup) {
				// force hide scroll indicator while its showing/hidding is not fixed
				$('#mobile-wizard-scroll-indicator').hide();

				$('#mobile-wizard').addClass('popup');
				$('#mobile-wizard-titlebar').hide();

				if (data.type === 'snackbar') {
					var that = this;
					$('#mobile-wizard').addClass('snackbar');
					this.snackBarTimout = setTimeout(function () { that._hideWizard(); }, this.options.snackbarTimeout);
				}
			}

			this._inBuilding = false;
		}
	},

	_hideSlideSorter: function() {
		document.getElementById('mobile-wizard-header').style.display = 'none';
	},

	_isSlidePropertyPanel: function(data) {
		var backgroundPanel = L.LOUtil.findItemWithAttributeRecursive(data, 'id', 'SlideBackgroundPanel');
		var layoutPanel = L.LOUtil.findItemWithAttributeRecursive(data, 'id', 'SdLayoutsPanel');
		return backgroundPanel && layoutPanel;
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
		if (data.children && data.children.length && data.children[0].type !== 'deck')
			data.children.splice(0, 1);

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

		if (data.id !== window.mobileDialogId && data.jsontype !== 'sidebar')
			return;

		var container = this.content.get(0);
		if (!container)
			return;

		var control = container.querySelector('[id=\'' + data.control.id + '\']');
		if (!control) {
			window.app.console.warn('jsdialogupdate: not found control with id: "' + data.control.id + '"');
			return;
		}

		var parent = control.parentNode;
		if (!parent)
			return;

		var scrollTop = control.scrollTop;
		var wasHidden = control.style.display === 'none';

		control.style.visibility = 'hidden';
		if (!this._builder)
			return;

		// preserve the same level for control
		var classList = control.className.split(' ');
		var currentLevel = null;
		for (var i in classList) {
			if (classList[i].indexOf('level-') >= 0) {
				currentLevel = classList[i];
				break;
			}
		}

		if (currentLevel) {
			currentLevel = currentLevel.substring('level-'.length);
			this._builder._currentDepth = currentLevel;
		}

		var temporaryParent = L.DomUtil.create('div');
		this._builder.build(temporaryParent, [data.control], false);
		parent.insertBefore(temporaryParent.firstChild, control.nextSibling);
		L.DomUtil.remove(control);

		// when we updated toolbox or menubutton with color picker we need to leave
		// mobile wizard at the same level (opened color picker) on update
		if (this._currentPath.length) {
			var elem = $('[title=\'' + this._currentPath[this._currentPath.length - 1] + '\'').prev(':visible');
			if (elem.length) {
				// we already were at this level so go back one step and enter again
				this._currentPath.pop();
				this._currentDepth--;
				$(elem).trigger('click', {animate: false});
			}
		}

		var newControl = container.querySelector('[id=\'' + data.control.id + '\']');
		if (newControl) {
			if (wasHidden)
				newControl.style.display = 'none';

			newControl.scrollTop = scrollTop;
		}

		// avoid scrolling when adding new bigger elements to the view
		$('#mobile-wizard-content').animate({ scrollTop: this._currentScrollPosition }, 0);
	},

	onJSAction: function (e) {
		var data = e.data;

		if (data.jsontype === 'notebookbar')
			return;

		if (!this._builder)
			return;

		if (!this.content.get(0))
			return;

		// Panels share the same name for main containers, do not execute actions for them
		// if panel has to be shown or hidden, full update will appear
		if (data.data && data.jsontype === 'sidebar' &&
			(data.data.control_id === 'contents' ||
			data.data.control_id === 'Panel' ||
			data.data.control_id === 'titlebar')) {
			window.app.console.log('Ignored action: ' + data.data.action_type + ' for control: ' + data.data.control_id);
			return;
		}

		this._builder.executeAction(this.content.get(0), data.data);
	},
});

L.control.mobileWizard = function (options) {
	return new L.Control.MobileWizard(options);
};
