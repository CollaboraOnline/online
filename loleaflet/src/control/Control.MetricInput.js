/*
 * L.Control.MetricInput.
 */

L.Control.MetricInput = L.Control.extend({
	options: {
		position: 'topmiddle',
		title: ''
	},

	initialize: function (callback, context, options) {
		L.setOptions(this, options);

		this._callback = callback;
		this._context = context;
	},

	onAdd: function (map) {
		this._initLayout();

		return this._container;
	},

	_initLayout: function () {
		var className = 'leaflet-control-layers',
		container = this._container = L.DomUtil.create('div', className);
		container.style.visibility = 'hidden';

		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onCloseButtonClick, this);

		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', container);
		var content = L.DomUtil.create('div', 'leaflet-popup-content', wrapper);
		var labelTitle = document.createElement('span');
		labelTitle.innerHTML = '<b>' + this.options.title + '</b>';
		content.appendChild(labelTitle);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));

		var labelAdd = document.createElement('span');
		labelAdd.innerHTML = _('Add: ');
		content.appendChild(labelAdd);

		var inputMetric = document.createElement('input');
		inputMetric.type = 'text';
		content.appendChild(inputMetric);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));

		var inputValue = document.createElement('input');
		inputValue.type = 'checkbox';
		inputValue.checked = true;
		content.appendChild(inputValue);

		var labelValue = document.createElement('span');
		labelValue.innerHTML = _('Default value');
		content.appendChild(labelValue);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));

		var inputButton = document.createElement('input');
		inputButton.type = 'button';
		inputButton.value = _('OK');
		L.DomEvent.on(inputButton, 'click', this._onOKButtonClick, this);

		content.appendChild(inputButton);
	},

	update: function () {
		this._container.style.marginLeft = (-this._container.offsetWidth / 2) + 'px';
		this._container.style.visibility = '';
	},

	_onOKButtonClick: function (e) {
		this.remove();
		this._callback.call(this._context, {type: 'ok', data: 0});
	},

	_onCloseButtonClick: function (e) {
		this.remove();
		this._callback.call(this._context, {type : 'cancel'});
	}
});

L.control.metricInput = function (callback, context, options) {
	return new L.Control.MetricInput(callback, context, options);
};
