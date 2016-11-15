/*
 * L.Control.CharacterMap.
 */

L.Control.CharacterMap = L.Control.extend({
	options: {
		position: 'topright'
	},

	unicodeCharts : [
		{ innerHTML: _('Basic Latin'),				start: 0x0021, end: 0x007F },
		{ innerHTML: _('Latin-1 Supplement'),			start: 0x0080, end: 0x00FF },
		{ innerHTML: _('Latin Extended-A'),			start: 0x0100, end: 0x017F },
		{ innerHTML: _('Latin Extended-B'),			start: 0x0180, end: 0x024F },
		{ innerHTML: _('IPA Extensions'),			start: 0x0250, end: 0x02AF },
		{ innerHTML: _('Spacing Modifier Letters'),		start: 0x02B0, end: 0x02FF },
		{ innerHTML: _('Combining Diacritical Marks'),		start: 0x0300, end: 0x036F },
		{ innerHTML: _('Greek'),				start: 0x0370, end: 0x03FF },
		{ innerHTML: _('Cyrillic'),				start: 0x0400, end: 0x04FF },
		{ innerHTML: _('Armenian'),				start: 0x0530, end: 0x058F },
		{ innerHTML: _('Hebrew'),				start: 0x0590, end: 0x05FF },
		{ innerHTML: _('Arabic'),				start: 0x0600, end: 0x06FF },
		{ innerHTML: _('Syriac'),				start: 0x0700, end: 0x074F },
		{ innerHTML: _('Thaana'),				start: 0x0780, end: 0x07BF },
		{ innerHTML: _('Devanagari'),				start: 0x0900, end: 0x097F },
		{ innerHTML: _('Bengali'),				start: 0x0980, end: 0x09FF },
		{ innerHTML: _('Gurmukhi'),				start: 0x0A00, end: 0x0A7F },
		{ innerHTML: _('Gujarati'),				start: 0x0A80, end: 0x0AFF },
		{ innerHTML: _('Oriya'),				start: 0x0B00, end: 0x0B7F },
		{ innerHTML: _('Tamil'),				start: 0x0B80, end: 0x0BFF },
		{ innerHTML: _('Telugu'),				start: 0x0C00, end: 0x0C7F },
		{ innerHTML: _('Kannada'),				start: 0x0C80, end: 0x0CFF },
		{ innerHTML: _('Malayalam'),				start: 0x0D00, end: 0x0D7F },
		{ innerHTML: _('Sinhala'),				start: 0x0D80, end: 0x0DFF },
		{ innerHTML: _('Thai'),					start: 0x0E00, end: 0x0E7F },
		{ innerHTML: _('Lao'),					start: 0x0E80, end: 0x0EFF },
		{ innerHTML: _('Tibetan'),				start: 0x0F00, end: 0x0FFF },
		{ innerHTML: _('Myanmar'),				start: 0x1000, end: 0x109F },
		{ innerHTML: _('Georgian'),				start: 0x10A0, end: 0x10FF },
		{ innerHTML: _('Hangul Jamo'),				start: 0x1100, end: 0x11FF },
		{ innerHTML: _('Ethiopic'),				start: 0x1200, end: 0x137F },
		{ innerHTML: _('Cherokee'),				start: 0x13A0, end: 0x13FF },
		{ innerHTML: _('Unified Canadian Aboriginal Syllabics'),start: 0x1400, end: 0x167F },
		{ innerHTML: _('Ogham'),				start: 0x1680, end: 0x169F },
		{ innerHTML: _('Runic'),				start: 0x16A0, end: 0x16FF },
		{ innerHTML: _('Khmer'),				start: 0x1780, end: 0x17FF },
		{ innerHTML: _('Mongolian'),				start: 0x1800, end: 0x18AF },
		{ innerHTML: _('Latin Extended Additional'),		start: 0x1E00, end: 0x1EFF },
		{ innerHTML: _('Greek Extended'),			start: 0x1F00, end: 0x1FFF },
		{ innerHTML: _('General Punctuation'),			start: 0x2000, end: 0x206F },
		{ innerHTML: _('Superscripts and Subscripts'),		start: 0x2070, end: 0x209F },
		{ innerHTML: _('Currency Symbols'),			start: 0x20A0, end: 0x20CF },
		{ innerHTML: _('Combining Marks for Symbols'),		start: 0x20D0, end: 0x20FF },
		{ innerHTML: _('Letterlike Symbols'),			start: 0x2100, end: 0x214F },
		{ innerHTML: _('Number Forms'),				start: 0x2150, end: 0x218F },
		{ innerHTML: _('Arrows'),				start: 0x2190, end: 0x21FF },
		{ innerHTML: _('Mathematical Operators'),		start: 0x2200, end: 0x22FF },
		{ innerHTML: _('Miscellaneous Technical'),		start: 0x2300, end: 0x23FF },
		{ innerHTML: _('Control Pictures'),			start: 0x2400, end: 0x243F },
		{ innerHTML: _('Optical Character Recognition'),	start: 0x2440, end: 0x245F },
		{ innerHTML: _('Enclosed Alphanumerics'),		start: 0x2460, end: 0x24FF },
		{ innerHTML: _('Box Drawing'),				start: 0x2500, end: 0x257F },
		{ innerHTML: _('Block Elements'),			start: 0x2580, end: 0x259F },
		{ innerHTML: _('Geometric Shapes'),			start: 0x25A0, end: 0x25FF },
		{ innerHTML: _('Miscellaneous Symbols'),		start: 0x2600, end: 0x26FF },
		{ innerHTML: _('Dingbats'),				start: 0x2700, end: 0x27BF },
		{ innerHTML: _('Braille Patterns'),			start: 0x2800, end: 0x28FF },
		{ innerHTML: _('CJK Radicals Supplement'),		start: 0x2E80, end: 0x2EFF },
		{ innerHTML: _('Kangxi Radicals'),			start: 0x2F00, end: 0x2FDF },
		{ innerHTML: _('Ideographic Description Characters'),	start: 0x2FF0, end: 0x2FFF },
		{ innerHTML: _('CJK Symbols and Punctuation'),		start: 0x3000, end: 0x303F },
		{ innerHTML: _('Hiragana'),				start: 0x3040, end: 0x309F },
		{ innerHTML: _('Katakana'),				start: 0x30A0, end: 0x30FF },
		{ innerHTML: _('Bopomofo'),				start: 0x3100, end: 0x312F },
		{ innerHTML: _('Hangul Compatability Jamo'),		start: 0x3130, end: 0x318F },
		{ innerHTML: _('Kanbun'),				start: 0x3190, end: 0x319F },
		{ innerHTML: _('Bopomofo Extended'),			start: 0x31A0, end: 0x31BF },
		{ innerHTML: _('Enclosed CJK Letters and Months'),	start: 0x3200, end: 0x32FF },
		{ innerHTML: _('CJK Compatibility'),			start: 0x3300, end: 0x33FF },
		{ innerHTML: _('CJK Unified Ideographs Extension A'),	start: 0x3400, end: 0x4DB5 },
		{ innerHTML: _('CJK Unified Ideographs'),		start: 0x4E00, end: 0x9FFF },
		{ innerHTML: _('Yi Syllables'),				start: 0xA000, end: 0xA48F },
		{ innerHTML: _('Yi Radicals'),				start: 0xA490, end: 0xA4CF },
		{ innerHTML: _('Hangul Syllables'),			start: 0xAC00, end: 0xD7A3 },
		{ innerHTML: _('High Surrogates'),			start: 0xD800, end: 0xDB7F },
		{ innerHTML: _('High Private Use Surrogates'),		start: 0xDB80, end: 0xDBFF },
		{ innerHTML: _('Low Surrogates'),			start: 0xDC00, end: 0xDFFF },
		//{ innerHTML: _('Private Use'),			start: 0xE000, end: 0xF8FF },
		{ innerHTML: _('CJK Compatibility Ideographs'),		start: 0xF900, end: 0xFAFF },
		{ innerHTML: _('Alphabetic Presentation Forms'),	start: 0xFB00, end: 0xFB4F },
		{ innerHTML: _('Arabic Presentation Forms-A'),		start: 0xFB50, end: 0xFDFF },
		{ innerHTML: _('Combining Half Marks'),			start: 0xFE20, end: 0xFE2F },
		{ innerHTML: _('CJK Compatibility Forms'),		start: 0xFE30, end: 0xFE4F },
		{ innerHTML: _('Small Form Variants'),			start: 0xFE50, end: 0xFE6F },
		{ innerHTML: _('Arabic Presentation Forms-B'),		start: 0xFE70, end: 0xFEEE },
		//{ innerHTML: _('Specials'),				start: 0xFEFF, end: 0xFEFF },
		{ innerHTML: _('Halfwidth and Fullwidth Forms'),	start: 0xFF00, end: 0xFFEF },
		//{ innerHTML: _('Specials'),				start: 0xFFF0, end: 0xFFFD }
	],

	fillCharacters: function (index) {
		var start = this.unicodeCharts[index].start;
		var end = this.unicodeCharts[index].end;
		var it = 0;
		var tr, td;
		L.DomUtil.empty(this._tbody);
		while (start <= end) {
			if (it % 20 === 0) {
				tr = L.DomUtil.create('tr', '', this._tbody);
			}
			td = L.DomUtil.create('td', '', tr);
			td.innerHTML = '&#x' + start.toString(16);
			td.data = start;
			L.DomEvent.on(td, 'click', this._onSymbolClick, this);
			start++;
			it++;
		}
	},

	fillDropDown: function(element, list, selectedIndex) {
		for (var iterator = 0, len = list.length, option; iterator < len; iterator++) {
			option = document.createElement('option');
			option.innerHTML = list[iterator].innerHTML;
			element.appendChild(option);
		}
		element.selectedIndex = selectedIndex;
	},

	fillFontNames: function (fontList, selectedIndex) {
		this.fillDropDown(this._fontNames, fontList, selectedIndex);
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._initLayout();

		map.on('renderfont', this._onRenderFontPreview, this);
		return this._container;
	},

	onRemove: function (map) {
		map.off('renderfont', this._onRenderFontPreview, this);
	},


	show: function () {
		this._tbody.setAttribute('style', 'max-height:' + this._map.getSize().y / 2 + 'px');
		this._container.style.visibility = '';
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-layers');
		this._container.style.visibility = 'hidden';
		var closeButton = L.DomUtil.create('a', 'leaflet-popup-close-button', this._container);
		closeButton.href = '#close';
		closeButton.innerHTML = '&#215;';
		L.DomEvent.on(closeButton, 'click', this._onCloseClick, this);
		var wrapper = L.DomUtil.create('div', 'leaflet-popup-content-wrapper', this._container);
		var content = L.DomUtil.create('div', 'leaflet-popup-content', wrapper);
		var labelTitle = document.createElement('span');
		labelTitle.innerHTML = '<b>' + _('Special Characters') + '</b>';
		content.appendChild(labelTitle);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		this._unicodeChart = L.DomUtil.create('select', 'loleaflet-controls', content);
		L.DomEvent.on(this._unicodeChart, 'change', this._onUnicodeChartChange, this);
		content.appendChild(document.createElement('br'));
		var table = L.DomUtil.create('table', 'loleaflet-character', content);
		this._tbody = L.DomUtil.create('tbody', '', table);
		content.appendChild(document.createElement('br'));
		var label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Font Name:') + '</b>';
		this._fontNames = L.DomUtil.create('select', 'loleaflet-controls', content);
		L.DomEvent.on(this._fontNames, 'change', this._onFontNamesChange, this);
		label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Hexadecimal:') + '</b>';
		this._hexa = L.DomUtil.create('span', 'loleaflet-controls', content);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		label = L.DomUtil.create('span', 'loleaflet-controls', content);
		label.innerHTML = '<b>' + _('Preview:') + '</b>';
		this._preview = L.DomUtil.create('img', '', content);
		content.appendChild(document.createElement('br'));
		content.appendChild(document.createElement('br'));
		var button = L.DomUtil.create('input', 'loleaflet-controls', content);
		button.type = 'button';
		button.value = _('Insert');
		L.DomEvent.on(button, 'click', this._onInsertClick, this);
		button = L.DomUtil.create('input', 'loleaflet-controls', content);
		button.type = 'button';
		button.value = _('Cancel');
		L.DomEvent.on(button, 'click', this._onCancelClick, this);
		this.fillDropDown(this._unicodeChart, this.unicodeCharts, 0);
		this.fillCharacters(this._unicodeChart.selectedIndex);
	},

	_onCancelClick: function (e) {
		this._onCloseClick(e);
	},

	_onCloseClick: function (e) {
		this._map.enable(true);
		this._refocusOnMap();
		this.remove();
	},

	_onFontNamesChange: function (e) {
		if (this._hexa.data) {
			this._map._socket.sendMessage('renderfont font=' +
				window.encodeURIComponent(this._fontNames.options[this._fontNames.selectedIndex].value) +
				' char=' + String.fromCharCode(this._hexa.data));
		}
	},

	_onInsertClick: function (e) {
		if (this._hexa.data) {
			var command = {
				Symbols: {
					type: 'string',
					value: String.fromCharCode(this._hexa.data)
				},
				FontName: {
					type: 'string',
					value: this._fontNames.options[this._fontNames.selectedIndex].value
				}
			};
			this._map.sendUnoCommand('.uno:InsertSymbol', command);
			this._onCloseClick(e);
		}
	},

	_onRenderFontPreview: function (e) {
		this._preview.src = e.img;
	},

	_onSymbolClick: function (e) {
		var target = e.target || e.srcElement;
		this._hexa.data = target.data;
		this._hexa.innerHTML = 'U+' + target.data.toString(16).toUpperCase();
		this._map._socket.sendMessage('renderfont font=' +
			window.encodeURIComponent(this._fontNames.options[this._fontNames.selectedIndex].value) +
			' char=' + String.fromCharCode(this._hexa.data));
	},

	_onUnicodeChartChange: function (e) {
		var target = e.target || e.srcElement;
		this.fillCharacters(target.selectedIndex);
	}
});

L.control.characterMap = function (options) {
	return new L.Control.CharacterMap(options);
};
