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
		backButton.click(function() {
			if (that._inMainMenu) {
				that._hideWizard();
				that._currentDepth = 0;
			} else {
				that._currentDepth--;
				$('.ui-content.level-' + that._currentDepth + '.mobile-wizard').hide('slide', { direction: 'right' }, 'fast', function() {});
				$('.ui-header.level-' + that._currentDepth + '.mobile-wizard').show('slide', { direction: 'left' }, 'fast');
				if (that._currentDepth == 0)
					that._inMainMenu = true;
			}
		});
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
