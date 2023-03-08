/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.VersionBar.
 */
/* global app _ */

L.Map.VersionBar = L.Handler.extend({
	onAdd: function () {
		this._map.on('updateviewslist', this.onUpdateInfo, this);
		this._map.on('versionbar', this.onversionbar, this);
	},

	onRemove: function () {
		this._map.off('versionbar', this.onversionbar, this);
		this._map.off('updateviewlist', this.onUpdateInfo, this);
	},

	onUpdateInfo: function () {
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
				app.socket.sendMessage('versionbar');
		}
	},

	onversionbar: function (e) {
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
					snackbarMessage = snackbarMessage.replace('%0', e.coolwsd_version);
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
	L.Map.versionBar = new L.Map.VersionBar();
}
