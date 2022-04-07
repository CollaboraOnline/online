/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Infobar.
 */
/* global app */

L.Map.Infobar = L.Handler.extend({

	initialize: function (map) {
		L.Handler.prototype.initialize.call(this, map);
		map.on('updateviewslist', this.onUpdateList, this);
	},

	onUpdateList: function () {
		var docLayer = this._map._docLayer || {};
		var viewInfo = this._map._viewInfo[docLayer._viewId];

		if (viewInfo && !this.enabled() && viewInfo.userextrainfo &&
		    viewInfo.userextrainfo.is_admin) {
			var laterDate = new Date();
			var currentDate = new Date();
			var timeValue = window.localStorage.getItem('InfoBarLaterDate');
			if (!timeValue || isNaN(timeValue)) {
				/* - 5 seconds */
				laterDate.setTime(currentDate.getTime() - 5000);
			} else {
				/* + 5 days (432,000,000 Milliseconds) */
				timeValue = Number(timeValue);
				laterDate.setTime(timeValue + 432000000);
			}

			if (currentDate > laterDate)
				this.enable();
		}
	},

	addHooks: function () {
		this._map.off('updateviewslist', this.onUpdateList, this);
		L.DomEvent.on(window, 'message', this.onMessage, this);

		this.remove();

		var loolwsdHash = document.querySelector('#loolwsd-version a') || {};
		var lokitHash = document.querySelector('#lokit-version a') || {};

		loolwsdHash = loolwsdHash ? loolwsdHash.innerText : '';
		lokitHash = lokitHash ? lokitHash.innerText : '';

		var params = [{ 'loolwsd_git_hash': loolwsdHash },
			      { 'lokit_git_hash': lokitHash }];

		var options = {
			prefix: 'div-infobar',
			method: 'post'
		};

		this._iframeInfobar = L.iframeDialog(window.infobarUrl, params,
						     L.DomUtil.get('main-document-content'),
						     options);
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

		if (data.startsWith('updatecheck-show-')) {
			var latestVersion = data.replace('updatecheck-show-', '');
			if (latestVersion != app.socket.WSDServer.Version) {
				var currentDate = new Date();
				window.localStorage.setItem('InfoBarLaterDate', currentDate.getTime());
				this._iframeInfobar.show();
			}
		} else if (data === 'updatecheck-close') {
			this._map.infobar.disable();
		}
	}
});

if (window.infobarUrl && window.isLocalStorageAllowed) {
	L.Map.addInitHook('addHandler', 'infobar', L.Map.Infobar);
}
