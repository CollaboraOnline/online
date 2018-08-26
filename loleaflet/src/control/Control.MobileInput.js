/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileInput.
 */
L.Control.MobileInput = L.Control.extend({
	options: {
		position: 'bottomleft'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function () {
		this._initLayout();
		return this._container;
	},

	onGotFocus: function () {
		this._map._docLayer._updateCursorPos();
	},

	onLostFocus: function () {
		this._textArea.value = '';
		this._container.style.visibility = 'hidden';
		this._map.removeLayer(this._map._docLayer._cursorMarker);
	},

	focus: function(focus) {
		if (this._map._permission !== 'edit') {
			return;
		}

		if (focus === false) {
			this._textArea.blur();
			this._container.style.visibility = 'hidden';
		} else {
			this._container.style.marginLeft = (this._map.getSize().x - this._container.offsetWidth) / 2 + 'px';
			this._container.style.visibility = '';
			this._textArea.focus();
		}
	},

	select: function() {
		this._textArea.select();
	},

	getValue: function() {
		return this._textArea.value;
	},

	setValue: function(val) {
		this._textArea.value = val;
	},

	activeElement: function () {
		return this._textArea;
	},

	_initLayout: function () {
		var tagTd = 'td',
		constOff = 'off',
		stopEvents = 'touchstart touchmove touchend mousedown mousemove mouseout mouseover mouseup mousewheel click scroll',
		container = this._container = L.DomUtil.create('table', 'loleaflet-mobile-table');
		container.style.visibility = 'hidden';

		var tbody = L.DomUtil.create('tbody', '', container),
		tr = L.DomUtil.create('tr', '', tbody),
		td = L.DomUtil.create(tagTd, '', tr);
		this._textArea = L.DomUtil.create('input', 'loleaflet-mobile-input', td);
		this._textArea.setAttribute('type', 'text');
		this._textArea.setAttribute('autocorrect', constOff);
		this._textArea.setAttribute('autocapitalize', constOff);
		this._textArea.setAttribute('autocomplete', constOff);
		this._textArea.setAttribute('spellcheck', 'false');
		L.DomEvent.on(this._textArea, stopEvents, L.DomEvent.stopPropagation)
			.on(this._textArea, 'keydown keypress keyup', this.onKeyEvents, this)
			.on(this._textArea, 'compositionstart compositionupdate compositionend textInput', this.onIMEEvents, this)
			.on(this._textArea, 'cut', this.onNativeCut, this)
			.on(this._textArea, 'copy', this.onNativeCopy, this)
			.on(this._textArea, 'paste', this.onNativePaste, this)
			.on(this._textArea, 'focus', this.onGotFocus, this)
			.on(this._textArea, 'blur', this.onLostFocus, this);

		var cut = L.DomUtil.create(tagTd, 'loleaflet-mobile-button loleaflet-mobile-cut', tr);
		L.DomEvent.on(cut, stopEvents,  L.DomEvent.stopPropagation)
			.on(cut, 'mousedown', L.DomEvent.preventDefault)
			.on(cut, 'mouseup', this.onInternalCut, this);
		var copy = L.DomUtil.create(tagTd, 'loleaflet-mobile-button loleaflet-mobile-copy', tr);
		L.DomEvent.on(copy, stopEvents,  L.DomEvent.stopPropagation)
			.on(copy, 'mousedown', L.DomEvent.preventDefault)
			.on(copy, 'mouseup', this.onInternalCopy, this);
		var paste = L.DomUtil.create(tagTd, 'loleaflet-mobile-button loleaflet-mobile-paste', tr);
		L.DomEvent.on(paste, stopEvents,  L.DomEvent.stopPropagation)
			.on(paste, 'mousedown', L.DomEvent.preventDefault)
			.on(paste, 'mouseup', this.onInternalPaste, this);
		this._map.on('mousedown', this.onClick, this);
	},

	onClick: function () {
		this._textArea.value = '';
	},

	onKeyEvents: function (e) {
		var keyCode = e.keyCode,
		    charCode = e.charCode,
		    handler = this._map.keyboard,
		    docLayer = this._map._docLayer,
		    unoKeyCode = handler._toUNOKeyCode(keyCode);

		this._keyHandled = this._keyHandled || false;
		docLayer._resetPreFetching();
		if (handler._ignoreKeyEvent({originalEvent: e})) {
			// key ignored
		}
		else if (e.type === 'keydown') {
			this._keyHandled = false;
			if (handler.handleOnKeyDownKeys[keyCode] && charCode === 0) {
				docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
			}
		}
		else if ((e.type === 'keypress') && (!handler.handleOnKeyDownKeys[keyCode] || charCode !== 0)) {
			if (charCode === keyCode && charCode !== 13) {
				// Chrome sets keyCode = charCode for printable keys
				// while LO requires it to be 0
				keyCode = 0;
				unoKeyCode = handler._toUNOKeyCode(keyCode);
			}

			docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
			this._keyHandled = true;
		}
		else if (e.type === 'keyup') {
			docLayer._postKeyboardEvent('up', charCode, unoKeyCode);
			this._keyHandled = true;
		}
		L.DomEvent.stopPropagation(e);
	},

	onIMEEvents: function (e) {
		var map = this._map;
		if (e.type === 'compositionstart' || e.type === 'compositionupdate') {
			this._isComposing = true; // we are starting composing with IME
			var txt = '';
			for (var i = 0; i < e.data.length; i++) {
				txt += e.data[i];
			}
			if (txt) {
				map._docLayer._postCompositionEvent(0, 'input', txt);
			}
		}

		if (e.type === 'compositionend') {
			this._isComposing = false; // stop of composing with IME
			// get the composited char codes
			// clear the input now - best to do this ASAP so the input
			// is clear for the next word
			//map._clipboardContainer.setValue('');
			// Set all keycodes to zero
			map._docLayer._postCompositionEvent(0, 'end', '');
		}

		if (e.type === 'textInput' && !this._keyHandled) {
			// Hack for making space and spell-check text insert work
			// in Chrome (on Andorid) or Chrome with IME.
			//
			// Chrome (Android) IME triggers keyup/keydown input with
			// code 229 when hitting space (as with all composiiton events)
			// with addition to 'textinput' event, in which we only see that
			// space was entered. Similar situation is also when inserting
			// a soft-keyboard spell-check item - it is visible only with
			// 'textinput' event (no composition event is fired).
			// To make this work we need to insert textinput.data here..
			//
			// TODO: Maybe make sure this is only triggered when keydown has
			// 229 code. Also we need to detect that composition was overriden
			// (part or whole word deleted) with the spell-checked word. (for
			// example: enter 'tar' and with spell-check correct that to 'rat')
			var data = e.data;
			for (var idx = 0; idx < data.length; idx++) {
				map._docLayer._postKeyboardEvent('input', data[idx].charCodeAt(), 0);
			}
		}
		L.DomEvent.stopPropagation(e);
	},

	onNativeCut: function (e) {
		this._map._socket.sendMessage('uno .uno:Cut');
		L.DomEvent.stopPropagation(e);
	},

	onNativeCopy: function (e) {
		this._map._socket.sendMessage('uno .uno:Copy');
		L.DomEvent.stopPropagation(e);
	},

	onNativePaste: function (e) {
		if (e.clipboardData) { // Standard
			this._map._docLayer._dataTransferToDocument(e.clipboardData, /* preferInternal = */ true);
		}
		else if (window.clipboardData) { // IE 11
			this._map._docLayer._dataTransferToDocument(window.clipboardData, /* preferInternal = */ true);
		}
		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
	},

	onInternalCut: function (e) {
		if (this._map._docLayer._selectionTextContent) {
			this._textArea.value = this._map._docLayer._selectionTextContent;
			this._textArea.select();
			this._textArea.setSelectionRange(0, this._textArea.value.length);
			try {
				document.execCommand('cut');
			}
			catch (err) {
				console.log(err);
			}
			this._textArea.value = '';
		}
		this._map._socket.sendMessage('uno .uno:Cut');
		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
	},

	onInternalCopy: function (e) {
		if (this._map._docLayer._selectionTextContent) {
			this._textArea.value = this._map._docLayer._selectionTextContent;
			this._textArea.select();
			this._textArea.setSelectionRange(0, this._textArea.value.length);
			try {
				document.execCommand('copy');
			}
			catch (err) {
				console.log(err);
			}
		}
		this._map._socket.sendMessage('uno .uno:Copy');
		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
	},

	onInternalPaste: function (e) {
		this._map._socket.sendMessage('uno .uno:Paste');
		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
	}
});

L.control.mobileInput = function (options) {
	return new L.Control.MobileInput(options);
};
