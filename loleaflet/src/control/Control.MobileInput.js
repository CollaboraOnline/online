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
	},

	onAdd: function () {
		this._initLayout();
		return this._container;
	},

	onGotFocus: function () {
		if (this._map._docLayer._cursorMarker) {
			this._map.addLayer(this._map._docLayer._cursorMarker);
		}
	},

	onLostFocus: function () {
		if (this._map._docLayer._cursorMarker) {
			this._textArea.value = '';
			this._map.removeLayer(this._map._docLayer._cursorMarker);
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
			.on(this._textArea, 'compositionstart compositionupdate compositionend', this.onCompEvents, this)
			.on(this._textArea, 'textInput', this.onTextInput, this)
			.on(this._textArea, 'input', this.onInput, this)
			.on(this._textArea, 'focus', this.onGotFocus, this)
			.on(this._textArea, 'blur', this.onLostFocus, this);
	},

	onKeyEvents: function (e) {
		var keyCode = e.keyCode,
		    charCode = e.charCode,
		    handler = this._map.keyboard,
		    docLayer = this._map._docLayer,
		    unoKeyCode = handler._toUNOKeyCode(keyCode);

		this._keyHandled = this._keyHandled || false;
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
			this._keyHandled = false;
			if (handler.handleOnKeyDownKeys[keyCode] && charCode === 0) {
				docLayer._postKeyboardEvent('input', charCode, unoKeyCode);
				this._lastInput = unoKeyCode;
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
			this._lastInput = unoKeyCode;
			this._keyHandled = true;
		}
		else if (e.type === 'keyup') {
			docLayer._postKeyboardEvent('up', charCode, unoKeyCode);
			this._lastInput = null;
			this._keyHandled = true;
		}
		L.DomEvent.stopPropagation(e);
	},

	onCompEvents: function (e) {
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
		if (!this._keyHandled) {
			this._textData = e.data;
			this._textArea.value = '';
		}

		L.DomEvent.stopPropagation(e);
	},

	onInput: function (e) {
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
