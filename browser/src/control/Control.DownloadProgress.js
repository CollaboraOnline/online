/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.DownloadProgress.
 */
/* global _ $ */
L.Control.DownloadProgress = L.Control.extend({
	options: {
		snackbarTimeout: 20000
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._map = map;
		this._started = false;
		this._complete = false;
		this._closed = false;
	},

	show: function () {
		window.app.console.log('DownloadProgress.show');
		// better to init the following state variables here,
		// since the widget could be re-used without having been destroyed
		this._started = false;
		this._complete = false;
		this._closed = false;

		var msg = _('Start download') + ' (Alt + C)'; // TODO: on Mac Alt == Option
		this._map.uiManager.showSnackbar(
			_('To copy outside, you have to download the content'),
			msg, this._onStartDownload.bind(this), this.options.snackbarTimeout);
	},

	isClosed: function () {
		return this._closed;
	},

	isStarted: function () {
		return this._started;
	},

	currentStatus: function () {
		if (this._closed)
			return 'closed';
		if (!this._started && !this._complete)
			return 'downloadButton';
		if (this._started)
			return 'progress';
		if (this._complete)
			return 'confirmPasteButton';
	},

	setURI: function (uri) {
		// set up data uri to be downloaded
		this._uri = uri;
	},

	setValue: function (value) {
		this._map.uiManager.setSnackbarProgress(Math.round(value));
	},

	_setProgressCursor: function() {
		$('#map').css('cursor', 'progress');
	},

	_setNormalCursor: function() {
		$('#map').css('cursor', 'default');
	},

	startProgressMode: function() {
		this._setProgressCursor();
		this._started = true;
		this._map.uiManager.showProgressBar(
			'Downloading clipboard content', 'Cancel', this._onClose.bind(this));
		this.setValue(0);
	},

	_onStartDownload: function () {
		if (!this._uri)
			return;
		this.startProgressMode();
		this._download();
	},

	_onUpdateProgress: function (e) {
		if (e.statusType === 'setvalue') {
			this.setValue(e.value);
		}
		else if (e.statusType === 'finish') {
			this._onComplete();
		}
	},

	_onComplete: function () {
		if (this._complete)
			return;
		this._setNormalCursor();
		this._complete = true;
		this._started = false;

		var msg = _('Confirm copy to clipboard');
		// TODO: on Mac Alt == Option
		this._map.uiManager.showSnackbar(msg, _('Confirm') + ' (Alt + C)',
			this._onConfirmCopyAction.bind(this), this.options.snackbarTimeout);
	},

	_onConfirmCopyAction: function () {
		this._map._clip.filterExecCopyPaste('.uno:Copy');
		this._onClose();
	},

	_onClose: function () {
		if (this._userAlreadyWarned())
			this._map.uiManager.closeSnackbar();

		this._started = false;
		this._complete = false;
		this._closed = true;

		this._setNormalCursor();
		this._cancelDownload();
		if (this._map)
			this._map.focus();
	},

	_download: function () {
		var that = this;
		this._map._clip._doAsyncDownload(
			'GET', that._uri, null, true,
			function(response) {
				window.app.console.log('clipboard async download done');
				// annoying async parse of the blob ...
				var reader = new FileReader();
				reader.onload = function() {
					var text = reader.result;
					window.app.console.log('async clipboard parse done: ' + text.substring(0, 256));
					var idx = text.indexOf('<!DOCTYPE HTML');
					if (idx > 0)
						text = text.substring(idx, text.length);
					that._map._clip.setTextSelectionHTML(text);
				};
				// TODO: failure to parse ? ...
				reader.readAsText(response);
			},
			function(progress) { return progress/2; },
			function () {
				that._onClose();
				that._map.uiManager.showSnackbar(
					_('Download failed'), '', null,this.options.snackbarTimeout);
			}
		);
	},

	_cancelDownload: function () {
		this._setNormalCursor();
		if (!this._started || this._complete)
			return;
		// TODO: insert code for cancelling an async download
	}
});

L.control.downloadProgress = function (options) {
	return new L.Control.DownloadProgress(options);
};
