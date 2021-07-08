/* -*- js-indent-level: 8 -*- */
/*
 * L.ProgressOverlay is used to overlay progress images over the map.
 */

/* global brandProductName $ */
L.ProgressOverlay = L.Layer.extend({

	options: {
		spinnerSpeed: 30
	},

	initialize: function (size) {
		this._size = size;
		this._percent = 0;
		this._initLayout();
		this.intervalTimer = undefined;
	},

	// create layout but don't add to the DOM yet
	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-progress-layer');
		this._spinner = L.DomUtil.create('div', 'leaflet-progress-spinner', this._container);
		this._spinnerCanvas = L.DomUtil.create('canvas', 'leaflet-progress-spinner-canvas', this._spinner);

		var productName = (typeof brandProductName !== 'undefined') ? brandProductName : 'Collabora Online Development Edition';
		this._brandLabel = L.DomUtil.create('div', 'leaflet-progress-label brand-label', this._container);
		this._brandLabel.innerHTML = productName;


		this._label = L.DomUtil.create('div', 'leaflet-progress-label', this._container);
		this._progress = L.DomUtil.create('div', 'leaflet-progress', this._container);
		this._bar = L.DomUtil.create('span', '', this._progress);
		this._value = L.DomUtil.create('span', '', this._bar);

		L.DomUtil.setStyle(this._value, 'line-height', this._size.y + 'px');

		this._container.style.width  = this._size.x + 'px';

		L.DomEvent
			.disableClickPropagation(this._progress)
			.disableScrollPropagation(this._container);
	},

	shutdownTimer: function() {
		if (this.intervalTimer)
			clearInterval(this.intervalTimer);
		this.intervalTimer = undefined;

		if (this._spinnerInterval)
			clearInterval(this._spinnerInterval);
		this._spinnerInterval = undefined;
	},

	showSpinner: function() {
		L.DomUtil.get('document-container').appendChild(this._container);
		this._spinnerInterval = L.LOUtil.startSpinner(this._spinnerCanvas, this.options.spinnerSpeed);
	},

	hideSpinner: function() {
		if (this._container)
			$(this._container).remove();
	},

	// Show the progress bar, but only if things seem slow
	delayedStart: function(map, label, bar) {
		this.setLabel(label);
		this.setBar(false);
		this.setValue(0);

		this.shutdownTimer();

		var self = this;
		self.state = 0;
		this.intervalTimer = setInterval(
			function() {
				self.state = self.state + 1;
				switch (self.state) {
				// 0.5s -> start the spinner
				case 1:
					self.showSpinner();
					break;
				// 2s -> enable the progress bar if we have one & it's low
				case 4:
					if (self._percent < 80)
						self.setBar(bar);
					break;
				// 3s -> show the bar if it's not up.
				case 6:
					self.setBar(bar);
					break;
				}
			}, 500 /* ms */);
	},

	// Hide ourselves if there is anything to hide
	end: function() {
		this.shutdownTimer();
		this.hideSpinner();
	},

	setLabel: function (label) {
		if (this._container && this._label.innerHTML !== label) {
			this._label.innerHTML = label;
		}
	},

	setBar: function (bar) {
		if (this._container) {
			if (bar) {
				this._progress.style.visibility = '';
			}
			else {
				this._progress.style.visibility = 'hidden';
			}
		}
	},

	setValue: function (value) {
		if (this._container) {
			this._percent = value;
			this._bar.style.width = value + '%';
			this._value.innerHTML = value + '%';
		}
	}
});

L.progressOverlay = function (size) {
	return new L.ProgressOverlay(size);
};
