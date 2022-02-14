/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Welcome.
 */

/* global app */
L.Map.mergeOptions({
	welcome: true
});

L.Map.Welcome = L.Handler.extend({

	initialize: function (map) {
		L.Handler.prototype.initialize.call(this, map);
		this._map.on('statusindicator', this.onStatusIndicator, this);

		this._url = window.feedbackLocation.replace(/Rate\/feedback.html/g, 'Welcome/welcome.html');
		this._retries = 2;
		this._fallback = false;
	},

	addHooks: function () {
		L.DomEvent.on(window, 'message', this.onMessage, this);
		this.remove();
	},

	onStatusIndicator: function (e) {
		if (e.statusType === 'alltilesloaded' && this.shouldWelcome()) {
			this._map.off('statusindicator', this.onStatusIndicator, this);
			this.showWelcomeDialog();
		}
	},

	shouldWelcome: function() {
		var storedVersion = localStorage.getItem('WSDWelcomeVersion');
		var currentVersion = app.socket.WSDServer.Version;
		var welcomeDisabledCookie = localStorage.getItem('WSDWelcomeDisabled');
		var welcomeDisabledDate = localStorage.getItem('WSDWelcomeDisabledDate');
		var isWelcomeDisabled = false;

		if (welcomeDisabledCookie && welcomeDisabledDate) {
			// Check if we are stil in the same day
			var currentDate = new Date();
			if (welcomeDisabledDate === currentDate.toDateString())
				isWelcomeDisabled = true;
			else {
				//Values expired. Clear the local values
				localStorage.removeItem('WSDWelcomeDisabled');
				localStorage.removeItem('WSDWelcomeDisabledDate');
			}
		}

		if ((!storedVersion || storedVersion !== currentVersion) && !isWelcomeDisabled) {
			return true;
		}

		return false;
	},

	showWelcomeDialog: function() {
		if (this._iframeWelcome && this._iframeWelcome.queryContainer())
			this.remove();

		this._iframeWelcome = L.iframeDialog(this._url, null, null, { prefix: 'iframe-welcome' });
	},

	removeHooks: function () {
		L.DomEvent.off(window, 'message', this.onMessage, this);
		this.remove();
	},

	remove: function () {
		if (this._iframeWelcome) {
			this._iframeWelcome.remove();
			delete this._iframeWelcome;
		}
	},

	onMessage: function (e) {
		var data = e.data;

		if (data === 'welcome-show') {
			this._iframeWelcome.show();
		} else if (data === 'welcome-close') {
			localStorage.setItem('WSDWelcomeVersion', app.socket.WSDServer.Version);
			this.remove();
		} else if (data == 'iframe-welcome-load' && !this._iframeWelcome.isVisible()) {
			if (this._retries-- > 0) {
				this.remove();
				setTimeout(L.bind(this.showWelcomeDialog, this), 200);
			} else if (this._fallback) {
				var currentDate = new Date();
				localStorage.setItem('WSDWelcomeDisabled', 'true');
				localStorage.setItem('WSDWelcomeDisabledDate', currentDate.toDateString());
				this._iframeWelcome.show();
			} else {
				// fallback
				var welcomeLocation = 'welcome/welcome-' + String.locale + '.html';
				if (window.socketProxy)
					welcomeLocation = window.makeWsUrl('/loleaflet/dist/' + welcomeLocation);

				this._url = welcomeLocation;
				this._fallback = true;
				setTimeout(L.bind(this.showWelcomeDialog, this), 200);
			}
		}
	}
});

if (window.enableWelcomeMessage && window.feedbackLocation && window.isLocalStorageAllowed) {
	L.Map.addInitHook('addHandler', 'welcome', L.Map.Welcome);
}

