/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Infobar.
 */
/* global app */

L.Map.Infobar = L.Handler.extend({
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

	onMessage: function (e) {
		var data = e.data;

		if (data.startsWith('updatecheck-show-')) {
			var latestVersion = data.replace('updatecheck-show-', '').split('.');
			var currentVersion = app.socket.WSDServer.Version.split('.');
			var length = Math.max(latestVersion.length, currentVersion.length);
			for (var i = 0; i < length; i++) {
				var v1 = i < latestVersion.length ? parseInt(latestVersion[i]) : 0;
				var v2 = i < currentVersion.length ? parseInt(currentVersion[i]) : 0;

				if (v1 > v2) {
					var currentDate = new Date();
					window.localStorage.setItem('InfoBarLaterDate', currentDate.getTime());
					this._iframeInfobar.show();
					break;
				}
				if (v1 < v2) {
					break;
				}
			}
		} else if (data === 'updatecheck-close') {
			this._map.infobar.disable();
		}
	}
});

if (window.infobarUrl && window.isLocalStorageAllowed) {
	L.Map.addInitHook('addHandler', 'infobar', L.Map.Infobar);
}
