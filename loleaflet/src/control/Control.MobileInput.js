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
			.on(this._textArea, 'compositionstart compositionupdate compositionend textInput', this.onCompEvents, this)
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
			this._lastInput = null;
			return;
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
		console.log('onCompEvents: e.type === ' + e.type);
		console.log('onCompEvents: e.data === "' + e.data + '"');
		if (e.type === 'compositionstart' || e.type === 'compositionupdate') {
			this._isComposing = true; // we are starting composing with IME
			this._composingData = e.data; // cache what we have composed so far
			if (e.data) {
				map._docLayer._postCompositionEvent(0, 'input', e.data);
			}
		}

		if (e.type === 'compositionend') {
			this._isComposing = false; // stop of composing with IME
			map._docLayer._postCompositionEvent(0, 'end', '');
		}

		if (e.type === 'textInput' && !this._keyHandled) {
			// Hack for making space in combination with autocompletion text
			// input work in Chrome on Andorid.
			//
			// Chrome (Android) IME triggers keyup/keydown input with
			// code 229 when hitting space (as with all composiiton events)
			// with addition to 'textinput' event, in which we only see that
			// space was entered.
			var data = e.data;
			if (data.length == 1 && data[0] === ' ') {
				map._docLayer._postKeyboardEvent('input', data[0].charCodeAt(), 0);
			}
			this._textArea.value = '';
		}
		L.DomEvent.stopPropagation(e);
	},

	onInput: function (e) {
		var backSpace = this._map.keyboard._toUNOKeyCode(8);
		if (e.inputType && e.inputType === 'deleteContentBackward' && this._lastInput !== backSpace) {
			// this means we need to delete the entire interim composition;
			// let's issue backspace that many times
			if (this._composingData) {
				for (var i = 0; i < this._composingData.length; ++i) {
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
