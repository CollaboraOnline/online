/* -*- js-indent-level: 8 -*- */
/*
 * L.ColorPicker is used for building a native HTML color picker
 * panel to be used by the properties mobile wizard.
 */

/* global _ */

L.ColorPicker = L.Class.extend({
	options: {
		selectedColor: '#CC0814',
		noColorControl: true
	},

	statics: {
		ID: 0,
		ID_TAG: 'color-picker-',

		// color types
		BASIC_COLOR: 0,
		TINT: 1,

		BASIC_COLORS: ['#000000', '#FF011B', '#FF9838', '#FFFD59', '#01FD55',
			'#00FFFE', '#006CE7', '#9B24F4', '#FF21F5'],
		TINTS: {
			'#000000': ['#000000', '#434343', '#666666', '#888888',
				'#BBBBBB', '#DDDDDD', '#EEEEEE', '#FFFFFF'],
			'#FF011B': ['#99050C', '#CC0814', '#E06666', '#FF011B',
				'#EA9899', '#F4CCCC', '#FFEAEA', '#FFFFFF'],
			'#FF9838': ['#783f04', '#b45f06', '#e69138', '#ff9900',
				'#f6b26b', '#f9cb9c', '#fce5cd', '#FFFFFF'],
			'#FFFD59': ['#7f6000', '#bf9000', '#f1c232', '#ffff00',
				'#ffd966', '#ffe599', '#fff2cc', '#FFFFFF']
		}
	},

	_selectedBasicColorIndex: 0,
	_selectedTintIndex: 0,

	initialize: function (selectedColorSample, options) {
		L.setOptions(this, options);
		this._id = L.ColorPicker.ID++;
		this._basicColorSampleIdTag = L.ColorPicker.ID_TAG + this._id + '-basic-color-';
		this._tintSampleIdTag = L.ColorPicker.ID_TAG + this._id + '-tint-';
		this._noColorControlId = L.ColorPicker.ID_TAG + this._id + '-no-color';
		this._createBasicColorSelectionMark();
		this._selectedColorElement = selectedColorSample;
		this._selectedColor = this.options.selectedColor;
		this._initIndexes();
		this._container = this._createControl();
		this._initialized = true;
	},

	getId: function () {
		return this._id;
	},

	getSelectedColor: function () {
		return this._selectedColor;
	},

	getContainer: function () {
		return this._container;
	},

	onShow: function () {
		if (!this._initialized || this._selectedColor === '#')
			return;
		this._initIndexes();
		this._updateTintsView();
	},

	_initIndexes: function () {
		for (var i = 0; i < this._getBasicColorCount(); ++i) {
			var tintSet = this._getTintSet(i);
			for (var j = 0; j < tintSet.length; ++j) {
				var tint = tintSet[j];
				if (tint === this._selectedColor) {
					this._selectedBasicColorIndex = i;
					this._selectedTintIndex = j;
					return;
				}
			}
		}
	},

	_createControl: function () {
		var children = [];
		if (this.options.noColorControl)
			children.push(this._createNoColorControl());
		children.push(this._createBasicColorSamples());
		children.push(this._createTintSamples());
		return {type: 'divcontainer', style: 'colors-container', children: children};
	},

	_createNoColorControl: function () {
		var icon = {
			type: 'fixedtext',
			text: '',
			style: 'no-color-control-icon'
		};
		var label = {type: 'fixedtext', style: 'no-color-control-label', text: _('No color')};
		var description = {type: 'divcontainer', children: [icon, label]};
		var checked = {type:'fixedtext', id: this._noColorControlId, style: 'no-color-control-mark', text: ''};
		var container = {
			type: 'divcontainer',
			style: 'colors-container-no-color-row',
			handlers: [{event: 'click', handler: L.bind(this.onClickNoColor, this)}],
			children: [description, checked]
		};
		return container;
	},

	_createBasicColorSamples: function () {
		var colorEntries = [];
		for (var k = 0; k < this._getBasicColorCount(); ++k) {
			var selected = k === this._selectedBasicColorIndex;
			var entry = {
				type: 'colorsample',
				id: this._basicColorSampleIdTag + k,
				selected: selected,
				color: this._getBasicColor(k),
				size: 'small',
				handlers: [{event: 'click', handler: L.bind(this.onClickBasicColorSample, this)}]
			};
			if (selected) {
				entry.mark = this._basicColorSelectionMark;
			}
			colorEntries.push(entry);
		}
		return {type: 'divcontainer', style: 'colors-container-basic-colors-row', children: colorEntries};
	},

	_createTintSamples: function () {
		var tints = this._getTintSet(this._selectedBasicColorIndex);
		var k, selected, entry, tintRowLength = tints.length / 2;

		// first tints row
		var tintsEntries1 = [];
		for (k = 0; k < tintRowLength; ++k) {
			selected = tints[k] === this._selectedColor;
			entry = {
				type: 'colorsample',
				id: this._tintSampleIdTag + k,
				selected: selected,
				color: tints[k],
				size: 'big',
				handlers: [{event: 'click', handler: L.bind(this.onClickTintSample, this)}]
			};
			tintsEntries1.push(entry);
		}
		var tintsRow1 = {type: 'divcontainer', style: 'colors-container-tints', children: tintsEntries1};

		// second tints row
		var tintsEntries2 = [];
		for (k = tintRowLength; k < tints.length; ++k) {
			selected = tints[k] === this._selectedColor;
			entry = {
				type: 'colorsample',
				id: this._tintSampleIdTag + k,
				color: tints[k],
				size: 'big',
				handlers: [{event: 'click', handler: L.bind(this.onClickTintSample, this)}]
			};
			tintsEntries2.push(entry);
		}
		var tintsRow2 = {type: 'divcontainer', style: 'colors-container-tints', children: tintsEntries2};

		return {type: 'divcontainer', children: [tintsRow1, tintsRow2]};
	},

	_createBasicColorSelectionMark: function () {
		this._basicColorSelectionMark = L.DomUtil.create('div', 'colors-container-basic-color-mark', null);
	},

	_getBasicColorCount: function () {
		return 	L.ColorPicker.BASIC_COLORS.length;
	},

	_getBasicColor: function (index) {
		if (!(index >= 0 && index < L.ColorPicker.BASIC_COLORS.length))
			return '';
		return L.ColorPicker.BASIC_COLORS[index];
	},

	_getTintSet: function  (basicColorIndex) {
		var basicColor = this._getBasicColor(basicColorIndex);
		return 	L.ColorPicker.TINTS[basicColor];
	},

	_extractBasicColorIndex: function (sampleId) {
		if (!sampleId.startsWith(this._basicColorSampleIdTag))
			return -1;
		var index = parseInt(sampleId.substring(this._basicColorSampleIdTag.length));
		if (index < 0 || index >= this._getBasicColorCount())
			return -1;
		return index;
	},

	_extractTintIndex: function (sampleId) {
		if (!sampleId.startsWith(this._tintSampleIdTag))
			return -1;
		var index = parseInt(sampleId.substring(this._tintSampleIdTag.length));
		if (index < 0 || index >= this._getTintSet(this._selectedBasicColorIndex).length)
			return -1;
		return index;
	},

	_getColorCode: function (colorIndex, colorType) {
		var sampleElem = this._getSampleElement(colorIndex, colorType);
		return sampleElem.name;
	},

	onClickNoColor: function () {
		this._selectedColor = '#';
		this._unselectSample(this._selectedTintIndex, L.ColorPicker.TINT);
		this._updateNoColorControl(true);
	},

	onClickBasicColorSample: function (e) {
		var basicColorIndex = this._extractBasicColorIndex(e.id);
		if (basicColorIndex < 0)
			return;
		this._selectedBasicColorIndex = this._updateSelectedSample(basicColorIndex, this._selectedBasicColorIndex, L.ColorPicker.BASIC_COLOR);
		this._updateTintsView(basicColorIndex);
	},

	onClickTintSample: function (e) {
		var tintIndex = this._extractTintIndex(e.id);
		if (tintIndex < 0)
			return;
		this._selectedTintIndex = this._updateSelectedSample(tintIndex, this._selectedTintIndex, L.ColorPicker.TINT);
		this._selectedColor = '#' + this._getColorCode(this._selectedTintIndex, L.ColorPicker.TINT);
		this._updateNoColorControl(false);
		this._updateSelectedColorElement();
	},

	_updateSelectedSample: function (colorIndex, selectedColorIndex, colorType) {
		this._unselectSample(selectedColorIndex, colorType);
		this._selectSample(colorIndex, colorType);
		return colorIndex;
	},

	_unselectSample: function (colorIndex, colorType) {
		var sampleElem = this._getSampleElement(colorIndex, colorType);
		if (sampleElem && sampleElem.firstChild) {
			if (colorType === L.ColorPicker.BASIC_COLOR) {
				sampleElem.removeChild(sampleElem.firstChild);
				L.DomUtil.removeClass(sampleElem, 'colors-container-selected-basic-color');
			} else if (colorType === L.ColorPicker.TINT) {
				sampleElem.firstChild.style.visibility = 'hidden';
			}
		}
	},

	_selectSample: function (colorIndex, colorType) {
		var sampleElem = this._getSampleElement(colorIndex, colorType);
		if (sampleElem) {
			if (colorType === L.ColorPicker.BASIC_COLOR) {
				sampleElem.appendChild(this._basicColorSelectionMark);
				L.DomUtil.addClass(sampleElem, 'colors-container-selected-basic-color');
			} else if (colorType === L.ColorPicker.TINT && sampleElem.firstChild) {
				sampleElem.firstChild.style.visibility = 'visible';
			}
		}
	},

	_updateTintsView: function () {
		var tintSet = this._getTintSet(this._selectedBasicColorIndex);
		if (!tintSet)
			return;
		for (var i = 0; i < tintSet.length; ++i) {
			var tint = tintSet[i];
			var sampleElem = this._getSampleElement(i, L.ColorPicker.TINT);
			if (sampleElem) {
				sampleElem.style.backgroundColor = tint;
				sampleElem.name = tint.substring(1);
				if (sampleElem.firstChild) {
					if (tint === this._selectedColor) {
						sampleElem.firstChild.style.visibility = 'visible';
					}
					else {
						sampleElem.firstChild.style.visibility = 'hidden';
					}
				}
			}
		}
	},

	_updateNoColorControl: function (checked) {
		var noColorElem = L.DomUtil.get(this._noColorControlId);
		if (noColorElem) {
			if (noColorElem.checked !== checked) {
				noColorElem.checked = checked;
				if (this._selectedColorElement) {
					if (checked) {
						noColorElem.innerHTML = '&#10004;';
						// update value for the related menu entry
						L.DomUtil.addClass(this._selectedColorElement, 'no-color-selected');
						this._selectedColorElement.innerHTML = '\\';
					} else {
						noColorElem.innerHTML = '';
						// update value for the related menu entry
						L.DomUtil.removeClass(this._selectedColorElement, 'no-color-selected');
						this._selectedColorElement.innerHTML = '';
					}
				}
			}
		}
	},

	_getSampleElement: function (index, type) {
		var sampleId;
		if (type === L.ColorPicker.BASIC_COLOR) {
			sampleId = this._basicColorSampleIdTag + index;
		} else if (type === L.ColorPicker.TINT) {
			sampleId = this._tintSampleIdTag + index;
		}
		return L.DomUtil.get(sampleId);
	},

	_updateSelectedColorElement: function () {
		if (this._selectedColorElement) {
			this._selectedColorElement.style.backgroundColor = this._selectedColor;
		}
	}

});
