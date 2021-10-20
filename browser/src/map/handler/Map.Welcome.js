/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Welcome.
 */

L.Map.mergeOptions({
	welcome: true
});

L.Map.Welcome = L.Handler.extend({

	initialize: function (map) {
		L.Handler.prototype.initialize.call(this, map);

		this._url = window.feedbackLocation.replace(/Rate\/feedback.html/g, 'Welcome/welcome.html');
	},

	addHooks: function () {
		L.DomEvent.on(window, 'message', this.onMessage, this);
		this.remove();

		this._iframeWelcome = L.iframeDialog(this._url, null, null, { prefix: 'iframe-welcome' });
	},

	removeHooks: function () {
		L.DomEvent.off(window, 'message', this.onMessage, this);
		this.remove();
	},

	remove: function () {
		if (this._iframeWelcome && this._iframeWelcome.hasLoaded()) {
			this._iframeWelcome.remove();
			delete this._iframeWelcome;
		}
	},

	onMessage: function (e) {
		var data = e.data;

		if (data === 'welcome-show') {
			this._iframeWelcome.show();
		} else if (data === 'welcome-close') {
			this.remove();
		}
	}
});

if (window.feedbackLocation && window.isLocalStorageAllowed) {
	L.Map.addInitHook('addHandler', 'welcome', L.Map.Welcome);
}

