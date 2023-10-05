/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.DownloadProgress.
 */
/* global _ $ */
L.Control.DownloadProgress = L.Control.extend({
	options: {
		snackbarTimeout: 20000,
		userWarningKey: 'warnedAboutLargeCopy'
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

	_userAlreadyWarned: function () {
		var itemKey = this.options.userWarningKey;
		var storage = localStorage;
		if (storage && !storage.getItem(itemKey)) {
			return false;
		} else if (!storage)
			return false;

		return true;
	},

	_setUserAlreadyWarned: function () {
		var itemKey = this.options.userWarningKey;
		var storage = localStorage;
		if (storage && !storage.getItem(itemKey))
			storage.setItem(itemKey, '1');
	},

	_getDialogTitle: function () {
		return _('Download Selection');
	},

	_getLargeCopyPasteMessage: function () {
		return this._map._clip._substProductName(
			_('If you want to share large elements outside of %productName it\'s necessary to first download them.'));
	},

	// Step 1. Large copy paste warning

	_showLargeCopyPasteWarning: function (inSnackbar) {
		var modalId = 'large_copy_paste_warning';

		var msg = this._getLargeCopyPasteMessage();
		var buttonText = _('Download') + ' (Alt + C)'; // TODO: on Mac Alt == Option

		if (inSnackbar) {
			this._map.uiManager.showSnackbar(
				msg, buttonText, this._onStartDownload.bind(this), this.options.snackbarTimeout);
		} else {
			this._map.uiManager.showInfoModal(modalId, this._getDialogTitle(), msg, '',
				buttonText, this._onStartDownload.bind(this), true, modalId + '-response');

			this.setupKeyboardShortcut(modalId);
		}
	},

	// Step 2. Download progress

	_getDownloadProgressDialogId: function () {
		return 'copy_paste_download_progress';
	},

	_showDownloadProgress: function (inSnackbar) {
		var modalId = this._getDownloadProgressDialogId();
		var msg = _('Downloading clipboard content');
		var buttonText = _('Cancel');

		if (inSnackbar) {
			this._map.uiManager.showProgressBar(msg, buttonText, this._onClose.bind(this));
		} else {
			this._map.uiManager.showProgressBarDialog(modalId, this._getDialogTitle(), msg,
				buttonText, this._onClose.bind(this), 0);
		}
	},

	_closeDownloadProgressDialog: function () {
		var modalId = this._getDownloadProgressDialogId();
		if (!this._userAlreadyWarned())
			this._map.uiManager.closeModal(this._map.uiManager.generateModalId(modalId));
	},

	// Step 3. Download complete

	_showDownloadComplete: function (inSnackbar) {
		var modalId = 'copy_paste_complete';
		var msg = _('Download completed and ready to be copied to clipboard.');
		var buttonText = _('Copy') + ' (Alt + C)'; // TODO: on Mac Alt == Option

		if (inSnackbar) {
			this._map.uiManager.showSnackbar(msg, buttonText,
				this._onConfirmCopyAction.bind(this), this.options.snackbarTimeout);
		} else {
			this._map.uiManager.showInfoModal(modalId, this._getDialogTitle(), msg, '',
				buttonText, this._onConfirmCopyAction.bind(this), true, modalId + '-response');

			this.setupKeyboardShortcut(modalId);
		}
	},

	setupKeyboardShortcut: function (modalId) {
		var keyDownCallback = function(e) {
			if (e.altKey && e.keyCode === 67 /*C*/) {
				document.getElementById(modalId + '-response').click();
				e.preventDefault();
			}
		};
		var dialogId = this._map.uiManager.generateModalId(modalId);
		document.getElementById(dialogId).onkeydown = keyDownCallback.bind(this);
	},

	show: function () {
		window.app.console.log('DownloadProgress.show');
		// better to init the following state variables here,
		// since the widget could be re-used without having been destroyed
		this._started = false;
		this._complete = false;
		this._closed = false;

		this._showLargeCopyPasteWarning(this._userAlreadyWarned());
	},

	isClosed: function () {
		return this._closed;
	},

	isStarted: function () {
		return this._started;
	},

	isComplete: function () {
		return this._complete;
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
		if (this._userAlreadyWarned())
			this._map.uiManager.setSnackbarProgress(Math.round(value));
		else {
			var modalId = this._getDownloadProgressDialogId();
			this._map.uiManager.setDialogProgress(modalId, Math.round(value));
		}
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
		this.setValue(0);
	},

	_onStartDownload: function () {
		if (!this._uri)
			return;

		this._showDownloadProgress(this._userAlreadyWarned());

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

		this._closeDownloadProgressDialog();

		this._showDownloadComplete(this._userAlreadyWarned());
	},

	_onConfirmCopyAction: function () {
		this._map._clip.filterExecCopyPaste('.uno:Copy');
		this._onClose();
		this._setUserAlreadyWarned();
	},

	_onClose: function () {
		if (this._userAlreadyWarned())
			this._map.uiManager.closeSnackbar();

		if (this._started)
			this._closeDownloadProgressDialog();

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
