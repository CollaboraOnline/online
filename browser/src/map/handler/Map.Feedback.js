/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Feedback.
 */

/* global _ */

L.Map.mergeOptions({
	feedback: !window.ThisIsAMobileApp,
	feedbackTimeout: 30000
});

L.Map.Feedback = L.Handler.extend({

	addHooks: function () {
		this.initialized = false;

		if (this._map.wopi)
			this._map.on('updateviewslist', this.onUpdateList, this);
		else
			this._map.on('docloaded', this.onDocLoaded, this);

		L.DomEvent.on(window, 'message', this.onMessage, this);
	},

	removeHooks: function () {
		L.DomEvent.off(window, 'message', this.onMessage, this);
	},

	onUpdateList: function () {
		var docLayer = this._map._docLayer || {};

		if (docLayer && docLayer._viewId == 0)
			this.onDocLoaded();
	},

	onDocLoaded: function () {
		if (this.initialized)
			return;

		this.initialized = true;

		if (window.localStorage.getItem('WSDFeedbackEnabled') !== 'false') {
			var laterDate = new Date();
			var currentDate = new Date();
			var timeValue = window.localStorage.getItem('WSDFeedbackLaterDate');
			var docCount = window.localStorage.getItem('WSDFeedbackCount');

			docCount = parseInt(docCount);
			docCount = isNaN(docCount) ? 1 : docCount + 1;
			window.localStorage.setItem('WSDFeedbackCount', docCount);

			if (!timeValue || isNaN(timeValue)) {
				/* - 5 seconds */
				laterDate.setTime(currentDate.getTime() - 5000);
			} else {
				/* + 5 days (432,000,000 Milliseconds) */
				timeValue = Number(timeValue);
				laterDate.setTime(timeValue + 432000000);
			}

			if (docCount > 15 && currentDate > laterDate && window.autoShowFeedback)
				setTimeout(L.bind(this.onFeedback, this), this._map.options.feedbackTimeout);
		}
	},

	onFeedback: function () {
		if (this._map.welcome && this._map.welcome.isVisible && this._map.welcome.isVisible()) {
			setTimeout(L.bind(this.onFeedback, this), this._map.options.feedbackTimeout);
			return;
		}

		if (this._map.welcome && this._map.welcome.isVisible && this._map.welcome.isVisible())
			setTimeout(L.bind(this.onFeedback, this), 3000);
		else {
			this.askForFeedbackDialog();
		}
	},

	askForFeedbackDialog: function () {
		this._map.uiManager.showSnackbar(
			_('Please send us your feedback'),
			_('OK'),
			this.showFeedbackDialog.bind(this));
	},

	showFeedbackDialog: function () {
		if (this._iframeDialog && this._iframeDialog.hasLoaded())
			this._iframeDialog.remove();

		var lokitHash = document.querySelector('#lokit-version a') || {};
		lokitHash = lokitHash ? lokitHash.innerText : '';

		var cssVar = getComputedStyle(document.documentElement).getPropertyValue('--co-primary-element');
		var params = [{ mobile : window.mode.isMobile() },
			      { cssvar : cssVar},
			      { wsdhash : window.app.socket.WSDServer.Hash },
			      { 'lokit_hash' : lokitHash }];

		var options = {
			prefix: 'iframe-dialog',
			id: 'iframe-feedback',
		};

		this._iframeDialog = L.iframeDialog(window.feedbackUrl, params, null, options);
	},

	onError: function () {
		window.localStorage.removeItem('WSDFeedbackEnabled');
		this._iframeDialog.remove();
	},

	onMessage: function (e) {
		if (typeof e.data !== 'string')
			return; // Some extensions may inject scripts resulting in load events that are not strings

		if (e.data.startsWith('updatecheck-show'))
			return;

		var data = e.data;
		data = JSON.parse(data).MessageId;

		if (data == 'feedback-show') {
			this._iframeDialog.show();
		}
		else if (data == 'feedback-never') {
			window.localStorage.setItem('WSDFeedbackEnabled', 'false');
			window.localStorage.removeItem('WSDFeedbackCount');
			this._iframeDialog.remove();
		} else if (data == 'feedback-later') {
			var currentDate = new Date();
			this._iframeDialog.remove();
			window.localStorage.setItem('WSDFeedbackLaterDate', currentDate.getTime());
			window.localStorage.removeItem('WSDFeedbackCount');
		} else if (data == 'feedback-submit') {
			window.localStorage.setItem('WSDFeedbackEnabled', 'false');
			window.localStorage.removeItem('WSDFeedbackCount');
			var that = this;
			setTimeout(function() {
				that._iframeDialog.remove();
			}, 400);

		} else if (data == 'iframe-feedback-load' && !this._iframeDialog.isVisible()) {
			this._iframeDialog.remove();
			setTimeout(L.bind(this.onFeedback, this), this._map.options.feedbackTimeout);
		}
	}
});
if (window.feedbackUrl && window.isLocalStorageAllowed) {
	L.Map.addInitHook('addHandler', 'feedback', L.Map.Feedback);
}
