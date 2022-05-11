/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Infobar.
 */
/* global app _ */

L.Map.Infobar = L.Handler.extend({
	addHooks: function () {
		this._map.on('updateviewslist', this.onUpdateList, this);
		this._map.on('infobar', this.onInfobar, this);
	},

	removeHooks: function () {
		this._map.off('updateviewslist', this.onUpdateList, this);
		this._map.off('infobar', this.onInfobar, this);
	},

	onUpdateList: function () {
		var docLayer = this._map._docLayer || {};
		var viewInfo = this._map._viewInfo[docLayer._viewId];

		if (viewInfo && viewInfo.userextrainfo &&
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
				app.socket.sendMessage('infobar');
		}
	},

	onInfobar: function (e) {
		if (e && e.coolwsd_version) {
			var latestVersion = e.coolwsd_version.split('.');
			var currentVersion = app.socket.WSDServer.Version.split('.');
			var snackbarMessage = _('Your Collabora Online server needs updating. Version %0 is available.');
			var length = Math.max(latestVersion.length, currentVersion.length);
			for (var i = 0; i < length; i++) {
				var v1 = i < latestVersion.length ? parseInt(latestVersion[i]) : 0;
				var v2 = i < currentVersion.length ? parseInt(currentVersion[i]) : 0;

				if (v1 > v2) {
					var currentDate = new Date();
					window.localStorage.setItem('InfoBarLaterDate', currentDate.getTime());
					snackbarMessage = snackbarMessage.replace('%0', latestVersion);
					this._map.uiManager.showSnackbar(snackbarMessage);
					break;
				}
				if (v1 < v2) {
					break;
				}
			}
		}
	}
});

if (window.isLocalStorageAllowed) {
	L.Map.addInitHook('addHandler', 'infobar', L.Map.Infobar);
}
