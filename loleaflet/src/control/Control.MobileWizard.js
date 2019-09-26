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

	_setupBackButton: function() {
		var that = this;
		var backButton = $('#mobile-wizard-back');
		backButton.click(function() { that.goLevelUp(); });
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

			if (this._currentDepth == 0)
				this._inMainMenu = true;
		}
	},

	_setTitle: function(title) {
		var right = $('#mobile-wizard-title');
		right.text(title);
	},

	_onMobileWizard: function(data) {
		if (data) {
			this._isActive = true;
			this._currentDepth = 0;

			this._showWizard();
			this._hideKeyboard();

			var content = $('#mobile-wizard-content');
			content.empty();

			L.control.jsDialogBuilder({mobileWizard: this, map: this.map}).build(content.get(0), [data]);
		}
	}
});

L.control.mobileWizard = function (options) {
	return new L.Control.MobileWizard(options);
};
