/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.DownloadProgress.
 */
/* global _ $ */
L.Control.DownloadProgress = L.Control.extend({
	options: {
		position: 'bottomright'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function () {
		this._initLayout();
		return this._container;
	},

	// we really don't want mouse and other events propagating
	// to the parent map - since they affect the context.
	_ignoreEvents: function(elem) {
		L.DomEvent.on(elem, 'mousedown mouseup mouseover mouseout mousemove',
			      function(e) {
				      L.DomEvent.stopPropagation(e);
				      return false;
			      }, this);
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-layers');
		this._container.style.visibility = 'hidden';
		this._ignoreEvents(this._container);

		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', this._container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onClose, this);

		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', this._container);
		var content = this._content = L.DomUtil.create('div', 'leaflet-popup-content', wrapper);
		content.style.width  = '100px';

		// start download button
		var startDownload = this._downloadButton = document.createElement('a');
		startDownload.href = '#start';
		startDownload.innerHTML = _('Start download');
		startDownload.style.font = '13px/11px Tahoma, Verdana, sans-serif';
		startDownload.style.alignment = 'center';
		startDownload.style.height = 20 + 'px';
		L.DomEvent.on(startDownload, 'click', this._onStartDownload, this);

		// download progress bar
		this._progress = L.DomUtil.create('div', 'leaflet-paste-progress', null);
		this._bar = L.DomUtil.create('span', '', this._progress);
		this._value = L.DomUtil.create('span', '', this._bar);
		L.DomUtil.setStyle(this._value, 'line-height', '14px');

		// confirm button
		var confirmCopy = this._confirmPasteButton = document.createElement('a');
		confirmCopy.href = '#complete';
		confirmCopy.innerHTML = _('Confirm copy to clipboard');
		confirmCopy.style.font = '13px/11px Tahoma, Verdana, sans-serif';
		confirmCopy.style.alignment = 'center';
		confirmCopy.style.height = 20 + 'px';
		L.DomEvent.on(confirmCopy, 'click', this._onConfirmCopyAction, this);
	},

	show: function () {
		console.log('DownloadProgress.show');
		// better to init the following state variables here,
		// since the widget could be re-used without having been destroyed
		this._started = false;
		this._complete = false;
		this._closed = false;
		this._content.appendChild(this._downloadButton);
		this._container.style.visibility = '';
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
		if (this._content.contains(this._downloadButton))
			return 'downloadButton';
		if (this._content.contains(this._progress))
			return 'progress';
		if (this._content.contains(this._confirmPasteButton))
			return 'confirmPasteButton';
	},

	setURI: function (uri) {
		// set up data uri to be downloaded
		this._uri = uri;
	},

	setValue: function (value) {
		this._bar.style.width = value + '%';
		this._value.innerHTML = value + '%';
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
		this._content.removeChild(this._downloadButton);
		this._content.appendChild(this._progress);
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
		if (this._content.contains(this._progress))
			this._content.removeChild(this._progress);
		this._content.style.width  = '150px';
		this._content.appendChild(this._confirmPasteButton);
	},

	_onConfirmCopyAction: function () {
		this._map._clip.filterExecCopyPaste('.uno:Copy');
		this._onClose();
	},

	_onClose: function () {
		this._setNormalCursor();
		this._cancelDownload();
		if (this._content.contains(this._confirmPasteButton))
			this._content.removeChild(this._confirmPasteButton);
		if (this._content.contains(this._progress))
			this._content.removeChild(this._progress);
		if (this._map)
			this._map.focus();
		this.remove();
		this._closed = true;
	},

	_download: function () {
		var that = this;
		this._map._clip._doAsyncDownload(
			'GET', that._uri, null, true,
			function(response) {
				console.log('clipboard async download done');
				// annoying async parse of the blob ...
				var reader = new FileReader();
				reader.onload = function() {
					var text = reader.result;
					console.log('async clipboard parse done: ' + text.substring(0, 256));
					var idx = text.indexOf('<!DOCTYPE HTML');
					if (idx > 0)
						text = text.substring(idx, text.length);
					that._map._clip.setTextSelectionHTML(text);
				};
				// TODO: failure to parse ? ...
				reader.readAsText(response);
			},
			function(progress) { return progress/2; }
		);
	},

	_cancelDownload: function () {
		this._setNormalCursor();
		if (!this._started || this._complete)
			return;
		// TODO: insert code for cancelling an async download
	}
});

L.Control.UploadProgress = L.Control.extend({
	options: {
		position: 'bottomright'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function () {
		this._initLayout();
		return this._container;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-layers');
		this._container.style.visibility = 'hidden';
		this._ignoreEvents(this._container);

		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', this._container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onClose, this);

		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', this._container);
		var content = this._content = L.DomUtil.create('div', 'leaflet-popup-content', wrapper);
		content.style.width  = '100px';

		// start upload button
		var startUpload = this._downloadButton = document.createElement('a');
		startUpload.href = '#start';
		startUpload.innerHTML = _('Start upload');
		startUpload.style.font = '13px/11px Tahoma, Verdana, sans-serif';
		startUpload.style.alignment = 'center';
		startUpload.style.height = 20 + 'px';
		L.DomEvent.on(startUpload, 'click', this._onStartUpload, this);

		// progress bar
		this._progress = L.DomUtil.create('div', 'leaflet-paste-progress', null);
		this._bar = L.DomUtil.create('span', '', this._progress);
		this._value = L.DomUtil.create('span', '', this._bar);
		L.DomUtil.setStyle(this._value, 'line-height', '14px');

	},

	show: function () {
		this._started = false;
		this._complete = false;
		this._content.appendChild(this._downloadButton);
		this._container.style.visibility = '';
	},

	setURI: function (uri) {
		// set up data uri to be downloaded
		this._uri = uri;
	},

	setValue: function (value) {
		this._bar.style.width = value + '%';
		this._value.innerHTML = value + '%';
	},

	_onStartUpload: function () {
		//if (!this._uri)
		//	return;
		this._started = true;
		this.setValue(0);
		this._content.removeChild(this._downloadButton);
		this._content.appendChild(this._progress);
		this._upload();
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
		this._complete = true;
	},

	_onClose: function () {
		this._cancelUpload();
		if (this._content.contains(this._progress))
			this._content.removeChild(this._progress);
		this._map.focus();
		this.remove();
	},

	_upload: function	() {
		// TODO: insert code for starting an async upload
	},

	_cancelUpload: function () {
		if (!this._started || this._complete)
			return;
		// TODO: insert code for cancelling an async upload
	}
});

L.Control.CrossProgress = L.Control.extend({
	options: {
		position: 'bottomright'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function () {
		this._initLayout();
		return this._container;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-layers');
		this._container.style.visibility = 'hidden';
		this._ignoreEvents(this._container);

		// close button
		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', this._container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onClose, this);

		// content
		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', this._container);
		var content = this._content = L.DomUtil.create('div', 'leaflet-popup-content', wrapper);
		content.style.width  = '150px';

		// start download button
		var startDownload = this._downloadButton = document.createElement('a');
		startDownload.href = '#start';
		startDownload.innerHTML = _('Start cross copy/paste');
		startDownload.style.font = '13px/11px Tahoma, Verdana, sans-serif';
		startDownload.style.alignment = 'center';
		startDownload.style.height = 20 + 'px';
		L.DomEvent.on(startDownload, 'click', this._onStartDownload, this);

		// download progress bar
		this._progress = L.DomUtil.create('div', 'leaflet-paste-progress', null);
		this._bar = L.DomUtil.create('span', '', this._progress);
		this._value = L.DomUtil.create('span', '', this._bar);
		L.DomUtil.setStyle(this._value, 'line-height', '14px');
	},

	show: function () {
		this._startedDownload = false;
		this._completeDownload = false;
		this._completeUpload = false;
		this._content.appendChild(this._downloadButton);
		this._container.style.visibility = '';
	},

	setURI: function (uri) {
		// set up data uri to be downloaded
		this._uri = uri;
	},

	setValue: function (value) {
		value = value / 2;
		if (this._completeDownload)
			value = 50 + value;
		this._bar.style.width = value + '%';
		this._value.innerHTML = value + '%';
	},

	_onStartDownload: function () {
		//if (!this._uri)
		//	return;
		this._startedDownload = true;
		this.setValue(0);
		this._content.removeChild(this._downloadButton);
		this._content.appendChild(this._progress);
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
		if (!this._completeDownload) {
			this._completeDownload = true;
			this.setValue(0);
			this._upload();
		}
		else if (!this._completeUpload) {
			this._completeUpload = true;
		}
	},

	_onClose: function () {
		this._cancelUpDownload();
		if (this._content.contains(this._confirmPasteButton))
			this._content.removeChild(this._confirmPasteButton);
		if (this._content.contains(this._progress))
			this._content.removeChild(this._progress);
		this._map.focus();
		this.remove();
	},

	_download: function () {
		// TODO: insert code for starting an async download
	},

	_upload: function () {
		// TODO: insert code for starting an async upload
	},

	_cancelUpDownload: function () {
		if (!this._startedDownload || this._completeUpload)
			return;
		// TODO: insert code for cancelling an async upload/download
	}
});

L.control.downloadProgress = function (options) {
	return new L.Control.DownloadProgress(options);
};

L.control.uploadProgress = function (options) {
	return new L.Control.UploadProgress(options);
};

L.control.crossProgress = function (options) {
	return new L.Control.CrossProgress(options);
};
