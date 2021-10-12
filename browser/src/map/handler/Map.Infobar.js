/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Infobar.
 */

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
			this.enable();
		}
	},

	addHooks: function () {
		this._map.off('updateviewslist', this.onUpdateList, this);
		L.DomEvent.on(window, 'message', this.onMessage, this);

		var url = window.feedbackLocation.replace(/feedback.html/g, 'updatecheck.html');
		this.remove();

		this._iframeInfobar = L.iframeDialog(url, null,
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
