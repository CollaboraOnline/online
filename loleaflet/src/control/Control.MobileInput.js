/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.MobileInput.
 */
L.Control.MobileInput = L.Control.extend({
	options: {
		position: 'topleft'
	},

	initialize: function (options) {
		L.setOptions(this, options);
		this._cursorHandler = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'leaflet-cursor-handler',
				iconSize: null
			}),
			draggable: true
		});

		this._cursorHandler.on('dragend', this.onDragEnd, this);
		this._currentKeysDown = {};
		this._ignoreKeypress = false;
		this._isMobileSafariOriOSApp = window.ThisIsTheiOSApp || navigator.platform === 'iPad' || navigator.platform === 'iPhone';
	},

	onAdd: function () {
		this._initLayout();
		return this._container;
	},

	onDragEnd: function () {
		var mousePos = this._map._docLayer._latLngToTwips(this._cursorHandler.getLatLng());
		this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
		this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
	},

	onGotFocus: function () {
		if (this._map._docLayer && this._map._docLayer._cursorMarker) {
			this._cursorHandler.setLatLng(this._map._docLayer._visibleCursor.getSouthWest());
			this._map.addLayer(this._map._docLayer._cursorMarker);
			if (this._map._docLayer._selections.getLayers().length === 0) {
				this._map.addLayer(this._cursorHandler);
			} else {
				this._map.removeLayer(this._cursorHandler);
			}
		}
	},

	onLostFocus: function () {
		if (this._map._docLayer && this._map._docLayer._cursorMarker) {
			this._textArea.value = '';
			this._map.removeLayer(this._map._docLayer._cursorMarker);
			this._map.removeLayer(this._cursorHandler);
		}
	},

	focus: function(focus) {
		if (this._map._permission !== 'edit') {
			return;
		}

		this._textArea.blur();
		if (focus !== false) {
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

	showCursor: function () {
		if (this._textArea === document.activeElement) {
			this.onGotFocus();
		}
	},

	hideCursor: function () {
		this.onLostFocus();
	},

	_initLayout: function () {
		var constOff = 'off',
		stopEvents = 'touchstart touchmove touchend mousedown mousemove mouseout mouseover mouseup mousewheel click scroll',
		container = this._container = L.DomUtil.create('div', 'loleaflet-mobile-container');

		this._textArea = L.DomUtil.create('input', 'loleaflet-mobile-input', container);
		this._textArea.setAttribute('type', 'text');
		this._textArea.setAttribute('autocorrect', constOff);
		this._textArea.setAttribute('autocapitalize', constOff);
		this._textArea.setAttribute('autocomplete', constOff);
		this._textArea.setAttribute('spellcheck', 'false');
		L.DomEvent.on(this._textArea, stopEvents, L.DomEvent.stopPropagation)
			.on(this._textArea, 'keydown keypress keyup', this.onKeyEvents, this)
			.on(this._textArea, 'textInput', this.onTextInput, this)
			.on(this._textArea, 'focus', this.onGotFocus, this)
			.on(this._textArea, 'blur', this.onLostFocus, this);
		if (!this._isMobileSafariOriOSApp)
			L.DomEvent.on(this._textArea, 'compositionstart compositionupdate compositionend', this.onCompEvents, this)
				.on(this._textArea, 'input', this.onInput, this);
	},

	_getSurrogatePair: function(codePoint) {
		var highSurrogate = Math.floor((codePoint - 0x10000) / 0x400) + 0xD800;
		var lowSurrogate = (codePoint - 0x10000) % 0x400 + 0xDC00;
		return [highSurrogate, lowSurrogate];
	},

	onKeyEvents: function (e) {
		var keyCode = e.keyCode,
		    charCode = e.charCode,
		    handler = this._map.keyboard,
		    docLayer = this._map._docLayer,
		    unoKeyCode = handler._toUNOKeyCode(keyCode);

		this._keyHandled = this._keyHandled || false;
		// console.log('==> onKeyEvents: ' + e.type + ':' + e.key + ' keyCode=' + keyCode + ' charCode=' + charCode + ' unoKeyCode=' + unoKeyCode + ' _keyHandled=' + this._keyHandled + ' _isComposing=' + this._isComposing)
		if (this._isComposing) {
			if (keyCode === 229 && charCode === 0) {
				return;
			}
			// stop the composing - so that we handle eg. Enter even during
			// composition
			this._isComposing = false;
			this._lastInput = null;
			this._textArea.value = '';
		}

		docLayer._resetPreFetching();
		if (handler._ignoreKeyEvent({originalEvent: e})) {
			this._lastInput = null;
			// key ignored
		}
		else if (e.type === 'keydown') {
			if (this._isMobileSafariOriOSApp) {
				if (!this._currentKeysDown[e.key])
					this._currentKeysDown[e.key] = 1;
				else
					this._currentKeysDown[e.key]++;
				if (this._currentKeysDown[e.key] > 1)
					this._ignoreKeypress = true;
			}
			this._keyHandled = false;
			// console.log('    _keyHandled := false');
			if (handler.handleOnKeyDownKeys[keyCode] && charCode === 0) {
				docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
				this._lastInput = unoKeyCode;
			}
		}
		else if (this._isMobileSafariOriOSApp &&
			 e.type === 'keypress') {
			if (!this._ignoreKeypress) {
				// e.key can be longer than one, for instance if you press a dead diacritic
				// key followed by a letter that it can't combine with, like ¨ t => '¨t'.
				// But e.key is longer than one also in the case of control keys where for
				// instance e.key == 'Enter'. Detect the latter by comparing e.key against
				// e.code.
				if (e.key !== e.code) {
					var i;
					for (i = 0; i < e.key.length; ++i) {
						docLayer._postKeyboardEvent('input', e.key[i].charCodeAt(), 0);
						docLayer._postKeyboardEvent('up', e.key[i].charCodeAt(), 0);
					}
				}
				else {
					docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
					docLayer._postKeyboardEvent('up', charCode, unoKeyCode);
				}
			}
		}
		else if ((e.type === 'keypress') && (!handler.handleOnKeyDownKeys[keyCode] || charCode !== 0)) {
			if (charCode === keyCode && charCode !== 13) {
				// Chrome sets keyCode = charCode for printable keys
				// while LO requires it to be 0
				keyCode = 0;
				unoKeyCode = handler._toUNOKeyCode(keyCode);
			}

			if (charCode > 0xFFFF) {
				// We must handle non-BMP code points as two separate key events
				// because the sad VCL KeyEvent only takes a 16-bit "characters".
				var surrogatePair = this._getSurrogatePair(charCode);
				docLayer._postKeyboardEvent('input', surrogatePair[0], unoKeyCode);
				docLayer._postKeyboardEvent('up', surrogatePair[0], unoKeyCode);
				docLayer._postKeyboardEvent('input', surrogatePair[1], unoKeyCode);
				docLayer._postKeyboardEvent('up', surrogatePair[1], unoKeyCode);
			}
			else {
				docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
			}
			this._lastInput = unoKeyCode;
			this._keyHandled = true;
			// console.log('    _keyHandled := true');
		}
		else if (e.type === 'keyup') {
			if (this._isMobileSafariOriOSApp) {
				// Yes, forget all keys that are pressed at the same time as soon as one
				// of them goes up. This seems to match what events the system sends.
				this._currentKeysDown = {};
			}
			else if (!this._ignoreKeypress && charCode <= 0xFFFF) {
				// For non-BMP characters we generated both 'input' and 'up' events
				// above already.
				docLayer._postKeyboardEvent('up', charCode, unoKeyCode);
			}
			this._ignoreKeypress = false;
			this._lastInput = null;
			this._keyHandled = true;
			// console.log('    _keyHandled := true');
		}
		L.DomEvent.stopPropagation(e);
	},

	onCompEvents: function (e) {
		// console.log('==> onCompEvents: ' + e.type);
		var map = this._map;

		if (e.type === 'compositionstart' || e.type === 'compositionupdate') {
			this._isComposing = true; // we are starting composing with IME
			this._composingData = e.data; // cache what we have composed so far
		}

		if (e.type === 'compositionend') {
			this._isComposing = false; // stop of composing with IME
			map._docLayer._postCompositionEvent(0, 'end', '');
		}

		L.DomEvent.stopPropagation(e);
	},

	onTextInput: function (e) {
		// console.log('==> onTextInput: _keyHandled=' + this._keyHandled);
		if (!this._keyHandled) {
			this._textData = e.data;
			this._textArea.value = '';
		}

		L.DomEvent.stopPropagation(e);
	},

	onInput: function (e) {
		// console.log('==> onInput: inputType=' + e.inputType);
		var backSpace = this._map.keyboard._toUNOKeyCode(8);
		var i;

		// deferred processing of composition text or normal text; we can get
		// both in some cases, and based on the input event we need to decide
		// which one we actually need to use
		if (e.inputType === 'insertText') {
			if (this._textData) {
				for (i = 0; i < this._textData.length; ++i) {
					this._map._docLayer._postKeyboardEvent('input', this._textData[i].charCodeAt(), 0);
				}
			}
		}
		else if (e.inputType === 'insertCompositionText') {
			if (this._composingData) {
				this._map._docLayer._postCompositionEvent(0, 'input', this._composingData);
			}
		}
		else if (e.inputType === 'deleteContentBackward' && this._lastInput !== backSpace) {
			// this means we need to delete the entire interim composition;
			// let's issue backspace that many times
			if (this._composingData) {
				for (i = 0; i < this._composingData.length; ++i) {
					this._map._docLayer._postKeyboardEvent('input', 0, backSpace);
				}
			}
		}

		L.DomEvent.stopPropagation(e);
	}
});

L.control.mobileInput = function (options) {
	return new L.Control.MobileInput(options);
};
