/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileWizard
 */

/* global $ w2ui */
L.Control.MobileWizard = L.Control.extend({

	_inMainMenu: true,
	_isActive: false,
	_currentDepth: 0,
	_mainTitle: '',
	_isTabMode: false,

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
		$('#mobile-wizard-content').css('top', '48px');
		this._isTabMode = false;
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
	},

	_hideWizard: function() {
		$('#mobile-wizard').hide();
		$('#mobile-wizard-content').empty();
		this._isActive = false;
	},

	_hideKeyboard: function() {
		document.activeElement.blur();
	},

	getCurrentLevel: function() {
		return this._currentDepth;
	},

	setTabs: function(tabs) {
		$('#mobile-wizard-tabs').empty();
		$('#mobile-wizard-tabs').append(tabs);
		$('#mobile-wizard-content').css('top', '110px');
		this._isTabMode = true;
	},

	goLevelDown: function(contentToShow) {
		if (!this._isTabMode || this._currentDepth > 0)
			this.backButton.removeClass('close-button');

		var titles = '.ui-header.level-' + this.getCurrentLevel() + '.mobile-wizard';
		$(titles).hide('slide', { direction: 'left' }, 'fast');
		$(contentToShow).siblings().hide();
		$(contentToShow).show('slide', { direction: 'right' }, 'fast');

		this._currentDepth++;
		this._setTitle(contentToShow.title);
		this._inMainMenu = false;
	},

	goLevelUp: function() {
		if (this._inMainMenu || (this._isTabMode && this._currentDepth == 1)) {
			this._hideWizard();
			this._currentDepth = 0;
			if (window.mobileWizard === true) {
				w2ui['actionbar'].click('mobile_wizard')
			} else if (window.insertionMobileWizard === true) {
				w2ui['actionbar'].click('insertion_mobile_wizard')
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
			}
		}
	},

	_setTitle: function(title) {
		var right = $('#mobile-wizard-title');
		right.text(title);
	},

	_onMobileWizard: function(data) {
		if (data) {
			this._isActive = true;
			this._reset();

			this._showWizard();
			this._hideKeyboard();

			L.control.jsDialogBuilder({mobileWizard: this, map: this.map}).build(this.content.get(0), [data]);

			this._mainTitle = data.text ? data.text : '';
			this._setTitle(this._mainTitle);
		}
	}
});

L.control.mobileWizard = function (options) {
	return new L.Control.MobileWizard(options);
};
