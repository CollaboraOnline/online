/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Infobar.
 */

L.Map.Infobar = L.Handler.extend({

	addHooks: function () {
		L.DomEvent.on(window, 'message', this.onMessage, this);

		var url = window.feedbackLocation.replace(/feedback.html/g, 'updatecheck.html');
		this.remove();
		this._iframeInfobar = L.iframeDialog(url);
	},

	removeHooks: function () {
		L.DomEvent.off(window, 'message', this.onMessage, this);
		this.remove();
	},

	remove: function () {
		if (this._iframeInfobar && this._iframeInfobar.hasLoaded()) {
			this._iframeInfobar.remove();
			delete this._iframeInfobar;
		}
	},

	onMessage: function (e) {
		var data = e.data;

		if (data === 'updatecheck-show') {
			this._iframeInfobar.show();
		} else if (data === 'updatecheck-close') {
			this._map.infobar.disable();
		}
	}
});

if (window.feedbackLocation) {
	L.Map.addInitHook('addHandler', 'infobar', L.Map.Infobar);
}
