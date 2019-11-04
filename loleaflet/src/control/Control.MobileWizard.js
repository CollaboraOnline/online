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

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this.map = map;
		map.on('mobilewizard', this._onMobileWizard, this);
		map.on('closemobilewizard', this._hideWizard, this);

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
	},

	_hideWizard: function() {
		$('#mobile-wizard').hide();
		$('#mobile-wizard-content').empty();
		$('#toolbar-down').show();
		this._isActive = false;
		this._currentPath = [];
		if (window.mobileWizard === true) {
			var toolbar = w2ui['actionbar'];
			if (toolbar && toolbar.get('mobile_wizard').checked)
				toolbar.uncheck('mobile_wizard');
			this.map.sendUnoCommand('.uno:Sidebar');
			window.mobileWizard = false;
		}
	},

	_hideKeyboard: function() {
		document.activeElement.blur();
	},

	getCurrentLevel: function() {
		return this._currentDepth;
	},

	setTabs: function(tabs) {
		$('#mobile-wizard-tabs').show();
		$('#mobile-wizard-tabs').empty();
		$('#mobile-wizard-tabs').append(tabs);
		$('#mobile-wizard-titlebar').hide();
		this._isTabMode = true;
	},

	goLevelDown: function(contentToShow) {
		if (!this._isTabMode || this._currentDepth > 0)
			this.backButton.removeClass('close-button');

		if (this._isTabMode && this._currentDepth > 0) {
			$('#mobile-wizard-titlebar').show();
			$('#mobile-wizard-tabs').hide();
		}

		var titles = '.ui-header.level-' + this.getCurrentLevel() + '.mobile-wizard';
		$(titles).hide('slide', { direction: 'left' }, 'fast');
		$(contentToShow).siblings().hide();
		$(contentToShow).show('slide', { direction: 'right' }, 'fast');

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

	_goToPath: function(path) {
		for (var index in path) {
			$('[title=\'' + path[index] + '\'').prev().click();
		}
		this._currentPath = path;
	},

	_onMobileWizard: function(data) {
		if (data) {
			this._isActive = true;
			var currentPath = null;
			if (this._currentPath)
				currentPath = this._currentPath;

			this._reset();

			this._showWizard();
			this._hideKeyboard();

			// We can change the sidebar as we want here
			if (data.id === '') { // sidebar indicator
				this._modifySidebarLayout(data);
			}

			L.control.jsDialogBuilder({mobileWizard: this, map: this.map}).build(this.content.get(0), [data]);

			this._mainTitle = data.text ? data.text : '';
			this._setTitle(this._mainTitle);

			if (data.id === 'menubar') {
				$('#mobile-wizard').height('100%');
				$('#mobile-wizard').addClass('menuwizard');
				if (this.map .getDocType() === 'spreadsheet')
					$('#mobile-wizard').css('top', $('#spreadsheet-row-column-frame').css('top'));
				else
					$('#mobile-wizard').css('top', $('#document-container').css('top'));
			} else {
				$('#mobile-wizard').height(this.options.maxHeight);
				$('#mobile-wizard').css('top', '');
			}

			if (this._isActive && currentPath.length)
				this._goToPath(currentPath);
		}
	},

	_modifySidebarLayout: function (data) {
		this._mergeStylesAndTextPropertyPanels(data);
		this._removeItems(data, ['editcontour']);
	},

	_mergeStylesAndTextPropertyPanels: function (data) {
		var stylesChildren = this._removeStylesPanelAndGetContent(data);
		if (stylesChildren !== null) {
			this._addChildrenToTextPanel(data, stylesChildren);
		}
	},

	_removeStylesPanelAndGetContent: function (data) {
		if (data.children) {
			for (var i = 0; i < data.children.length; i++) {
				if (data.children[i].type === 'panel' && data.children[i].children &&
					data.children[i].children.length > 0 && data.children[i].children[0].id === 'SidebarStylesPanel') {
					var ret = data.children[i].children[0].children;
					data.children.splice(i, 2);
					return ret;
				}

				var childReturn = this._removeStylesPanelAndGetContent(data.children[i]);
				if (childReturn !== null) {
					return childReturn;
				}
			}
		}
		return null;
	},

	_addChildrenToTextPanel: function (data, children) {
		if (data.id === 'SidebarTextPanel' && data.children && data.children.length > 0 &&
			data.children[0].children && data.children[0].children.length > 0) {
			data.children[0].children = children.concat(data.children[0].children);
			data.children[0].children[0].id = 'box42';
			return 'success';
		}

		if (data.children) {
			for (var i = 0; i < data.children.length; i++) {
				var childReturn = this._addChildrenToTextPanel(data.children[i], children);
				if (childReturn !== null) {
					return childReturn;
				}
			}
		}
		return null;
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
