/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.TextInput is the hidden textarea, which handles text input events
 *
 * This is made significantly more difficult than expected by such a
 * mess of browser, and mobile IME quirks that it is not possible to
 * follow events, but we have to re-construct input from a browser
 * text area itself.
 */

/* global app isAnyVexDialogActive */

L.TextInput = L.Layer.extend({
	initialize: function() {
		// Flag to denote the composing state, derived from
		// compositionstart/compositionend events; unused
		this._isComposing = false;

		// We need to detect whether delete or backspace was
		// pressed sometimes - consider '  foo' -> ' foo'
		this._deleteHint = ''; // or 'delete' or 'backspace'

		// We need to detect line break in the tunneled formula
		// input window for the multiline case.
		this._linebreakHint = false;

		// Clearing the area can generate input events
		this._ignoreInputCount = 0;

		// If the last focus intended to accept user input.
		// Signifies whether the keyboard is meant to be visible.
		this._setAcceptInput(false);

		// Content
		this._lastContent = []; // unicode characters
		this._hasWorkingSelectionStart = undefined; // does it work ?
		this._ignoreNextBackspace = false;

		this._preSpaceChar = ' ';
		// Might need to be \xa0 in some legacy browsers ?
		if (L.Browser.android && L.Browser.webkit) {
			// fool GBoard into not auto-capitalizing constantly
			this._preSpaceChar = '\xa0';
		}
		this._postSpaceChar = ' ';

		// Debug flag, used in fancyLog(). See the debug() method.
//		this._isDebugOn = true;
		this._isDebugOn = false;

		this._initLayout();

		// Under-caret orange marker.
		this._cursorHandler = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'leaflet-cursor-handler',
				iconSize: null
			}),
			draggable: true
		}).on('dragend', this._onCursorHandlerDragEnd, this);

		// Auto-correct characters can trigger auto-correction, but
		// must be sent as key-up/down if we want correction.
		// cf. SvxAutoCorrect::IsAutoCorrectChar
		this._autoCorrectChars = {
			// tab, newline - handled elsewhere
			' ':  [ 32, 0,      0, 1284 ],
			'!':  [ 33, 0,      0, 4353 ],
			'"':  [ 34, 0,      0, 4353 ],
			'%':  [ 37, 0,      0, 4357 ],
			'\'': [ 39, 0,      0,  192 ],
			'*':  [ 42, 0,      0, 4360 ],
			',':  [ 44, 0,      0, 1291 ],
			'-':  [ 45, 0,      0, 1288 ],
			'.':  [ 46, 0,      0,  190 ],
			'/':  [ 47, 0,      0,  191 ],
			':':  [ 58, 0,      0, 5413 ],
			';':  [ 59, 0,      0, 1317 ],
			'?':  [ 63, 0,      0, 4287 ],
			'_':  [ 95, 0,      0, 5384 ]
		};
	},

	onAdd: function() {
		if (this._container) {
			this.getPane().appendChild(this._container);
			this.update();
		}

		this._emptyArea();

		this._map.on('updatepermission', this._onPermission, this);
		this._map.on('commandresult', this._onCommandResult, this);
		L.DomEvent.on(this._textArea, 'focus blur', this._onFocusBlur, this);

		// Do not wait for a 'focus' event to attach events if the
		// textarea/contenteditable is already focused (due to the autofocus
		// HTML attribute, the browser focusing it on DOM creation, or whatever)
		if (document.activeElement === this._textArea) {
			this._onFocusBlur({ type: 'focus' });
		}

		if (window.ThisIsTheiOSApp) {
			var that = this;
			window.MagicToGetHWKeyboardWorking = function() {
				var that2 = that;
				window.MagicKeyDownHandler = function(e) {
					that2._onKeyDown(e);
				};
				window.MagicKeyUpHandler = function(e) {
					that2._onKeyUp(e);
				};
			};
			window.postMobileMessage('FOCUSIFHWKBD');
		}

		L.DomEvent.on(this._map.getContainer(), 'mousedown touchstart', this._abortComposition, this);
	},

	onRemove: function() {
		window.MagicToGetHWKeyboardWorking = null;
		window.MagicKeyDownHandler = null;
		window.MagicKeyUpHandler = null;

		if (this._container) {
			this.getPane().removeChild(this._container);
		}

		this._map.off('updatepermission', this._onPermission, this);
		L.DomEvent.off(this._textArea, 'focus blur', this._onFocusBlur, this);
		L.DomEvent.off(this._map.getContainer(), 'mousedown touchstart', this._abortComposition, this);

		this._map.removeLayer(this._cursorHandler);
	},

	disable: function () {
		this._textArea.setAttribute('disabled', true);
	},

	enable: function () {
		this._textArea.removeAttribute('disabled');
	},

	_onPermission: function(e) {
		if (e.perm === 'edit') {
			this._textArea.removeAttribute('disabled');
		} else {
			this._textArea.setAttribute('disabled', true);
		}
	},

	_onCommandResult: function(e) {
		if ((e.commandName === '.uno:Undo' || e.commandName === '.uno:Redo') && window.mode.isMobile()) {
			//undoing something on mobile does not trigger any input method
			//this causes problem in mobile working with suggestions
			//i.e: type "than" and then select "thank" from suggestion
			//now undo and then again select "thanks" from suggestions
			//final output is "thans"
			//this happens because undo doesn't change the textArea value
			//and no other way to maintain the history
			//So better to clean the textarea so no suggestions appear
			this._emptyArea();
		}
	},

	_onFocusBlur: function(ev) {
		this._fancyLog(ev.type, '');

		var onoff = (ev.type == 'focus' ? L.DomEvent.on : L.DomEvent.off).bind(L.DomEvent);

		// Debug - connect first for saner logging.
		onoff(
			this._textArea,
			'copy cut compositionstart compositionupdate compositionend select keydown keypress keyup beforeinput textInput textinput input',
			this._onEvent,
			this
		);

		onoff(this._textArea, 'input', this._onInput, this);
		onoff(this._textArea, 'beforeinput', this._onBeforeInput, this);
		onoff(this._textArea, 'compositionstart', this._onCompositionStart, this);
		onoff(this._textArea, 'compositionupdate', this._onCompositionUpdate, this);
		onoff(this._textArea, 'compositionend', this._onCompositionEnd, this);
		onoff(this._textArea, 'keydown', this._onKeyDown, this);
		onoff(this._textArea, 'keyup', this._onKeyUp, this);
		onoff(this._textArea, 'copy cut paste', this._map._handleDOMEvent, this._map);

		this._map.notifyActive();

		if (ev.type === 'blur' && this._isComposing) {
			this._abortComposition(ev);
		}
	},

	// Focus the textarea/contenteditable
	// @acceptInput (only on "mobile" (= mobile phone) or on iOS and Android in general) true if we want to
	// accept key input, and show the virtual keyboard.
	focus: function(acceptInput) {
		if (isAnyVexDialogActive())
			return;
		// console.trace('L.TextInput.focus(' + acceptInput + ')');

		// Note that the acceptInput parameter intentionally
		// is a tri-state boolean: undefined, false, or true.

		// Clicking or otherwise focusing the map should focus on the clipboard
		// container in order for the user to input text (and on-screen keyboards
		// to pop-up), unless the document is read only.
		if (!this._map.isPermissionEdit()) {
			this._setAcceptInput(false);
			// on clicking focus is important
			// specially in chrome once document loses focus it never gets it back
			// which causes shortcuts to stop working (i.e: print, search etc...)
			this._map.getContainer().focus();
			return;
		}

		// Trick to avoid showing the software keyboard: Set the textarea
		// read-only before focus() and reset it again after the blur()
		if (!window.ThisIsTheiOSApp && navigator.platform !== 'iPhone' && !window.mode.isChromebook()) {
			if ((window.ThisIsAMobileApp || window.mode.isMobile()) && acceptInput !== true)
				this._textArea.setAttribute('readonly', true);
		}

		if (!window.ThisIsTheiOSApp && navigator.platform !== 'iPhone') {
			this._textArea.focus();
		} else if (acceptInput === true) {
			// On the iPhone, only call the textarea's focus() when we get an explicit
			// true parameter. On the other hand, never call the textarea's blur().

			// Calling blur() leads to so confusing behaviour with the keyboard not
			// showing up when we want. Better to have it show up a bit too long that
			// strictly needed.

			// Probably whether the calls to the textarea's focus() and blur() functions
			// actually do anything or not might depend on whether the call stack
			// originates in a user input event handler or not, for security reasons.

			// To investigate, uncomment the call to console.trace() at the start of
			// this function, and check when the topmost slot in the stack trace is
			// "(anonymous function)" in hammer.js (an event handler), and when it is
			// _onMessage (the WebSocket message handler in Socket.js).

			this._textArea.focus();
		}

		if (!window.ThisIsTheiOSApp && navigator.platform !== 'iPhone' && !window.mode.isChromebook()) {
			if ((window.ThisIsAMobileApp || window.mode.isMobile()) && acceptInput !== true) {
				this._setAcceptInput(false);
				this._textArea.blur();
				this._textArea.removeAttribute('readonly');
			} else {
				this._setAcceptInput(true);
			}
		} else if (acceptInput !== false) {
			this._setAcceptInput(true);
		} else {
			this._setAcceptInput(false);
		}
	},

	blur: function() {
		this._setAcceptInput(false);
		if (!window.ThisIsTheiOSApp && navigator.platform !== 'iPhone' && !window.mode.isChromebook())
			this._textArea.blur();
	},

	// Returns true if the last focus was to accept input.
	// Used to restore the keyboard.
	canAcceptKeyboardInput: function() {
		return this._acceptInput;
	},

	// Marks the content of the textarea/contenteditable as selected,
	// for system clipboard interaction.
	select: function select() {
		this._textArea.select();
	},

	getValue: function() {
		var value = this._textArea.value;
		return value;
	},

	// Convert an array of Unicode code points to a string of UTF-16 code units. Workaround
	// for String.fromCodePoint() that is missing in IE.
	codePointsToString: function(codePoints) {
		var result = '';
		for (var i = 0; i < codePoints.length; ++i) {
			if (codePoints[i] <= 0xFFFF)
				result = (result +
					  String.fromCharCode(codePoints[i]));
			else
				result = (result +
					  String.fromCharCode(((codePoints[i] - 0x10000) >> 10) + 0xD800) +
					  String.fromCharCode(((codePoints[i] - 0x10000) % 0x400) + 0xDC00));
		}
		return result;
	},

	// As the name says, this returns this._textArea.value as an array of numbers that are
	// Unicode code points. *Not* UTF-16 code units.
	getValueAsCodePoints: function() {
		var value = this.getValue();
		if (false) {
			var s = '[';
			for (var ii = 0; ii < value.length; ++ii) {
				if (ii > 0)
					s = s + ',';
				s = s + '0x' + value.charCodeAt(ii).toString(16);
			}
			s = s + ']';
			console.log('L.TextInput.getValueAsCodePoints: ' + s);
		}
		var arr = [];
		var code;
		for (var i = 0; i < value.length; ++i)
		{
			code = value.charCodeAt(i);

			// if it were not for IE11: "for (code of value)" does the job.
			if (code >= 0xd800 && code <= 0xdbff) // handle UTF16 pairs.
			{
				// TESTME: harder ...
				var high = (code - 0xd800) << 10;
				code = value.charCodeAt(++i);
				code = high + code - 0xdc00 + 0x10000;
			}
			arr.push(code);
		}
		return arr;
	},

	update: function() {
		if (this._container && this._map && this._latlng) {
			var position = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(position);
		}
	},

	_initLayout: function() {
		this._container = L.DomUtil.create('div', 'clipboard-container');
		this._container.id = 'doc-clipboard-container';

		// The textarea allows the keyboard to pop up and so on.
		// Note that the contents of the textarea are NOT deleted on each composed
		// word, in order to make
		this._textArea = L.DomUtil.create('textarea', 'clipboard', this._container);
		this._textArea.id = 'clipboard-area';
		this._textArea.setAttribute('autocapitalize', 'off');
		this._textArea.setAttribute('autofocus', 'true');
		this._textArea.setAttribute('autocorrect', 'off');
		this._textArea.setAttribute('autocomplete', 'off');
		this._textArea.setAttribute('spellcheck', 'false');

		this._textAreaLabel = L.DomUtil.create('label', 'visuallyhidden', this._container);
		this._textAreaLabel.setAttribute('for', 'clipboard-area');
		this._textAreaLabel.innerHTML = 'clipboard area';

		// Prevent automatic line breaks in the textarea. Without this,
		// chromium/blink will trigger input/insertLineBreak events by
		// just adding whitespace.
		// See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-wrap
		this._textArea.setAttribute('wrap', 'off');

		// Prevent autofocus
		this._textArea.setAttribute('disabled', true);

		this._setupStyles();

		this._emptyArea();
	},

	_setupStyles: function() {
		if (this._isDebugOn) {
			// Style for debugging
			this._container.style.opacity = 0.5;
			this._textArea.style.cssText = 'border:1px solid red !important';
			this._textArea.style.width = '120px';
			this._textArea.style.height = '50px';
			this._textArea.style.overflow = 'display';

			this._textArea.style.fontSize = '30px';
			this._textArea.style.position = 'relative';
			this._textArea.style.left = '10px';
		} else {
			this._container.style.opacity = 0;
			this._textArea.style.width = '1px';
			this._textArea.style.height = '1px';
			this._textArea.style.caretColor = 'transparent';
			this._textArea.style.resize = 'none';

			if (L.Browser.isInternetExplorer || L.Browser.edge)
			{
				// Setting the font-size to zero is the only reliable
				// way to hide the caret in MSIE11, as the CSS "caret-color"
				// property is not implemented.
				this._textArea.style.fontSize = '0';
			}
		}
	},

	debug: function(debugOn) {
		this._isDebugOn = !!debugOn;
		this._setupStyles();
	},

	activeElement: function() {
		return this._textArea;
	},

	// Displays the caret and the under-caret marker.
	// Fetches the coordinates of the caret from the map's doclayer.
	showCursor: function() {
		if (!this._map._docLayer._cursorMarker) {
			return;
		}

		// Fetch top and bottom coords of caret
		var top = this._map._docLayer._visibleCursor.getNorthWest();
		var bottom = this._map._docLayer._visibleCursor.getSouthWest();

		if (!this._map._docLayer._cursorMarker.isDomAttached()) {
			// Display caret
			this._map._docLayer._cursorMarker.add();
		}
		this._map._docLayer._cursorMarker.setMouseCursor();

		// Move and display under-caret marker
		if (L.Browser.touch) {
			if (this._map._docLayer._textCSelections.empty()) {
				this._cursorHandler.setLatLng(bottom).addTo(this._map);
			} else {
				this._map.removeLayer(this._cursorHandler);
			}
		}

		// Move the hidden text area with the cursor
		this._latlng = L.latLng(top);
		this.update();
		// shape handlers hidden (if selected)
		this._map.fire('handlerstatus', {hidden: true});
		if (window.mode.isMobile() && this._map._docLoaded && this._map.getDocType() === 'spreadsheet')
			this._map.onFormulaBarFocus();
	},

	// Hides the caret and the under-caret marker.
	hideCursor: function() {
		if (!this._map._docLayer._cursorMarker) {
			return;
		}
		if (this._map._docLayer._cursorMarker.isDomAttached())
			this._map._docLayer._cursorMarker.remove();
		this._map.removeLayer(this._cursorHandler);
		// shape handlers visible again (if selected)
		this._map.fire('handlerstatus', {hidden: false});
	},

	_setPos: function(pos) {
		L.DomUtil.setPosition(this._container, pos);
	},

	// Generic handle attached to most text area events, just for debugging purposes.
	_onEvent: function _onEvent(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;

		var msg = {
			inputType: ev.inputType,
			data: ev.data,
			key: ev.key,
			isComposing: ev.isComposing
		};

		if ('key' in ev) {
			msg.key = ev.key;
			msg.keyCode = ev.keyCode;
			msg.code = ev.code;
			msg.which = ev.which;
		}
		this._fancyLog(ev.type, msg);
	},

	_fancyLog: function _fancyLog(type, payload) {
		// Avoid unhelpful exceptions
		if (payload === undefined)
			payload = 'undefined';
		else if (payload === null)
			payload = 'null';

		// Save to downloadable log
		L.Log.log(payload.toString(), 'INPUT');

		// Pretty-print on console (but only if "tile layer debug mode" is active)
		if (this._isDebugOn) {
			var state = this._isComposing ? 'C' : 'N';
			state += this._hasWorkingSelectionStart ? 'S' : '-';
			state += this._ignoreNextBackspace ? 'I' : '-';
			state += ' ';

			var textSel = this._textArea.selectionStart + '!' + this._textArea.selectionEnd;
			state += textSel + ' ';

			var sel = window.getSelection();
			var content = this.getValue();
			if (sel === null)
				state += '-1';
			else
			{
				state += sel.rangeCount;

				state += ' ';
				var cursorPos = -1;
				for (var i = 0; i < sel.rangeCount; ++i)
				{
					var range = sel.getRangeAt(i);
					state += range.startOffset + '-' + range.endOffset + ' ';
					if (cursorPos < 0)
						cursorPos = range.startOffset;
				}
				if (sel.toString() !== '')
					state += ': "' + sel.toString() + '" ';

				// inject probable cursor
				if (cursorPos >= 0)
					content = content.slice(0, cursorPos) + '|' + content.slice(cursorPos);
			}

			state += '[' + this._deleteHint + '] ';

			console.log2(
				+ new Date() + ' %cINPUT%c: ' + state
				+ '"' + content + '" ' + type + '%c ',
				'background:#bfb;color:black',
				'color:green',
				'color:black',
				JSON.stringify(payload)
			);
		}
	},

	// Backspaces and deletes at the beginning / end are filtered out, so
	// we get a beforeinput, but no input for them. Sometimes we can end up
	// in a state where we lost our leading / terminal chars and can't recover
	_onBeforeInput: function _onBeforeInput(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;

		this._ignoreNextBackspace = false;
		if (this._hasWorkingSelectionStart) {
			var value = this._textArea.value;
			if (value.length == 2 && value === this._preSpaceChar + this._postSpaceChar &&
			    this._textArea.selectionStart === 0)
			{
				// It seems some inputs eg. GBoard can magically move the cursor from " | " to "|  "
				console.log('Oh dear, gboard sabotaged our cursor position, fixing');
				// But when we detect the problem only emit a delete when we have one.
				if (ev.inputType && ev.inputType === 'deleteContentBackward')
				{
					this._removeTextContent(1, 0);
					// Having mended it we now get a real backspace on input (sometimes)
					this._ignoreNextBackspace = true;
				}
				this._emptyArea();
			}
		}
	},

	// Fired when text has been inputed, *during* and after composing/spellchecking
	_onInput: function _onInput(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;

		this._map.notifyActive();

		if (this._ignoreInputCount > 0) {
			console.log('ignoring synthetic input ' + this._ignoreInputCount);
			return;
		}

		if (ev.inputType) {
			if (ev.inputType == 'deleteContentForward')
				this._deleteHint = 'delete';
			else if (ev.inputType == 'deleteContentBackward')
				this._deleteHint = 'backspace';
			else
				this._deleteHint = '';
		}

		var ignoreBackspace = this._ignoreNextBackspace;
		this._ignoreNextBackspace = false;

		var content = this.getValueAsCodePoints();
		// Note that content is an array of Unicode code points

		var preSpaceChar = this._preSpaceChar.charCodeAt(0);
		var postSpaceChar = this._postSpaceChar.charCodeAt(0);

		// We use a different leading and terminal space character
		// to differentiate backspace from delete, then replace the character.
		if (content.length < 1 || content[0] !== preSpaceChar) { // missing initial space
			console.log('Sending backspace');
			if (!ignoreBackspace)
				this._removeTextContent(1, 0);
			this._emptyArea();
			return;
		}
		if (content[content.length-1] !== postSpaceChar) { // missing trailing space.
			console.log('Sending delete');
			this._removeTextContent(0, 1);
			this._emptyArea();
			return;
		}
		if (content.length < 2) {
			console.log('Missing terminal nodes: ' + this._deleteHint);
			if (this._deleteHint == 'backspace' ||
			    this._textArea.selectionStart === 0)
			{
				if (!ignoreBackspace)
					this._removeTextContent(1, 0);
			}
			else if (this._deleteHint == 'delete' ||
				 this._textArea.selectionStart === 1)
				this._removeTextContent(0, 1);
			else
				console.log('Cant detect delete or backspace');
			this._emptyArea();
			return;
		}

		// remove leading & tailing spaces.
		content = content.slice(1, -1);

		// In the android keyboard when you try to erase in an empty area
		// and then enter some character,
		// The first character will likely travel with the cursor,
		// And that is caused because after entering the first character
		// cursor position is never updated by keyboard (I know it is strange)
		// so here we manually correct the position
		if (content.length === 1 && this._lastContent.length === 0)
			this._setCursorPosition(2);

		var matchTo = 0;
		var sharedLength = Math.min(content.length, this._lastContent.length);
		while (matchTo < sharedLength && content[matchTo] === this._lastContent[matchTo])
			matchTo++;

		console.log('Comparison matchAt ' + matchTo + '\n' +
			    '\tnew "' + this.codePointsToString(content) + '" (' + content.length + ')' + '\n' +
			    '\told "' + this.codePointsToString(this._lastContent) + '" (' + this._lastContent.length + ')');

		var removeBefore = this._lastContent.length - matchTo;
		var removeAfter = 0;

		if (this._lastContent.length > content.length)
		{
			// Pressing '<space><delete>' can delete our terminal space
			// such that subsequent deletes will do nothing; need to
			// detect and reset in this case.
			if (this._deleteHint === 'delete')
			{
				removeBefore--;
				removeAfter++;
			}
		}

		if (removeBefore > 0 || removeAfter > 0)
			this._removeTextContent(removeBefore, removeAfter);

		var newText = content;
		if (matchTo > 0)
			newText = newText.slice(matchTo);

		this._lastContent = content;

		if (this._linebreakHint && this._map.dialog._calcInputBar &&
			this._map.getWinId() === this._map.dialog._calcInputBar.id) {
			this._sendKeyEvent(13, 5376);
		} else if (newText.length > 0) {
			this._sendText(this.codePointsToString(newText));
		}

		// was a 'delete' and we need to reset world.
		if (removeAfter > 0)
			this._emptyArea();
	},

	// Sends the given (UTF-8) string of text to loolwsd, as IME (text composition)
	// messages
	_sendText: function _sendText(text) {
		if (false) {
			var s = '[';
			for (var ii = 0; ii < text.length; ++ii) {
				if (ii > 0)
					s = s + ',';
				s = s + '0x' + text.charCodeAt(ii).toString(16);
			}
			s = s + ']';
			console.log('L.TextInput._sendText: ' + s);
		}
		this._fancyLog('send-text-to-loolwsd', text);

		// MSIE/Edge cannot compare a string to "\n" for whatever reason,
		// so compare charcode as well
		if (text === '\n' || (text.length === 1 && text.charCodeAt(0) === 13)) {
			// The composition messages doesn't play well with just a line break,
			// therefore send a keystroke.
			var unoKeyCode = this._linebreakHint ? 5376 : 1280;
			this._sendKeyEvent(13, unoKeyCode);
			this._emptyArea();
		} else {
			// The composition messages doesn't play well with line breaks inside
			// the composed word (e.g. word and a newline are queued client-side
			// and are sent together), therefore split and send keystrokes accordingly.

			var parts = text.split(/[\n\r]/);
			var l = parts.length;
			for (var i = 0; i < l; i++) {
				if (i !== 0) {
					this._sendKeyEvent(13, 1280);
					this._emptyArea();
				}
				if (parts[i].length > 0) {
					this._sendCompositionEvent(parts[i]);
				}
			}
		}
	},

	// Empties the textarea / contenteditable element.
	// If the browser supports the 'inputType' property on 'input' events, then
	// add empty spaces to the textarea / contenteditable, in order to
	// always catch deleteContentBackward/deleteContentForward input events
	// (some combination of browser + input method don't fire those on an
	// empty contenteditable).
	_emptyArea: function _emptyArea(noSelect) {
		this._fancyLog('empty-area');

		this._ignoreInputCount++;
		// Note: 0xA0 is 160, which is the character code for non-breaking space:
		// https://www.fileformat.info/info/unicode/char/00a0/index.htm

		// Using normal spaces would make FFX/Gecko collapse them into an
		// empty string.
		// FIXME: is that true !? ...

		console.log('Set old/lastContent to empty');
		this._lastContent = [];

		this._textArea.value = this._preSpaceChar + this._postSpaceChar;

		// avoid setting the focus keyboard
		if (!noSelect) {
			this._setCursorPosition(1);

			if (this._hasWorkingSelectionStart === undefined)
				this._hasWorkingSelectionStart = (this._textArea.selectionStart === 1);
		}

		this._fancyLog('empty-area-end');

		this._ignoreInputCount--;
	},

	_onCompositionStart: function _onCompositionStart(/*ev*/) {
		this._isComposing = true;
	},

	// Handled only in legacy situations ('input' events with an inputType
	// property are preferred).
	_onCompositionUpdate: function _onCompositionUpdate(ev) {
		this._map.notifyActive();
		this._onInput(ev);
	},

	// Chrome doesn't fire any "input/insertCompositionText" with "isComposing" set to false.
	// Instead , it fires non-standard "textInput" events, but those can be tricky
	// to handle since Chrome also fires "input/insertText" events.
	// The approach here is to use "compositionend" events *only in Chrome* to mark
	// the composing text as committed to the text area.
	_onCompositionEnd: function _onCompositionEnd(ev) {
		this._map.notifyActive();
		this._isComposing = false;
		this._onInput(ev);
	},

	// Called when the user goes back to a word to spellcheck or replace it,
	// on a timeout.
	// Very difficult to handle right now, so the strategy is to panic and
	// empty the text area.
	_abortComposition: function _abortComposition(ev) {
		this._fancyLog('abort-composition', ev.type);
		if (this._isComposing)
			this._isComposing = false;
		this._emptyArea(document.activeElement !== this._textArea);
	},

	_onKeyDown: function _onKeyDown(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (ev.keyCode === 8)
			this._deleteHint = 'backspace';
		else if (ev.keyCode === 46)
			this._deleteHint = 'delete';
		else {
			this._deleteHint = '';
			this._linebreakHint = ev.keyCode === 13 && ev.shiftKey;
		}
	},

	// Check arrow keys on 'keyup' event; using 'ArrowLeft' or 'ArrowRight'
	// shall empty the textarea, to prevent FFX/Gecko from ever not having
	// whitespace around the caret.
	// Across browsers, arrow up/down / home / end would move the caret to
	// the beginning/end of the textarea/contenteditable.
	_onKeyUp: function _onKeyUp(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;

		this._map.notifyActive();
		if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' ||
		    ev.key === 'ArrowUp' || ev.key === 'ArrowDown' ||
		    ev.key === 'Home' || ev.key === 'End' ||
		    ev.key === 'PageUp' || ev.key === 'PageDown'
		) {
			this._emptyArea();
		}
	},

	// Used in the deleteContentBackward for deleting multiple characters with a single
	// message.
	// Will remove characters from the queue first, if there are any.
	_removeTextContent: function _removeTextContent(before, after) {
		console.log('Remove ' + before + ' before, and ' + after + ' after');

		/// TODO: rename the event to 'removetextcontent' as soon as loolwsd supports it
		/// TODO: Ask Marco about it
		app.socket.sendMessage(
			'removetextcontext id=' +
			this._map.getWinId() +
			' before=' + before +
			' after=' + after
		);
	},

	// Tiny helper - encapsulates sending a 'textinput' websocket message.
	// sends a pair of "input" for a composition update paird with an "end"
	_sendCompositionEvent: function _sendCompositionEvent(text) {
		if (false) {
			var s = '[';
			for (var ii = 0; ii < text.length; ++ii) {
				if (ii > 0)
					s = s + ',';
				s = s + '0x' + text.charCodeAt(ii).toString(16);
			}
			s = s + ']';
			console.log('L.TextInput._sendCompositionEvent: ' + s);
		}

		// We want to trigger auto-correction, but not if we may
		// have to delete a count of characters in the future,
		// which is specific to crazy mobile keyboard / IMEs:
		if (!window.mode.isMobile() && !window.mode.isTablet() &&
		    this._autoCorrectChars[text])
		{
			var codes = this._autoCorrectChars[text];
			this._sendKeyEvent(codes[0], codes[1], 'input');
			this._sendKeyEvent(codes[2], codes[3], 'up');
		}
		else
		{
			var encodedText = encodeURIComponent(text);
			var winId = this._map.getWinId();
			app.socket.sendMessage(
				'textinput id=' + winId + ' text=' + encodedText);
		}
	},

	// Tiny helper - encapsulates sending a 'key' or 'windowkey' websocket message
	// "type" can be "input" (default) or "up"
	_sendKeyEvent: function _sendKeyEvent(charCode, unoKeyCode, type) {
		if (!type) {
			type = 'input';
		}
		if (this._map.editorHasFocus()) {
			app.socket.sendMessage(
				'key type=' + type + ' char=' + charCode + ' key=' + unoKeyCode + '\n'
			);
		} else {
			app.socket.sendMessage(
				'windowkey id=' +
					this._map.getWinId() +
					' type=' +
					type +
					' char=' +
					charCode +
					' key=' +
					unoKeyCode +
					'\n'
			);
		}
	},

	_onCursorHandlerDragEnd: function _onCursorHandlerDragEnd(ev) {
		var cursorPos = this._map._docLayer._latLngToTwips(ev.target.getLatLng());
		this._map._docLayer._postMouseEvent('buttondown', cursorPos.x, cursorPos.y, 1, 1, 0);
		this._map._docLayer._postMouseEvent('buttonup', cursorPos.x, cursorPos.y, 1, 1, 0);
	},

	_setCursorPosition: function(pos) {
		try {
			this._textArea.setSelectionRange(pos, pos);
		} catch (err) {
			// old firefox throws an exception on start.
		}
	},

	_setAcceptInput: function(accept) {
		if (L.Browser.cypressTest && this._textArea) {
			// This is used to track whether we *intended*
			// the keyboard to be visible or hidden.
			// There is no way track the keyboard state
			// programmatically, so the next best thing
			// is to track what we intended to do.
			this._textArea.setAttribute('data-accept-input', accept);
		}
		this._acceptInput = accept;
	}
});

L.textInput = function() {
	return new L.TextInput();
};
