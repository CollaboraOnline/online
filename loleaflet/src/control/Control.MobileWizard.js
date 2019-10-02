/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileWizard
 */

/* global $ */
L.Control.MobileWizard = L.Control.extend({

	_inMainMenu: true,
	_isActive: false,
	_currentDepth: 0,

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

	goLevelDown: function(contentToShow) {
		this.backButton.removeClass('close-button');

		var titles = '.ui-header.level-' + this.getCurrentLevel() + '.mobile-wizard';

		$(titles).hide('slide', { direction: 'left' }, 'fast');
		$(contentToShow).show('slide', { direction: 'right' }, 'fast');

		this._currentDepth++;
		this._setTitle(contentToShow.title);
		this._inMainMenu = false;
	},

	goLevelUp: function() {
		if (this._inMainMenu) {
			this._hideWizard();
			this._currentDepth = 0;
		} else {
			this._currentDepth--;

			var parent = $('.ui-content.mobile-wizard:visible');
			if (this._currentDepth > 0 && parent)
				this._setTitle(parent.get(0).title);
			else
				this._setTitle('');

			$('.ui-content.level-' + this._currentDepth + '.mobile-wizard').hide('slide', { direction: 'right' }, 'fast');
			$('.ui-header.level-' + this._currentDepth + '.mobile-wizard').show('slide', { direction: 'left' }, 'fast');

			if (this._currentDepth == 0) {
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
		}
	}
});

L.control.mobileWizard = function (options) {
	return new L.Control.MobileWizard(options);
};
