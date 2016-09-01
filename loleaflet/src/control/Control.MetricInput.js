/*
 * L.Control.MetricInput.
 */

L.Control.MetricInput = L.Control.extend({
	options: {
		position: 'topmiddle',
		title: ''
	},

	initialize: function (callback, context, value, options) {
		L.setOptions(this, options);

		this._callback = callback;
		this._context = context;
		this._default = value;
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
		labelTitle.innerHTML = '<b>' + this.options.title + ' ' + _('(100th/mm)') + '</b>';
		content.appendChild(labelTitle);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));

		var labelAdd = document.createElement('span');
		labelAdd.innerHTML = _('Add: ');
		content.appendChild(labelAdd);

		var inputMetric = this._input = document.createElement('input');
		inputMetric.type = 'text';
		inputMetric.value = this._default;
		content.appendChild(inputMetric);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));

		var inputValue = document.createElement('input');
		inputValue.type = 'checkbox';
		inputValue.checked = true;
		L.DomEvent.on(inputValue, 'click', this._onDefaultClick, this);
		content.appendChild(inputValue);

		var labelValue = document.createElement('span');
		labelValue.innerHTML = _('Default value');
		content.appendChild(labelValue);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));

		var inputButton = document.createElement('input');
		inputButton.type = 'button';
		inputButton.value = _('Submit');
		L.DomEvent.on(inputButton, 'click', this._onOKButtonClick, this);

		content.appendChild(inputButton);
	},

	onRemove: function (map) {
		this._input = null;
	},

	show: function () {
		this._container.style.marginLeft = (-this._container.offsetWidth / 2) + 'px';
		this._container.style.visibility = '';
		this._input.focus();
	},

	_onDefaultClick: function (e) {
		this._input.value = this._default;
	},

	_onOKButtonClick: function (e) {
		var data = parseFloat(this._input.value);
		this.remove();
		this._callback.call(this._context, {type: 'submit', value: data});
	},

	_onCloseButtonClick: function (e) {
		this.remove();
		this._callback.call(this._context, {type : 'close'});
	}
});

L.control.metricInput = function (callback, context, value, options) {
	return new L.Control.MetricInput(callback, context, value, options);
};
