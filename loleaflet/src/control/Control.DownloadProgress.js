/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.DownloadProgress.
 */
/* global _ */
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

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-layers');
		this._container.style.visibility = 'hidden';

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
		L.DomEvent.on(confirmCopy, 'click', this._onConfirmPasteAction, this);
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

	_onStartDownload: function () {
		//if (!this._uri)
		//	return;
		this._started = true;
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
		this._complete = true;
		this._content.removeChild(this._progress);
		this._content.style.width  = '150px';
		this._content.appendChild(this._confirmPasteButton);
	},

	_onConfirmPasteAction: function () {
		// TODO: insert code for performing data copy to clipboard
		this._onClose();
	},

	_onClose: function () {
		this._cancelDownload();
		if (this._content.contains(this._confirmPasteButton))
			this._content.removeChild(this._confirmPasteButton);
		if (this._content.contains(this._progress))
			this._content.removeChild(this._progress);
		this._map.focus();
		this.remove();
	},

	_download: function	() {
		// TODO: insert code for starting an async download
	},

	_cancelDownload: function () {
		if (!this._started || this._complete)
			return;
		// TODO: insert code for cancelling an async download
	}
});

L.control.downloadProgress = function (options) {
	return new L.Control.DownloadProgress(options);
};
