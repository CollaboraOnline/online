/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.A11yTextInput is the hidden textarea, which handles text input events
 *
 * This is made significantly more difficult than expected by such a
 * mess of browser, and mobile IME quirks that it is not possible to
 * follow events, but we have to re-construct input from a browser
 * text area itself.
 */

/* global app */

L.A11yTextInput = L.Layer.extend({
	initialize: function() {
		// Flag to denote the composing state, derived from
		// compositionstart/compositionend events; unused
		this._isComposing = false;

		// Used for signaling when in a mobile device the user tapped the edit button
		this._justSwitchedToEditMode = false;

		// We need to detect whether delete or backspace was
		// pressed sometimes - consider '  foo' -> ' foo'
		this._deleteHint = ''; // or 'delete' or 'backspace'

		// When <enter> key is hit a <div> element is created and appended to the editable area:
		// inputType: insertParagraph. No new char is added to the editable area textContent property.
		this._newlineHint = false;

		// <tab> is inserted into document but not inside the editable area
		this._tabHint = false;

		// We need to detect line break in the tunneled formula
		// input window for the multiline case.
		this._linebreakHint = false;

		// Clearing the area can generate input events
		this._ignoreInputCount = 0;

		// In core text selection exists even if it's empty and <backspace> deletes the empty selection
		// instead of the previous character.
		this._hasSelection = false;

		// If the last focus intended to accept user input.
		// Signifies whether the keyboard is meant to be visible.
		this._setAcceptInput(false);

		// Content
		this._lastContent = []; // unicode characters
		this._lastCursorPosition = 0;
		this._lastSelectionStart = 0;
		this._lastSelectionEnd = 0;
		this._hasWorkingSelectionStart = undefined; // does it work ?
		this._ignoreNextBackspace = false;

		this._preSpaceChar = '<img id="pre-space" alt=" " aria-hidden="true">';
		this._postSpaceChar = '<img id="post-space" alt=" " aria-hidden="true">';
		this._initialContent = this._preSpaceChar + this._postSpaceChar;

		// Debug flag, used in fancyLog(). See the debug() method.
		// this._isDebugOn = true;
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

		// unoKeyCode values of the digits.
		this._unoKeyMap = {
			'48': 96,   // 0
			'49': 97,   // 1
			'50': 98,   // 2
			'51': 99,   // 3
			'52': 100,  // 4
			'53': 101,  // 5
			'54': 102,  // 6
			'55': 103,  // 7
			'56': 104,  // 8
			'57': 105   // 9
		};

	},

	onAdd: function() {
		if (this._container) {
			this.getPane().appendChild(this._container);
			this.update();
		}

		// this._emptyArea();

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
		if (e.commandName === '.uno:Undo' || e.commandName === '.uno:Redo') {
			//undoing something on mobile does not trigger any input method
			//this causes problem in mobile working with suggestions
			//i.e: type "than" and then select "thank" from suggestion
			//now undo and then again select "thanks" from suggestions
			//final output is "thans"
			//this happens because undo doesn't change the textArea value
			//and no other way to maintain the history
			//So better to clean the textarea so no suggestions appear
			// this._emptyArea();
		}
	},

	_onFocusBlur: function(ev) {
		this._fancyLog(ev.type, '');
		this._dbg('_onFocusBlur');
		var onoff = (ev.type == 'focus' ? L.DomEvent.on : L.DomEvent.off).bind(L.DomEvent);

		// Debug - connect first for saner logging.
		onoff(
			this._textArea,
			'copy cut compositionstart compositionupdate compositionend select keydown keypress keyup beforeinput textInput textinput input',
			this._onEvent,
			this
		);

		// we already do the same in _onBeforeInput, anyway for Safari on iOS is too late:
		// the selection is messed up, so we miss the first typed key.
		// Needed also after a Ctrl+C.
		if (ev.type === 'focus') {
			if (!this._isSelectionValid() || this._isCursorAtBeginning()) {
				this._setSelectionRange(this._lastSelectionStart, this._lastSelectionEnd);
			} else {
				this._updateFocusedParagraph();
			}
		}

		onoff(this._textArea, 'input', this._onInput, this);
		onoff(this._textArea, 'beforeinput', this._onBeforeInput, this);
		onoff(this._textArea, 'compositionstart', this._onCompositionStart, this);
		onoff(this._textArea, 'compositionupdate', this._onCompositionUpdate, this);
		onoff(this._textArea, 'compositionend', this._onCompositionEnd, this);
		onoff(this._textArea, 'keydown', this._onKeyDown, this);
		onoff(this._textArea, 'keyup', this._onKeyUp, this);
		onoff(this._textArea, 'copy cut paste', this._map._handleDOMEvent, this._map);

		app.idleHandler.notifyActive();

		if (ev.type === 'blur' && this._isComposing) {
			this._abortComposition(ev);
		}
	},

	hasFocus: function() {
		return this._textArea && this._textArea === document.activeElement;
	},

	// Focus the textarea/contenteditable
	// @acceptInput (only on "mobile" (= mobile phone) or on iOS and Android in general) true if we want to
	// accept key input, and show the virtual keyboard.
	focus: function(acceptInput) {
		// Note that the acceptInput parameter intentionally
		// is a tri-state boolean: undefined, false, or true.

		// Clicking or otherwise focusing the map should focus on the clipboard
		// container in order for the user to input text (and on-screen keyboards
		// to pop-up), unless the document is read only.
		if (!this._map.isEditMode()) {
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
	select: function() {
		this._setSelectionRange(0, this.getPlainTextContent().length);
	},

	getValue: function() {
		var value = this.getPlainTextContent();
		if (this._hasFormulaBarFocus())
			value =  this._map.formulabar.getValue();
		return value;
	},

	getPlainTextContent: function() {
		return 	this._textArea.textContent;
	},

	getHTML: function() {
		return 	this._textArea.innerHTML;
	},

	_wrapContent: function(content) {
		return content.length === 0
			? this._initialContent
			: this._preSpaceChar + '<span id="readable-content" aria-hidden="false">' + content + '</span>' + this._postSpaceChar;
	},

	setHTML: function(content) {
		this._textArea.innerHTML = this._wrapContent(content);
	},

	resetContent: function() {
		this._textArea.innerHTML = this._initialContent;
	},

	_prependSpace: function() {
		this._textArea.innerHTML = this._preSpaceChar + this._textArea.innerHTML;
	},

	_appendSpace: function() {
		this._textArea.innerHTML = this._textArea.innerHTML + this._postSpaceChar;
	},

	_getLastCursorPosition: function() {
		return this._lastCursorPosition;
	},

	_setLastCursorPosition: function(nPos) {
		this._lastCursorPosition = nPos;
		this._lastSelectionStart = this._lastSelectionEnd = nPos;
	},

	_setLastSelection: function(nStart, nEnd) {
		this._lastSelectionStart = nStart;
		this._lastSelectionEnd = this._lastCursorPosition = nEnd;
	},

	_isLastSelectionEmpty: function() {
		return this._lastSelectionStart === this._lastSelectionEnd;
	},

	_isLastSelection: function(start, end) {
		return this._hasSelection &&  this._lastSelectionStart === start && this._lastSelectionEnd === end;
	},

	_updateCursorPosition: function(nPos) {
		if (typeof nPos !== 'number' || nPos < 0)
			return;
		this._setLastCursorPosition(nPos);
		this._setCursorPosition(nPos);
	} ,

	_updateSelection: function(pos, start, end, forced) {
		window.app.console.log('_updateSelection: pos: ' + pos + ', start: ' + start + ', end: ' + end);
		if (typeof pos !== 'number' || typeof start !== 'number' || typeof end !== 'number')
			return;

		var hasSelection= !(start === -1 && end === -1);
		if (!hasSelection) {
			this._updateCursorPosition(pos);
		} else if (forced || !this._isLastSelection(start, end)) {
			if (forced || start !== end || !this._hasSelection || !this._isLastSelectionEmpty()) {
				// When the new selection is empty (start == end). the cursor position is updated
				// only if there was no previous selection, or previous selection was not empty.
				// In fact when both old and new selection are empty, it means that the old selection
				// has been moved to a new position by some typing. Anyway changing cursor position
				// while typing can mess up editable area content.
				this._setLastSelection(start, end);
				this._setSelectionRange(start, end);
			}
		}
		this._setSelectionFlag(hasSelection);
	},

	_setSelectionFlag: function(flag) {
		this._hasSelection = flag;
		if (L.Browser.cypressTest)
			this._textArea.isSelectionNull = !flag;
	},

	_setFocudeParagraph: function(content, pos, start, end) {
		window.app.console.log('_setFocudeParagraph:'
			+ '\n    content "' + content + '"'
			+ '\n    pos: ' + pos
			+ '\n    start: ' + start + ', end: ' + end);

		this._isComposing = false;
		this._onComposingContent = undefined;
		if (!this._hasFormulaBarFocus()) {
			this.setHTML(content);
			this.updateLastContent();
			this._updateSelection(pos, start, end, true);
		}
	},

	_updateFocusedParagraph: function() {
		window.app.console.log('_updateFocusedParagraph');
		if (this._remoteContent !== undefined) {
			this._setFocudeParagraph(this._remoteContent, this._remotePosition,
				this._remoteSelectionStart, this._remoteSelectionEnd);
		} else if (this._remoteSelectionEnd !== undefined) {
			this._updateSelection(this._remotePosition, this._remoteSelectionStart, this._remoteSelectionEnd);
		} else if (this._remotePosition !== undefined) {
			this._updateCursorPosition(this._remotePosition);
		}
		this._remoteContent = undefined;
		this._remotePosition = undefined;
		this._remoteSelectionStart = undefined;
		this._remoteSelectionEnd = undefined;
	},

	onAccessibilityFocusChanged: function(content, pos, start, end, force) {
		if (!this.hasFocus() || (this._isComposing && !force)) {
			window.app.console.log('onAccessibilityFocusChanged: skipped updating: '
				+ '\n  hasFocus: ' + this.hasFocus()
				+ '\n  _isComposing: ' + this._isComposing
				+ '\n  force: ' + force);
			this._remoteContent = content;
			this._remotePosition = pos;
			this._remoteSelectionStart = start;
			this._remoteSelectionEnd = end;
		} else {
			this._setFocudeParagraph(content, pos, start, end);
		}
	},

	setA11yFocusedParagraph: function(content, pos, start, end) {
		this._setFocudeParagraph(content, pos, start, end);
	},

	onAccessibilityCaretChanged: function(nPos) {
		window.app.console.log('onAccessibilityCaretChanged: \n' +
			'    position: ' + nPos + '\n' +
			'    _isComposing: ' + this._isComposing);
		if (!this.hasFocus() || this._isComposing) {
			this._remotePosition = nPos;
			this._setLastCursorPosition(nPos);
		}
		else if (!this._hasFormulaBarFocus()) {
			this._updateCursorPosition(nPos);
		}
	},

	setA11yCaretPosition: function(nPos) {
		if (this._isLastSelectionEmpty()) {
			this.onAccessibilityCaretChanged(nPos);
		}
	},

	onAccessibilityTextSelectionChanged: function(start, end) {
		if (!this.hasFocus() || this._isComposing) {
			this._remoteSelectionStart = start;
			this._remoteSelectionEnd = end;
			this._remotePosition = end;
		} else {
			this._updateSelection(this._lastCursorPosition, start, end);
		}
	},

	// Check if a UTF-16 pair represents a Unicode code point
	_isSurrogatePair: function(hi, lo) {
		return 	hi >= 0xd800 && hi <= 0xdbff && lo >= 0xdc00 && lo <= 0xdfff;
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
	getValueAsCodePoints: function(value) {
		if (false) {
			var s = '[';
			for (var ii = 0; ii < value.length; ++ii) {
				if (ii > 0)
					s = s + ',';
				s = s + '0x' + value.charCodeAt(ii).toString(16);
			}
			s = s + ']';
			window.app.console.log('L.A11yTextInput.getValueAsCodePoints: ' + s);
		}
		var arr = [];
		var code;
		for (var i = 0; i < value.length; ++i)
		{
			code = value.charCodeAt(i);
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
		this._textArea = L.DomUtil.create('div', 'clipboard', this._container);
		this._textArea.id = 'clipboard-area';
		this._textArea.setAttribute('contenteditable', 'true');
		this._textArea.setAttribute('autocapitalize', 'off');
		this._textArea.setAttribute('autofocus', 'true');
		this._textArea.setAttribute('autocorrect', 'off');
		this._textArea.setAttribute('autocomplete', 'off');
		this._textArea.setAttribute('spellcheck', 'false');

		this._textAreaLabel = L.DomUtil.create('label', 'visuallyhidden', this._container);
		this._textAreaLabel.setAttribute('for', 'clipboard-area');
		this._textAreaLabel.innerHTML = 'clipboard area';
		this._setSelectionFlag(false);

		// Prevent automatic line breaks in the textarea. Without this,
		// chromium/blink will trigger input/insertLineBreak events by
		// just adding whitespace.
		// See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea#attr-wrap
		this._textArea.setAttribute('wrap', 'off');

		// Prevent autofocus
		this._textArea.setAttribute('disabled', true);

		if (L.Browser.cypressTest) {
			var that = this;
			this._textArea._wrapContent = function(content) {
				return that._wrapContent(content);
			};
			this._textArea._getSelectionStart = function() {
				return that._getSelectionStart();
			};
			this._textArea._getSelectionEnd = function() {
				return that._getSelectionEnd();
			};
		}

		this._setupStyles();

		this._emptyArea();
	},

	_setupStyles: function() {
		if (this._isDebugOn) {
			// Style for debugging
			this._container.style.opacity = 0.5;
			this._textArea.style.cssText = 'border:1px solid red !important';
			this._textArea.style.width = L.Browser.cypressTest ? '1px' : '120px';
			this._textArea.style.height = L.Browser.cypressTest ? '1px' : '50px';
			this._textArea.style.overflow = 'display';

			this._textArea.style.fontSize = '20px';
			this._textArea.style.position = 'relative';
			this._textArea.style.left = '10px';
		} else {
			this._container.style.opacity = 0;
			this._textArea.style.width = '1px';
			this._textArea.style.height = '1px';
			this._textArea.style.caretColor = 'transparent';
			this._textArea.style.resize = 'none';
		}
		this._textArea.style['white-space'] = 'pre';
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
		this._map._docLayer._cursorMarker.setMouseCursorForTextBox();

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
		if (this._map._docLoaded && this._map.getDocType() === 'spreadsheet')
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
		// the offset is needed since we have to move away from the edited text
		// or double clicks for selecting text doesn't work properly
		if (L.Browser.cypressTest) {
			// Some cypress tests require for the editable area to be as near as possible
			// to the caret overlay when editing. In fact a synthetic mouse click on
			// the editable area is performed in order to make it focused and ready for the input.
			// However, since this click is forwarded to core, it could change the current caret
			// position causing a test failure.
			pos.x += 10;
			pos.y += 10;
		}
		else {
			pos.y += this._isDebugOn ? 50 : 200;
		}
		L.DomUtil.setPosition(this._container, pos);
	},

	// Generic handle attached to most text area events, just for debugging purposes.
	_onEvent: function(ev) {
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

	_fancyLog: function(type, payload) {
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

			var textSel = this._getSelectionStart() + '!' + this._getSelectionEnd();
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

			window.app.console.log(
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
	_onBeforeInput: function(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;
		this._dbg('_onBeforeInput [');
		this._ignoreNextBackspace = false;
		if (!this._isSelectionValid()) {
			// this._emptyArea();
			this._setCursorPosition(this._getLastCursorPosition());
		}
		else if (this._isCursorAtBeginning()) {
			// It seems some inputs eg. GBoard can magically move the cursor from " | " to "|  "
			window.app.console.log('Oh dear, gboard sabotaged our cursor position, fixing');
			// But when we detect the problem only emit a delete when we have one.
			if (ev.inputType && ev.inputType === 'deleteContentBackward')
			{
				this._removeTextContent(1, 0);
				// Having mended it we now get a real backspace on input (sometimes)
				this._ignoreNextBackspace = true;
			}
			else {
				this._setCursorPosition(this._getLastCursorPosition());
			}
			// this._emptyArea();
		}
		else if (!this._isLastSelectionEmpty() && !this._hasFormulaBarFocus() && this._isFormula()) {
			// A cell address is selected in formula input mode,
			// before inserting a new input we need to clear selection
			this._updateCursorPosition(this._lastSelectionEnd);
		}

		// Firefox is not able to delete the <img> post space. Since no 'input' event is generated,
		// we need to handle a <delete> at the end of the paragraph, here.
		if (L.Browser.gecko && (!this._hasSelection || this._isLastSelectionEmpty()) &&
			this._getLastCursorPosition() === this.getPlainTextContent().length &&
			this._deleteHint === 'delete') {
			window.app.console.log('Sending delete');
			this._removeEmptySelectionIfAny();
			this._removeTextContent(0, 1);
			// this._emptyArea();
		}
		this._dbg('_onBeforeInput ]');
	},

	// Used by FormulaBarJSDialog
	updateLastContent: function() {
		var value = this.getValue();
		this._lastContent = this.getValueAsCodePoints(value);
	},

	_isDigit: function(asciiChar) {
		if (asciiChar >= 48 && asciiChar <= 57)
			return true;
		return false;
	},

	_isFormula: function() {
		var content = this.getValue();
		return this._map._docLoaded && this._map.getDocType() === 'spreadsheet'
			&& content.length > 0 && content[0] === '=';
	},

	_hasFormulaBarFocus: function() {
		return 	this._map && this._map.formulabar && this._map.formulabar.hasFocus();
	},

	_requestFocusedParagraph: function() {
		app.socket.sendMessage('geta11yfocusedparagraph');
	},

	_restoreSpanWrapper: function() {
		var children = this._textArea.childNodes;
		if (children.length >= 3 && children[1].nodeName === '#text') {
			if (children.length === 3) {
				// When typing in an empty paragraph, we get <img>H<img>
				var htmlContent = this.getHTML();
				htmlContent = htmlContent.slice(this._preSpaceChar.length, -this._postSpaceChar.length);
				this.setHTML(htmlContent);
			}
			else if (children.length === 4 && children[2].id === 'readable-content') {
				// When typing, let's say 'k', at beginning of a not empty paragraph,
				// we get: <img>k<span>Hello World</span><img>
				var newText = children[1].textContent;
				children[2].innerHTML = newText + children[2].innerHTML;
				this._textArea.removeChild(children[1]);
			}
		}
	},

	// Fired when text has been inputed, *during* and after composing/spellchecking
	_onInput: function(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;
		this._dbg('_onInput [');
		app.idleHandler.notifyActive();

		if (this._ignoreInputCount > 0) {
			window.app.console.log('ignoring synthetic input ' + this._ignoreInputCount);
			return;
		}

		if (this._deleteHint === '' && ev.inputType) {
			if (ev.inputType == 'deleteContentForward')
				this._deleteHint = 'delete';
			else if (ev.inputType == 'deleteContentBackward')
				this._deleteHint = 'backspace';
		}

		var ignoreBackspace = this._ignoreNextBackspace;
		this._ignoreNextBackspace = false;

		if (this._newlineHint) {
			this._sendNewlineEvent();
			return;
		}

		// We use a different leading and terminal space character
		// to differentiate backspace from delete, then replace the character.
		if (!this._hasPreSpace()) { // missing initial space
			window.app.console.log('Sending backspace');
			if (!ignoreBackspace) {
				this._removeEmptySelectionIfAny();
				this._removeTextContent(1, 0);
			}
			// Lately we receive the new paragraph == above paragraph + current paragraph,
			// except current paragraph is the first one.
			// In this last case we need to restore the pre space.
			this._prependSpace();
			this._updateCursorPosition(0);
			return;
		}
		if (!this._hasPostSpace()) { // missing trailing space.
			window.app.console.log('Sending delete');
			this._removeTextContent(0, this._hasSelection && this._isLastSelectionEmpty() ? 2 : 1);
			// this._emptyArea();
			this._appendSpace();
			var pos = this._getLastCursorPosition();
			this._updateCursorPosition(pos);
			return;
		}

		// We assume that what is on the right of the new cursor position has not been modified
		// We also assume that lastCursorPosition is synchronized with the cursor position in core
		var cursorPosition = this._getSelectionEnd();
		var lastCursorPosition = this._getLastCursorPosition();
		var value = this.getValue();

		// In the android keyboard when you try to erase the pre-space
		// and then enter some character,
		// The first character will likely travel with the cursor,
		// And that is caused because after entering the first character
		// cursor position is never updated by keyboard (I know it is strange)
		// so here we manually correct the position
		if (lastCursorPosition === 0 && cursorPosition < 1 && value.length - this._lastContent.length === 1) {
			cursorPosition = 1;
			if (!this._isComposing)
				this._setCursorPosition(1);
		}

		// We need to take into account the case that lastCursorPosition is beyond the new cursor position.
		// For instance that can happen when after entering a word, several spaces are typed:
		// a '.' is appended automatically.
		var contentTailLength = value.length - cursorPosition;
		var lastContentTailLength = this._lastContent.length - lastCursorPosition;
		var guessedBackMatchTo = Math.min(lastContentTailLength, contentTailLength);
		var contentEnd = value.length - guessedBackMatchTo;
		var content = this.getValueAsCodePoints(value.slice(0, contentEnd));
		// Note that content is an array of Unicode code points
		var lastContentEnd = this._lastContent.length - guessedBackMatchTo;
		var lastContent = this._lastContent.slice(0, lastContentEnd);

		window.app.console.log('_onInput: cursorPosition: ' + cursorPosition + ', lastContentEnd: ' + lastContentEnd);

		var matchTo = 0;
		var compareUpTo = Math.min(content.length, lastContent.length);
		if (!this._isLastSelectionEmpty()) {
			// Selected text has always to be removed, so there is no need for comparing old and new content
			// over selection start. Moreover, if selection content starts with the typed key, it would lead to
			// an empty new content and the input would never be forwarded to core.
			compareUpTo = Math.min(compareUpTo, this._lastSelectionStart);
		}
		while (matchTo < compareUpTo && content[matchTo] === lastContent[matchTo])
			matchTo++;

		window.app.console.log('Comparison matchAt ' + matchTo + '\n' +
			'\tnew "' + this.codePointsToString(content) + '" (' + content.length + ')' + '\n' +
			'\told "' + this.codePointsToString(lastContent) + '" (' + lastContent.length + ')');

		// no new content
		if (matchTo === content.length && matchTo === lastContent.length)
			return;

		// matchTo <= lastCursorPosition <= lastContent.length
		matchTo = Math.min(matchTo, lastCursorPosition);

		var removeAfter = 0;
		var removeBefore = 0;
		if (!this._hasSelection) {
			removeAfter = lastContent.length - lastCursorPosition;
			removeBefore = (lastContent.length - matchTo) - removeAfter;
		}
		else if (this._deleteHint === 'backspace') {
			this._removeEmptySelectionIfAny();
			this._setSelectionFlag(false);
			removeBefore = 1;
		}
		else if (this._deleteHint === 'delete') {
			// when in core there is an empty selection the first <delete> deletes
			// the selection instead of the next char
			this._setSelectionFlag(false);
			removeAfter = this._isLastSelectionEmpty() ? 2 : 1;
		}

		// A browser selection range counts a surrogate UTF-16 pair as 2 chars.
		// The same occurs in core for the text cursor position reported by the caret changed accessibility event.
		// However, in core a single <backspace> or <delete> is needed for deleting a surrogate pair.
		if (removeBefore > 1) {
			var start = lastCursorPosition - removeBefore;
			for (var i = start; i < lastCursorPosition; i++) {
				if (this._isSurrogatePair(lastContent[i], lastContent[i+1])) {
					removeBefore--;
					i++;
				}
			}
		}
		if (removeAfter > 1) {
			var end = lastCursorPosition + removeAfter;
			for (var j = lastCursorPosition; j < end; j++) {
				if (this._isSurrogatePair(lastContent[j], lastContent[j+1])) {
					removeAfter--;
					j++;
				}
			}
		}

		if (removeBefore > 0 || removeAfter > 0)
			this._removeTextContent(removeBefore, removeAfter);

		var docLayer = this._map._docLayer;
		if (removeBefore > 0 && docLayer._typingMention) {
			var ch = docLayer._mentionText.pop();
			if (ch === '@')
				this._map.fire('closementionpopup', { 'typingMention': false });
			else
				this._map.fire('sendmentiontext', {data: docLayer._mentionText});
		}

		var newText = content;
		if (matchTo > 0)
			newText = newText.slice(matchTo);

		var head = this._lastContent.slice(0, matchTo);
		var tail = this._lastContent.slice(lastContentEnd);
		this._lastContent = head.concat(newText, tail);
		window.app.console.log('_onInput: \n'
			+ 'head: "' + this.codePointsToString(head) + '"\n'
			+ 'newText: "' + this.codePointsToString(newText) + '"\n'
			+ 'tail: "' + this.codePointsToString(tail) + '"');

		this._setLastCursorPosition(cursorPosition);

		if (newText.length > 0) {
			if (!this._isComposing && !this._isWrappedBySpan()) {
				this._restoreSpanWrapper();
				this._setCursorPosition(cursorPosition);
			}
			// When the cell formatted as percent, to trig percentage sign addition
			// automatically we send the first digit character as KeyEvent.
			if (this._map.getDocType() === 'spreadsheet' &&
				content.length === 1 && ev.inputType === 'insertText' &&
				this._isDigit(newText) && window.mode.isDesktop()) {
				this._sendKeyEvent(newText, this._unoKeyMap[newText], 'input');
			}
			else {
				this._sendText(this.codePointsToString(newText));
			}
		}

		// special handling for formulabar
		if (content.length) {
			var contentString = this.codePointsToString(content);
			if (contentString[matchTo] === '\n' || contentString.charCodeAt(matchTo) === 13)
				this._finishFormulabarEditing();
		}

		// special handling for mentions
		if (docLayer._typingMention)  {
			if (removeBefore === 0) {
				docLayer._mentionText.push(ev.data);
				var regEx = /^[0-9a-zA-Z ]+$/;
				if (ev.data && ev.data.match(regEx))
					this._map.fire('sendmentiontext', {data: docLayer._mentionText});
				else {
					this._map.fire('closementionpopup', { 'typingMention': false });
				}
			}
		}

		if (ev.data === '@' && this._map.getDocType() === 'text') {
			docLayer._mentionText.push(ev.data);
			docLayer._typingMention = true;
		}
		this._dbg('_onInput ]');
	},

	_finishFormulabarEditing: function() {
		// now we use that only on touch devices
		if (window.mode.isDesktop())
			return;

		if (this._hasFormulaBarFocus())
			this._map.dispatch('acceptformula');
	},

	// Sends the given (UTF-8) string of text to coolwsd, as IME (text composition)
	// messages
	_sendText: function(text) {
		if (false) {
			var s = '[';
			for (var ii = 0; ii < text.length; ++ii) {
				if (ii > 0)
					s = s + ',';
				s = s + '0x' + text.charCodeAt(ii).toString(16);
			}
			s = s + ']';
			window.app.console.log('L.A11yTextInput._sendText: ' + s);
		}
		this._fancyLog('send-text-to-coolwsd', text);

		// MSIE/Edge cannot compare a string to "\n" for whatever reason,
		// so compare charcode as well
		if (text === '\n' || (text.length === 1 && text.charCodeAt(0) === 13)) {
			this._sendNewlineEvent();
		} else {
			// The composition messages doesn't play well with line breaks inside
			// the composed word (e.g. word and a newline are queued client-side
			// and are sent together), therefore split and send keystrokes accordingly.

			var parts = text.split(/[\n\r]/);
			var l = parts.length;
			for (var i = 0; i < l; i++) {
				if (i !== 0) {
					this._sendKeyEvent(13, 1280);
					// this._emptyArea();
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
	_emptyArea: function(noSelect) {
		this._dbg('_emptyArea [');
		this._fancyLog('empty-area');

		this._ignoreInputCount++;
		// Note: 0xA0 is 160, which is the character code for non-breaking space:
		// https://www.fileformat.info/info/unicode/char/00a0/index.htm

		// Using normal spaces would make FFX/Gecko collapse them into an
		// empty string.
		// FIXME: is that true !? ...

		// window.app.console.log('Set old/lastContent to empty');
		this._lastContent = [];
		this._setLastCursorPosition(0);

		this.resetContent();

		if (this._hasFormulaBarFocus())
			this._map.formulabar.setValue('');

		// avoid setting the focus keyboard
		if (!noSelect && document.getElementById(this._textArea.id)) {
			this._setCursorPosition(0);
			if (this._hasWorkingSelectionStart === undefined)
				this._hasWorkingSelectionStart = (this._getSelectionStart() === 0);
		}

		this._fancyLog('empty-area-end');
		this._dbg('_emptyArea ]');
		this._ignoreInputCount--;
	},

	_onCompositionStart: function(/*ev*/) {
		this._isComposing = true;
		this._onComposingContent = this.getPlainTextContent();
		this._onComposingPosition = this._getLastCursorPosition();
		this._onComposingSelectionStart = this._lastSelectionStart;
		this._onComposingSelectionEnd = this._lastSelectionEnd;
	},

	// Handled only in legacy situations ('input' events with an inputType
	// property are preferred).
	_onCompositionUpdate: function(ev) {
		app.idleHandler.notifyActive();
		this._onInput(ev);
	},

	// Chrome doesn't fire any "input/insertCompositionText" with "isComposing" set to false.
	// Instead , it fires non-standard "textInput" events, but those can be tricky
	// to handle since Chrome also fires "input/insertText" events.
	// The approach here is to use "compositionend" events *only in Chrome* to mark
	// the composing text as committed to the text area.
	_onCompositionEnd: function(ev) {
		app.idleHandler.notifyActive();
		this._isComposing = false;
		if (ev.data && ev.data.charCodeAt(ev.data.length-1) === 10) // 10 === charCode('\n')
			this._newlineHint = true;

		if (!this._isWrappedBySpan()) {
			this._restoreSpanWrapper();
		}

		this._onInput(ev);
		this._updateFocusedParagraph();
	},

	// Called when the user goes back to a word to spellcheck or replace it,
	// on a timeout.
	// Very difficult to handle right now, so the strategy is to panic and
	// empty the text area.
	_abortComposition: function(ev) {
		this._fancyLog('abort-composition', ev.type);
		if (this._isComposing)
			this._isComposing = false;
		this._emptyArea((document.activeElement !== this._textArea)
			&& !this._hasFormulaBarFocus());
		this._requestFocusedParagraph();
	},

	_onKeyDown: function(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (app.notebookbarAccessibility)
			app.notebookbarAccessibility.onDocumentKeyDown(ev);

		if (ev.keyCode === 8)
			this._deleteHint = 'backspace';
		else if (ev.keyCode === 46)
			this._deleteHint = 'delete';
		else {
			this._deleteHint = '';
		}
		this._newlineHint = ev.keyCode === 13;
		this._linebreakHint = this._newlineHint && ev.shiftKey;
		this._tabHint = ev.keyCode === 9; // detect 'tab' key

		// We want to open drowdown menu when cursor is above a dropdown content control.
		if (ev.code === 'Space' || ev.code === 'Enter') {
			if (this._map['stateChangeHandler'].getItemValue('.uno:ContentControlProperties') === 'enabled') {
				if (app.sectionContainer.doesSectionExist(L.CSections.ContentControl.name)) {
					var section = app.sectionContainer.getSectionWithName(L.CSections.ContentControl.name);
					section.onClickDropdown(ev);
				}
			}
		}

		var mentionPopup = L.DomUtil.get('mentionPopup');
		if (mentionPopup) {
			if (ev.key === 'ArrowDown') {
				var initialFocusElement =
					document.querySelector('#mentionPopup span[tabIndex="0"]');
				if (initialFocusElement) {
					initialFocusElement.focus();
					ev.preventDefault();
					ev.stopPropagation();
				}
			} else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' ||
				ev.key === 'ArrowUp' || ev.key === 'Home' ||
				ev.key === 'End' || ev.key === 'PageUp' ||
				ev.key === 'PageDown' || ev.key === 'Enter' ||
				ev.key === 'Escape' || ev.key === 'Control' ||
				ev.key === 'Tab') {
				this._map.fire('closementionpopup', { 'typingMention': false });
			}
		}
	},

	// Check arrow keys on 'keyup' event; using 'ArrowLeft' or 'ArrowRight'
	// shall empty the textarea, to prevent FFX/Gecko from ever not having
	// whitespace around the caret.
	// Across browsers, arrow up/down / home / end would move the caret to
	// the beginning/end of the textarea/contenteditable.
	_onKeyUp: function(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;

		app.idleHandler.notifyActive();

		if (app.notebookbarAccessibility)
			app.notebookbarAccessibility.onDocumentKeyUp(ev);
	},

	// Used in the deleteContentBackward for deleting multiple characters with a single
	// message.
	// Will remove characters from the queue first, if there are any.
	_removeTextContent: function(before, after) {
		window.app.console.log('Remove ' + before + ' before, and ' + after + ' after');

		/// TODO: rename the event to 'removetextcontent' as soon as coolwsd supports it
		/// TODO: Ask Marco about it
		app.socket.sendMessage(
			'removetextcontext id=' +
			this._map.getWinId() +
			' before=' + before +
			' after=' + after
		);
	},

	_removeEmptySelectionIfAny: function() {
		if (this._hasSelection && this._isLastSelectionEmpty()) {
			// when in core there is an empty selection a <backspace> or a <delete> removes
			// the selection instead of the previous or next char, so we send a fake <delete>
			// in order to remove the empty selection.
			this._sendDelete();
		}
	},

	// Tiny helper - encapsulates sending a 'textinput' websocket message.
	// sends a pair of "input" for a composition update paird with an "end"
	_sendCompositionEvent: function(text) {
		if (false) {
			var s = '[';
			for (var ii = 0; ii < text.length; ++ii) {
				if (ii > 0)
					s = s + ',';
				s = s + '0x' + text.charCodeAt(ii).toString(16);
			}
			s = s + ']';
			window.app.console.log('L.A11yTextInput._sendCompositionEvent: ' + s);
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
	_sendKeyEvent: function(charCode, unoKeyCode, type) {
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

	_sendDelete: function() {
		this._sendKeyEvent(46, 1286, 'input');
	},

	_sendNewlineEvent: function() {
		// The composition messages doesn't play well with just a line break,
		// therefore send a keystroke.
		var unoKeyCode = this._linebreakHint ? 5376 : 1280;
		this._sendKeyEvent(13, unoKeyCode);
		this._newlineHint = false;
		var pos = this._getLastCursorPosition();
		var empty = this._lastContent.length === 0;
		this._emptyArea();
		// this._setLastCursorPosition(0);
		this._setSelectionFlag(false);
		if (pos === 0 && !empty)
			this._requestFocusedParagraph();
	},

	_onCursorHandlerDragEnd: function(ev) {
		var cursorPos = this._map._docLayer._latLngToTwips(ev.target.getLatLng());
		this._map._docLayer._postMouseEvent('buttondown', cursorPos.x, cursorPos.y, 1, 1, 0);
		this._map._docLayer._postMouseEvent('buttonup', cursorPos.x, cursorPos.y, 1, 1, 0);
	},

	_setCursorPosition: function(pos) {
		try {
			this._setSelectionRange(pos, pos);
		} catch (err) {
			// old firefox throws an exception on start.
		}
	},

	setSwitchedToEditMode: function() {
		this._justSwitchedToEditMode = true;
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
		if (this._acceptInput !== accept) {
			this._acceptInput = accept;
			if (this._justSwitchedToEditMode && accept && this._isInitialContent()) {
				// We need to make the paragraph at the cursor position focused in core
				// so its content is sent to the editable area.
				window.app.console.log('A11yTextInput._setAcceptInput: going to emit a synthetic click after switching to edit mode.');
				this._justSwitchedToEditMode = false;
				var top = this._map._docLayer._visibleCursor.getNorthWest();
				var bottom = this._map._docLayer._visibleCursor.getSouthWest();
				var center = L.latLng((top.lat + bottom.lat) / 2, top.lng);
				var cursorPos = this._map._docLayer._latLngToTwips(center);
				this._map._docLayer._postMouseEvent('buttondown', cursorPos.x, cursorPos.y, 1, 1, 0);
				this._map._docLayer._postMouseEvent('buttonup', cursorPos.x, cursorPos.y, 1, 1, 0);
			}
		}
	},

	_hasPreSpace: function() {
		var child = this._textArea.firstChild;
		while (child && child.tagName !== 'img') {
			if (child.id === 'pre-space')
				return true;
			child = child.firstChild;
		}
		return false;
	},

	_hasPostSpace: function() {
		var child = this._textArea.lastChild;
		while (child) {
			if (child.id === 'post-space')
				return true;
			child = child.lastChild;
		}
		return false;
	},

	_isInitialContent: function() {
		var children = this._textArea.childNodes;
		return children.length === 2 && this._hasPreSpace() && this._hasPostSpace();
	},

	_isCursorAtBeginning: function() {
		var selection = window.getSelection();
		return selection.isCollapsed && this._getSelectionStart() === -1;
	},

	_isSelectionValid: function() {
		return typeof this._getSelectionStart() === 'number' && typeof this._getSelectionEnd() === 'number';
	},

	_isTextContentEmpty: function() {
		return this.getPlainTextContent().length === 0;
	},

	_isWrappedBySpan: function() {
		var children = this._textArea.childNodes;
		return children.length === 3 && children[1].nodeName === 'SPAN';
	},

	// When the cursor is on a text node return the position wrt the whole plain text content
	// When the cursor is on a pre- / post-space node return -1 / -2
	// Otherwise return undefined
	_getSelection: function(isStart) {
		var selection = window.getSelection();
		var node, offset;
		if (isStart) {
			node = selection.anchorNode;
			offset = selection.anchorOffset;
		} else {
			node = selection.focusNode;
			offset = selection.focusOffset;
		}

		if (!node)
			return;
		if (node.id === 'pre-space')      // cursor position: <div><img>|</img> ... <img></img></div>
			return -1;
		if (node.id === 'post-space')     // cursor position: <div><img></img> ... <img>|</img></div>
			return -2;
		if (node.id === this._textArea.id) {
			if (this._hasPreSpace()) {
				if (offset === 0)         // cursor position: <div>|<img></img> ... <img></img></div>
					return -1;
				else if (offset === 1)    // cursor position: <div><img></img>| ... <img></img></div>
					return 0;
			} else if (this._hasPostSpace()) {
				if (offset === node.childNodes.length)    // cursor position: <div><img></img> ... <img></img>|</div>
					return -2;
			}
		}
		if (node.nodeType !== Node.TEXT_NODE)
			return;

		var walker = document.createTreeWalker(this._textArea, NodeFilter.SHOW_TEXT);
		var currentNode = walker.nextNode();
		var pos = 0;
		while (currentNode) {
			if (currentNode === node) {
				return pos + offset;
			}
			pos += currentNode.textContent.length;
			currentNode = walker.nextNode();
		}
	},

	_getSelectionStart: function() {
		return this._getSelection(true);
	},

	_getSelectionEnd: function() {
		return this._getSelection(false);
	},

	// set the selection range
	// start/end refer to the string represented by the whole plain text content
	// it's not possible to set range start/end position at <img> delimiters
	_setSelectionRange: function(start, end) {
		this._dbg('_setSelectionRange [');
		var selection = window.getSelection();
		selection.removeAllRanges();
		var range = document.createRange();

		// at the beginning we have no text node, so set cursor between <img> delimiters
		if (this._isInitialContent()) {
			range.setStart(this._textArea, 1);
			range.setEnd(this._textArea, 1);
			selection.addRange(range);
			this._dbg('_setSelectionRange ]');
			return;
		}

		// Normalize input parameters
		var l = this.getPlainTextContent().length;
		if (start < 0)
			start = 0;
		if (end < 0)
			end = 0;
		if (start > l)
			start = l;
		if (end > l)
			end = l;
		if (start > end) {
			var t = start;
			start = end;
			end = t;
		}
		var msg = '_setSelectionRange:\n' +
			'    start: ' + start + ', end: ' + end +'\n';

		var startContainer = null;
		var walker = document.createTreeWalker(this._textArea, NodeFilter.SHOW_TEXT);
		var currentNode = walker.nextNode(); // first text node in <div>
		var pos = 0;
		// walker iterates over text nodes only
		while (currentNode) {
			msg += '    current node: ' + currentNode + ', text content: "' + currentNode.textContent + '"\n';
			var len = currentNode.textContent.length;
			msg += '    pos: ' + pos + ', len: ' + len +'\n';
			if (!startContainer && start <= pos + len) {
				startContainer = currentNode;
				range.setStart(currentNode, start - pos);
				msg += '    current node set as start: offset: ' + (start - pos) + '\n';
			}
			// The range end is set only after the range start has been set.
			if (startContainer && end <= pos + len) {
				range.setEnd(currentNode, end - pos);
				msg += '    current node set as end:   offset: ' + (end - pos) + '\n';
				break;
			}
			pos += len;
			currentNode = walker.nextNode();
		}

		// Get the selection object and add the range to it
		selection.addRange(range);
		window.console.log(msg);
		this._dbg('_setSelectionRange ]');
	},

	_dbg: function(header) {
		if (!this._isDebugOn)
			return;

		var msg = header + '\n';
		msg += '  _lastContent: ' + this._lastContent  +'\n';
		msg += '  _lastContent: >' + this.codePointsToString(this._lastContent) + '<\n';
		msg += '  _lastCursorPosition: ' + this._getLastCursorPosition() + '\n';
		msg += '  _lastSelectionStart: ' + this._lastSelectionStart + '\n';
		msg += '  _lastSelectionEnd: ' + this._lastSelectionEnd + '\n';
		msg += '  _hasSelection: ' + this._hasSelection + '\n';
		msg += '  SelectionStart: ' + this._getSelectionStart() + '\n';
		msg += '  SelectionEnd: ' + this._getSelectionEnd() + '\n';
		msg += '  active element: ' + document.activeElement +'\n';
		msg += '  _isComposing: ' + this._isComposing + '\n';
		var textArea = this._textArea;
		msg += '  editable element: ' + '\n';
		msg += '    innerHTML: >' +  textArea.innerHTML + '<\n';
		msg += '    innerText: >' +  textArea.innerText + '<\n';
		msg += '    textContent: >' +  textArea.textContent + '<\n';
		msg += '    has focus: ' + (textArea === document.activeElement) + '\n';
		msg += '    has pre space: ' + this._hasPreSpace() + '\n';
		msg += '    has post space: ' + this._hasPostSpace() + '\n';

		var children = textArea.childNodes;
		for (var i = 0; i < children.length; ++i) {
			var child = children[i];
			msg += '    child: ' + child + '\n';
			if (child) {
				msg += '      name: ' + child.nodeName + '\n';
				msg += '      textContent: >' + child.textContent + '<\n';
			}
		}

		var selection = window.getSelection();
		msg += '  selection: \n';
		msg += '    content: >' + selection.toString() + '<\n';
		msg += '    range count: ' + selection.rangeCount + '\n';
		msg += '    anchorNode: ' + selection.anchorNode + '\n';
		if (selection.anchorNode) {
			msg += '      name: ' + selection.anchorNode.nodeName + '\n';
			msg += '      textContent: >' + selection.anchorNode.textContent + '<\n';
			for (i = 0; i < children.length; ++i) {
				if (children[i] === selection.anchorNode) {
					msg += '      equal to child: ' + i + '\n';
				} else if (children[i].contains(selection.anchorNode)) {
					msg += '      contained in child: ' + i + '\n';
				}
			}
		}
		msg += '    focusNode: ' + selection.focusNode + '\n';
		if (selection.focusNode) {
			msg += '      name: ' + selection.focusNode.nodeName + '\n';
			msg += '      textContent: >' + selection.focusNode.textContent + '<\n';
			for (i = 0; i < children.length; ++i) {
				if (children[i] === selection.focusNode) {
					msg += '      equal to child: ' + i + '\n';
				} else if (children[i].contains(selection.focusNode)) {
					msg += '      contained in child: ' + i + '\n';
				}
			}
		}
		msg += '    editable element contains anchorNode: ' + textArea.contains(selection.anchorNode) + '\n';
		msg += '    anchorNode == focusNode ? ' + (selection.anchorNode === selection.focusNode) + '\n';
		msg += '    anchorOffset: ' + selection.anchorOffset + '\n';
		msg += '    focusOffset: ' + selection.focusOffset + '\n';
		msg += '    is collapsed: ' + selection.isCollapsed + '\n';

		window.app.console.log(msg);
	}

});

L.a11yTextInput = function() {
	return new L.A11yTextInput();
};
