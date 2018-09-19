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

		if (focus === false) {
			this._textArea.blur();
		} else {
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

	onCompEvents: function (e) {
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
	}
});

L.control.mobileInput = function (options) {
	return new L.Control.MobileInput(options);
};
