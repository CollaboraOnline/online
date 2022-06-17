/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Infobar used for displaying non-annoying info messages
 */

/* global vex $ */
L.Control.Infobar = L.Control.extend({
	onAdd: function (map) {
		map.on('infobar', this._onInfobar, this);
	},

	_onInfobar: function(e) {
		if (!e.msg)
			return;

		var buttons = [];
		var callback = function() {};
		if (e.actionLabel && e.action) {
			buttons.push($.extend({}, vex.dialog.buttons.YES, { text: e.actionLabel }));
			callback = function (value) {
				if (value === false) // close btn clicked
					return;

				if (e.action.startsWith('http')) { // We have a link
					var win = window.open(e.action, '_blank');
					win.focus();
				}
			};
		}

		vex.dialog.open({
			message: e.msg,
			className: 'vex-theme-bottom-right-corner',
			showCloseButton: true,
			buttons: buttons,
			callback: callback
		});
	}
});

L.control.infobar = function (options) {
	return new L.Control.Infobar(options);
};
