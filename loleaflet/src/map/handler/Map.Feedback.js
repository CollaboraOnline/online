/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Feedback.
 */

/* global $ */
L.Map.mergeOptions({
	feedback: true,
	feedbackTimeout: 2000
});

L.Map.Feedback = L.Handler.extend({
	addHooks: function () {
		this._map.on('docloaded', this.onDocLoaded, this);
	},

	onDocLoaded: function () {
		if (window.isLocalStorageAllowed) {
			window.localStorage.setItem('WSDFeedbackEnabled', 'true');
			setTimeout(L.bind(this.onFeedback, this), this._map.options.feedbackTimeout);
		}
	},

	onFeedback: function () {
		if (window.localStorage.getItem('WSDFeedbackEnabled')) {
			var feedbackLocation = 'feedback/feedback.html';
			if (window.socketProxy)
				feedbackLocation = window.host + window.serviceRoot +
				'/loleaflet/dist/' + feedbackLocation;

			var map = this._map;
			$.get(feedbackLocation)
				.done(function(data) {
					map._showWelcomeDialogVex(data);
					window.localStorage.setItem('WSDFeedbackEnabled', 'false');
				})
				.fail(function() {
					setTimeout(L.bind(this.onFeedback, this), this._map.options.feedbackTimeout);
				});
		}
	}
});

L.Map.addInitHook('addHandler', 'feedback', L.Map.Feedback);
