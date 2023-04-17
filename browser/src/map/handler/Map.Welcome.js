/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Welcome.
 */

/* global app _ */
L.Map.mergeOptions({
	welcome: true
});

L.Map.Welcome = L.Handler.extend({

	_getLocalWelcomeUrl: function() {
		var welcomeLocation = L.LOUtil.getURL('/welcome/welcome.html');
		if (window.socketProxy)
			welcomeLocation = window.makeWsUrl(welcomeLocation);
		return welcomeLocation;
	},

	initialize: function (map) {
		L.Handler.prototype.initialize.call(this, map);
		this._map.on('updateviewslist', this.onUpdateList, this);

		// temporarily use only local welcome dialog
		this._url = /*window.welcomeUrl ? window.welcomeUrl:*/ this._getLocalWelcomeUrl();
		this._retries = 2;
		this._fallback = false;
	},

	addHooks: function () {
		L.DomEvent.on(window, 'message', this.onMessage, this);
		this.remove();
	},

	isGuest: function() {
		var docLayer = this._map._docLayer || {};
		var viewInfo = this._map._viewInfo[docLayer._viewId];
		return  viewInfo && viewInfo.userextrainfo && viewInfo.userextrainfo.is_guest;
	},

	onUpdateList: function () {
		if (!this.isGuest() && window.autoShowWelcome && this.shouldWelcome()) {
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
		if (typeof e.data !== 'string')
			return; // Some extensions may inject scripts resulting in load events that are not strings

		if (e.data.startsWith('updatecheck-show'))
			return;

		var data = JSON.parse(e.data);

		if (data.MessageId === 'welcome-show') {
			this._iframeWelcome.show();
		} else if (data.MessageId == 'welcome-translate') {
			this._iframeWelcome.clearTimeout();
			var keys = Object.keys(data.strings);
			for (var it in keys) {
				data.strings[keys[it]] = _(keys[it]).replace('%coolVersion', window.coolwsdVersion);
			}
			this._iframeWelcome.postMessage(data);
		} else if (data.MessageId === 'welcome-close') {
			localStorage.setItem('WSDWelcomeVersion', app.socket.WSDServer.Version);
			this.remove();
		} else if (data.MessageId == 'iframe-welcome-load' && !this._iframeWelcome.isVisible()) {
			if (this._retries-- > 0) {
				this.remove();
				setTimeout(L.bind(this.showWelcomeDialog, this), 200);
			} else if (this._fallback) {
				var currentDate = new Date();
				localStorage.setItem('WSDWelcomeDisabled', 'true');
				localStorage.setItem('WSDWelcomeDisabledDate', currentDate.toDateString());
				this.remove();
			} else {
				// fallback
				this._url = this._getLocalWelcomeUrl();
				this._fallback = true;
				setTimeout(L.bind(this.showWelcomeDialog, this), 200);
			}
		}
	}
});

if (window.enableWelcomeMessage && window.isLocalStorageAllowed) {
	L.Map.addInitHook('addHandler', 'welcome', L.Map.Welcome);
}
