/* -*- js-indent-level: 8 -*- */
/*
 * L.ClipboardContainer is the hidden textarea, which handles text
 * input events and clipboard selection.
 */

/* global */

L.ClipboardContainer = L.Layer.extend({
	initialize: function() {
		// Queued input - this shall be sent to lowsd after a short timeout,
		// and might be canceled in the event of a 'deleteContentBackward'
		// input event, to account for predictive keyboard behaviour.
		this._queuedInput = '';
		this._queueTimer = undefined;

		// Flag to denote the composing state, derived from  compositionstart/compositionend events.
		// Needed for a edge case in Chrome+AOSP where an
		// "input/deleteContentBackward" event is fired with "isComposing" set
		// to false even though it happens *before* a "compositionend" event.
		// Also for some cases in desktop Safari when an InputEvent doesn't have a "isComposing"
		// property (and therefore evaluates to "undefined")
		this._isComposing = false;

		// Stores the range(s) of the last 'beforeinput' event, so that the input event
		// can access it.
		this._lastRanges = [];

		// Stores the data of the last 'compositionstart' event. Needed to abort
		// composition when going back to spellcheck a word in FFX/Gecko + GBoard.
		// 		this._lastCompositionStartData = [];

		// Stores the type of the last 'input' event. Needed to abort composition
		// when going back to spellcheck a word in FFX/Gecko + AnySoftKeyboard and
		// some other scenarios.
		this._lastInputType = '';

		// Capability check.
		this._hasInputType = window.InputEvent && 'inputType' in window.InputEvent.prototype;

		// The "normal" order of composition events is:
		// - compositionstart
		// - compositionupdate
		// - input/insertCompositionText
		// But if the user goes back to a previous word for spellchecking, the browser
		// might fire a compositionupdate *without* a corresponding input event later.
		// In that case, the composition has to be aborted. Because of the order of
		// the events, a timer is needed to check for the right conditions.
		this._abortCompositionTimeout = undefined;

		// Defines whether to use a <input type=textarea> (when true) or a
		// <div contenteditable> (when false)
		this._legacyArea = L.Browser.safari;

		this._initLayout();

		// Under-caret orange marker.
		this._cursorHandler = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'leaflet-cursor-handler',
				iconSize: null
			}),
			draggable: true
		}).on('dragend', this._onCursorHandlerDragEnd, this);

		// Used for internal cut/copy/paste in the same document - to tell
		// lowsd whether to use its internal clipboard state (rich text) or to send
		// the browser contents (plaintext)
		this._lastClipboardText = undefined;

		// This variable prevents from hiding the keyboard just before focus call
		this.dontBlur = false;
	},

	onAdd: function() {
		if (this._container) {
			this.getPane().appendChild(this._container);
			this.update();
		}

		this._emptyArea();

		L.DomEvent.on(this._textArea, 'focus blur', this._onFocusBlur, this);

		// Do not wait for a 'focus' event to attach events if the
		// textarea/contenteditable is already focused (due to the autofocus
		// HTML attribute, the browser focusing it on DOM creation, or whatever)
		if (document.activeElement === this._textArea) {
			this._onFocusBlur({ type: 'focus' });
		}

		this._map.on('mousedown touchstart', this._abortComposition, this);
	},

	onRemove: function() {
		if (this._container) {
			this.getPane().removeChild(this._container);
		}
		L.DomEvent.off(this._textArea, 'focus blur', this._onFocusBlur, this);

		this._map.off('mousedown touchstart', this._abortComposition, this);
		this._map.removeLayer(this._cursorHandler);
	},

	_onFocusBlur: function(ev) {
		console.log(ev.type, performance.now(), ev);

		if (this.dontBlur && ev.type == 'blur') {
			this._map.focus();
			this.dontBlur = false;
			return;
		}

		var onoff = (ev.type == 'focus' ? L.DomEvent.on : L.DomEvent.off).bind(L.DomEvent);

		onoff(this._textArea, 'compositionstart', this._onCompositionStart, this);
		onoff(this._textArea, 'compositionend', this._onCompositionEnd, this);
		onoff(this._textArea, 'beforeinput', this._onBeforeInput, this);
		onoff(this._textArea, 'cut copy', this._onCutCopy, this);
		onoff(this._textArea, 'paste', this._onPaste, this);
		onoff(this._textArea, 'input', this._onInput, this);
		onoff(this._textArea, 'keyup', this._onKeyUp, this);

		if (L.Browser.ie) {
			onoff(this._textArea, 'textinput', this._onMSIETextInput, this);
			onoff(this._textArea, 'keydown', this._onMSIEKeyDown, this);
		}
		if (L.Browser.edge) {
			onoff(this._textArea, 'keydown', this._onEdgeKeyDown, this);
		}

		// Debug
		onoff(
			this._textArea,
			'copy cut compositionstart compositionupdate compositionend select selectionstart selectionchange keydown keypress keyup beforeinput textInput textinput input',
			this._onEvent,
			this
		);

		this._map.notifyActive();

		if (ev.type === 'blur') {
			if (this._isComposing) {
				this._queueInput(this._compositionText);
			}
			this._abortComposition();
		}
	},

	// Focus the textarea/contenteditable
	focus: function() {
		if (this._map._permission !== 'edit') {
			console.log('EPIC HORRORS HERE');
			return;
		}
		this._textArea.focus();
	},

	blur: function() {
		this._textArea.blur();
	},

	// Marks the content of the textarea/contenteditable as selected,
	// for system clipboard interaction.
	select: function select() {
		if (this._legacyArea) {
			this._textArea.select();
		} else {
			// As per https://stackoverflow.com/a/6150060/4768502
			var range = document.createRange();
			range.selectNodeContents(this._textArea);
			var sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);
		}
	},

	warnCopyPaste: function() {
		var self = this;
		vex.dialog.alert({
			unsafeMessage: _('<p>Your browser has very limited access to the clipboard, so use these keyboard shortcuts:<ul><li><b>Ctrl+C</b>: For copying.</li><li><b>Ctrl+X</b>: For cutting.</li><li><b>Ctrl+V</b>: For pasting.</li></ul></p>'),
			callback: function () {
				self._map.focus();
			}
		});
	},

	getValue: function() {
		if (this._legacyArea) {
			return this._textArea.value;
		} else {
			return this._textArea.textContent;
		}
	},

	setValue: function(val) {
		// console.log('clipboard setValue: ', val);
		if (this._legacyArea) {
			var tmp = document.createElement('div');
			tmp.innerHTML = val;
			this._textArea.value = tmp.innerText || tmp.textContent || '';
		} else {
			this._textArea.innerHTML = val;
		}
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

		if (this._legacyArea) {
			// Force a textarea on Safari. This is two-fold: Safari doesn't fire
			// input/insertParagraph events on an empty&focused contenteditable,
			// but does fire input/insertLineBreak on an empty&focused textarea;
			// Safari on iPad would show bold/italic/underline native controls
			// which cannot be handled with the current implementation.
			this._textArea = L.DomUtil.create('textarea', 'clipboard', this._container);
			this._textArea.setAttribute('autocorrect', 'off');
			this._textArea.setAttribute('autocapitalize', 'off');
			this._textArea.setAttribute('autocomplete', 'off');
			this._textArea.setAttribute('spellcheck', 'false');
			this._textArea.setAttribute('autofocus', 'true');
		} else {
			this._textArea = L.DomUtil.create('div', 'clipboard', this._container);
			this._textArea.setAttribute('contenteditable', 'true');
			this._textArea.setAttribute('autofocus', 'true');
		}

		this._setupStyles(false);
	},

	_setupStyles: function(debugOn) {
		if (debugOn) {
			// Style for debugging
			this._container.style.opacity = 0.5;
			this._textArea.style.cssText = 'border:1px solid red !important';
			this._textArea.style.width = '100px';
			this._textArea.style.height = '20px';
			this._textArea.style.overflow = 'display';
		} else {
			this._container.style.opacity = 0;
			this._textArea.style.width = '1px';
			this._textArea.style.height = '1px';
			this._textArea.style.caretColor = 'transparent';

			// Setting the font-size to zero is the only reliable
			// way to hide the caret in MSIE11, as the CSS "caret-color"
			// property is not implemented.
			this._textArea.style.fontSize = '0';
		}
	},

	debug: function(debugOn) {
		this._setupStyles(debugOn);
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

		// Display caret
		this._map.addLayer(this._map._docLayer._cursorMarker);

		// Move and display under-caret marker
		if (L.Browser.touch) {
			this._cursorHandler.setLatLng(bottom).addTo(this._map);
		}

		// Move the hidden text area with the cursor
		this._latlng = L.latLng(top);
		this.update();
	},

	// Hides the caret and the under-caret marker.
	hideCursor: function() {
		if (!this._map._docLayer._cursorMarker) {
			return;
		}
		this._map.removeLayer(this._map._docLayer._cursorMarker);
		this._map.removeLayer(this._cursorHandler);
	},

	_setPos: function(pos) {
		L.DomUtil.setPosition(this._container, pos);
	},

	// Return the content of _lastRanges as a string.
	_lastRangesString: function() {
		if (
			this._lastRanges[0] &&
			'startOffset' in this._lastRanges[0] &&
			'endOffset' in this._lastRanges[0]
		) {
			return this._lastRanges[0].startOffset + '-' + this._lastRanges[0].endOffset;
		}

		return undefined;
	},

	// Generic handle attached to most text area events, just for debugging purposes.
	_onEvent: function _onEvent(ev) {
		var msg = {
			type: ev.type,
			inputType: ev.inputType,
			data: ev.data,
			key: ev.key,
			isComposing: ev.isComposing
		};

		msg.lastRanges = this._lastRangesString();

		if (ev.type === 'input') {
			msg.inputType = ev.inputType;
		}

		if ('key' in ev) {
			msg.key = ev.key;
			msg.keyCode = ev.keyCode;
			msg.code = ev.code;
			msg.which = ev.which;
		}

		this._fancyLog(ev.type, msg);
	},

	_fancyLog: function _fancyLog(type, payload) {
		// Save to downloadable log
		L.Log.log(payload.toString(), 'INPUT');

		// Pretty-print on console (but only if "tile layer debug mode" is active)
		if (this._map._docLayer && this._map._docLayer._debug) {
			console.log2(
				+new Date() + ' %cINPUT%c: ' + type + '%c',
				'background:#bfb;color:black',
				'color:green',
				'color:black',
				JSON.stringify(payload)
			);
		}
	},

	// Fired when text has been inputed, *during* and after composing/spellchecking
	_onInput: function _onInput(ev) {
		this._map.notifyActive();

		var previousInputType = this._lastInputType;
		this._lastInputType = ev.inputType;

		if (!('inputType' in ev)) {
			if (this._isComposing) {
				this._sendCompositionEvent('input', this._textArea.textContent);
			} else {
				// Legacy MSIE, Android WebView or FFX < 66, just send the contents of the
				// container and clear it.
				if (this._textArea.textContent.length !== 0) {
					this._sendText(this._textArea.textContent);
				}
				this._emptyArea();
			}
		} else if (ev.inputType === 'insertCompositionText') {
			// The text being composed has changed.
			// This is diferent from a 'compositionupdate' event: a 'compositionupdate'
			// event might be fired when going back to spellcheck a word, but an
			// 'input/insertCompositionText' happens only when the user is adding to a
			// composition.

			// Abort composition when going back for spellchecking, FFX/Gecko
			if (L.Browser.gecko && previousInputType === 'deleteContentBackward') {
				return;
			}

			clearTimeout(this._abortCompositionTimeout);

			if (!this._isComposing) {
				// FFX/Gecko: Regardless of on-screen keyboard, there is a
				// input/insertCompositionText with isComposing=false *after*
				// the compositionend event.
				this._queueInput(ev.data);
			} else {
				// Flush the queue
				if (this._queuedInput !== '') {
					this._sendQueued();
				}

				// Tell lowsd about the current text being composed
				this._sendCompositionEvent('input', ev.data);
			}
		} else if (ev.inputType === 'insertText') {
			// Non-composed text has been added to the text area.

			// FFX+AOSP / FFX+AnySoftKeyboard edge case: Autocompleting a
			// one-letter word will fire a input/insertText with that word
			// right after a compositionend + input/insertCompositionText.
			// In that case, ignore the
			if (
				L.Browser.gecko &&
				ev.data.length === 1 &&
				previousInputType === 'insertCompositionText' &&
				ev.data === this._queuedInput
			) {
				return;
			}

			if (!this._isComposing) {
				this._queueInput(ev.data);
			}
		} else if (ev.inputType === 'insertParagraph') {
			// Happens on non-Safari on the contenteditable div.
			this._queueInput('\n');
			this._emptyArea();
		} else if (ev.inputType === 'insertLineBreak') {
			// Happens on Safari on the textarea.
			this._queueInput('\n');
			this._emptyArea();
		} else if (ev.inputType === 'deleteContentBackward') {
			if (this._isComposing) {
				// deletion refers to the text being composing, noop
				return;
			}

			// Delete text backwards - as many characters as indicated in the previous
			// 'beforeinput' event

			// These are sent e.g. by the GBoard keyboard when autocorrecting, meaning
			// "I'm about to send another textInput event with the right word".

			var count = 1;
			if (this._lastRanges[0]) {
				count = this._lastRanges[0].endOffset - this._lastRanges[0].startOffset;
			}

			// If there is queued input, cancel that first. This prevents race conditions
			// in lowsd (compose-backspace-compose messages are handled as
			// compose-compose-backspace)
			var l = this._queuedInput.length;
			if (l >= count) {
				this._queuedInput = this._queuedInput.substring(0, l - count);
			} else {
				for (var i = 0; i < count; i++) {
					// Send a UNO backspace keystroke per glyph to be deleted
					this._sendKeyEvent(8, 1283);
				}
			}

			// Empty the area and stop the event - this is needed so that Android+GBoard
			// doesn't fire a compositionstart event when deleting back into a word
			// that could be spellchecked.
			this._emptyArea();
			L.DomEvent.stop(ev);
		} else if (ev.inputType === 'deleteContentForward') {
			// Send a UNO 'delete' keystroke
			this._sendKeyEvent(46, 1286);
			this._emptyArea();
		} else if (ev.inputType === 'insertReplacementText') {
			// Happens only in Safari (both iOS and OS X) with autocorrect/spellcheck
			// FIXME: It doesn't provide any info about how much to replace!
			// This is currently disabled by means of using a <input type=textarea
			// autocorrect=off> in Safari.
			/// TODO: Send a specific message to lowsd to find the last word and
			/// replace it with the given one.
		} else if (ev.inputType === 'deleteCompositionText') {
			// Safari on OS X is extra nice about composition - it notifies the
			// browser whenever the composition text should be deleted.
		} else if (ev.inputType === 'insertFromComposition') {
			// Observed only on desktop Safari just before a "compositionend"
			// TODO: Check if the
			this._queueInput(ev.data);
		} else if (ev.inputType === 'deleteByCut') {
			// Called when Ctrl+X'ing
			this._abortComposition();
		} else {
			console.error('Unhandled type of input event!!', ev.inputType, ev);
			throw new Error('Unhandled type of input event!');
		}
	},

	// Chrome and MSIE (from 9 all the way up to Edge) send the non-standard
	// "textInput" DOM event.
	// In Chrome, this is fired *just before* the compositionend event, and *before*
	// any other "input" events which would add text to the area (e.g. "insertText")
	// "textInput" events are used in MSIE, since the "input" events do not hold
	// information about the text added to the area.
	// In MSIE11, the event is "textinput" (all lowercase).
	_onMSIETextInput: function _onInput(ev) {
		this._queueInput(ev.data);
	},

	// Sends the given (UTF-8) string of text to lowsd, as IME (text composition)
	// messages
	_sendText: function _sendText(text) {
		this._fancyLog('send-text-to-lowsd', text);

		// MSIE/Edge cannot compare a string to "\n" for whatever reason,
		// so compare charcode as well
		if (text === '\n' || (text.length === 1 && text.charCodeAt(0) === 13)) {
			// The composition messages doesn't play well with just a line break,
			// therefore send a keystroke.
			this._sendKeyEvent(13, 1280);
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
					this._sendCompositionEvent('input', parts[i]);
					this._sendCompositionEvent('end', parts[i]);
				}
			}
		}
	},

	// Empties the textarea / contenteditable element.
	_emptyArea: function _emptyArea() {
		if (this._hasInputType) {
			// Add two non-breaking spaces to the textarea/contenteditable,
			// but only after we can be sure that this browser doesn't
			// use legacy 'input' events, i.e. when the last 'input' event
			// did have a 'inputType' property.
			//
			// Note: 0xA0 is 160, which is the character code for non-breaking space:
			// https://www.fileformat.info/info/unicode/char/00a0/index.htm
			// Using normal spaces would make FFX/Gecko collapse them into an
			// empty string.
			if (this._legacyArea) {
				this._textArea.value = '\xa0\xa0';
				/// TODO: Check that this selection method works with MSIE11
				///
				this._textArea.setSelectionRange(1, 1);
			} else {
				this._textArea.innerText = '\xa0\xa0';
				var textNode = this._textArea.childNodes[0];
				var range = document.createRange();
				range.setStart(textNode, 1);
				range.setEnd(textNode, 1);
				range.collapse(true);
				var sel = window.getSelection();
				sel.removeAllRanges();
				sel.addRange(range);
				range.detach();
			}
		} else if (this._legacyArea) {
			this._textArea.value = '';
		} else {
			this._textArea.innerText = '';
			this._textArea.innerHTML = '';
		}
	},

	// The getTargetRanges() method usually returns an empty array,
	// since the ranges are only valid at the "beforeinput" stage.
	// Fetching this info for later is important, especially
	// for Chrome+"input/deleteContentBackwards" events.
	// Also, some deleteContentBackward/Forward input types
	// only happen at 'beforeinput' and not at 'input' events,
	// particularly when the textarea/contenteditable is empty, but
	// only in some configurations.
	_onBeforeInput: function _onBeforeInput(ev) {
		this._lastRanges = ev.getTargetRanges();

		// When trying to delete (i.e. backspace) on an empty textarea, the input event
		// won't be fired afterwards. Handle backspace here instead.

		// Chrome + AOSP does *not* send any "beforeinput" events when the
		// textarea is empty. In that case, a 'keydown'+'keypress'+'keyup' sequence
		// for charCode=8 is fired, and handled by the Map.Keyboard.js.
		// NOTE: Ideally this should never happen, as the textarea/contenteditable
		// is initialized with two non-breaking spaces when "emptied".
		if (!this._hasInputType || (this._lastRangesString() === '0-0')) {
			if (ev.inputType === 'deleteContentBackward') {
				this._sendKeyEvent(8, 1283);
			} else if (ev.inputType === 'deleteContentForward') {
				this._sendKeyEvent(46, 1286);
			}
		}
	},

	_queueInput: function _queueInput(text) {
		if (text === null) {
			// Chrome sends a input/insertText with 'null' event data when
			// typing a newline quickly after typing text.
			console.warn('Tried to queue null text! Maybe a lost newline?');
			this._queuedInput += '\n';
			clearTimeout(this._queueTimer);
		}
		else if (this._queuedInput !== '') {
			console.warn(
				'Text input already queued - recieving composition end events too fast!'
			);
			this._queuedInput += text;
			clearTimeout(this._queueTimer);
		} else {
			this._queuedInput = text;
		}

		//console.log('_queueInput', text, ' queue is now:', {text: this._queuedInput});
		this._queueTimer = setTimeout(this._sendQueued.bind(this), 50);
	},

	_clearQueued: function _clearQueued() {
		console.log('Cleared queued:', { text: this._queuedInput });
		clearTimeout(this._queueTimer);
		this._queuedInput = '';
	},

	_sendQueued: function _sendQueued() {
		// console.log('Sending to lowsd (queued): ', {text: this._queuedInput});
		this._sendText(this._queuedInput);
		this._clearQueued();
	},

	_onCompositionStart: function _onCompositionStart(/*ev*/) {
		this._isComposing = true;
	},

	// 	_onCompositionUpdate: function _onCompositionUpdate(ev) {
	// 		// Noop - handled at input/insertCompositionText instead.
	// 	},

	// Chrome doesn't fire any "input/insertCompositionText" with "isComposing" set to false.
	// Instead , it fires non-standard "textInput" events, but those can be tricky
	// to handle since Chrome also fires "input/insertText" events.
	// The approach here is to use "compositionend" events *only in Chrome* to mark
	// the composing text as committed to the text area.
	_onCompositionEnd: function _onCompositionEnd(ev) {
		// Check for standard chrome, and check heuristically for embedded Android
		// WebView (without chrome user-agent string)
		if (
			L.Browser.chrome ||
			(L.Browser.android && L.Browser.webkit3d && !L.Browser.webkit)
		) {
			if (this._lastInputType === 'insertCompositionText') {
				this._queueInput(ev.data);
			} else {
				// Ended a composition without user input, abort.
				// This happens on Chrome+GBoard when autocompleting a word
				// then entering a punctuation mark.
				this._abortComposition();
			}
		}

		// Check for Safari; it fires composition events on typing diacritics with dead keys.
		if (L.Browser.Safari) {
			if (this._lastInputType === 'insertFromComposition') {
				this._queueInput(ev.data);
			} else {
				this._abortComposition();
			}
		}

		// Tell lowsd to exit composition mode when the composition is empty
		// This happens when deleting the whole word being composed, e.g.
		// swipe a word then press backspace.
		if (ev.data === '') {
			this._sendCompositionEvent('input', '');
		}

		this._isComposing = false;
	},

	// Called when the user goes back to a word to spellcheck or replace it,
	// on a timeout.
	// Very difficult to handle right now, so the strategy is to panic and
	// empty the text area.
	_abortComposition: function _abortComposition() {
		if (this._isComposing) {
			this._sendCompositionEvent('input', '');
			// this._sendCompositionEvent('end', '');
			this._isComposing = false;
		}
		this._emptyArea();
	},

	// Override the system default for pasting into the textarea/contenteditable,
	// and paste into the document instead.
	_onPaste: function _onPaste(ev) {
		// Prevent the event's default - in this case, prevent the clipboard contents
		// from being added to the hidden textarea and firing 'input'/'textInput' events.
		ev.preventDefault();

		// TODO: handle internal selection here (compare pasted plaintext with the
		// last copied/cut plaintext, send a UNO 'paste' command over websockets if so.
		// 		if (this._lastClipboardText === ...etc...

		var pasteString;
		if (ev.clipboardData) {
			pasteString = ev.clipboardData.getData('text/plain'); // non-IE11
		} else if (window.clipboardData) {
			pasteString = window.clipboardData.getData('Text'); // IE 11
		}

		if (pasteString && pasteString === this._lastClipboardText) {
			// If the pasted text is the same as the last copied/cut text,
			// let lowsd use LOK's clipboard instead. This is done in order
			// to keep formatting and non-text bits.
			this._map._socket.sendMessage('uno .uno:Paste');
			return;
		}

		// Let the TileLayer functionality take care of sending the
		// DataTransfer from the event to lowsd.
		this._map._docLayer._dataTransferToDocument(
			ev.clipboardData || window.clipboardData /* IE11 */
		);

		this._abortComposition();
	},

	// Override the system default for cut & copy - ensure that the system clipboard
	// receives *plain text* (instead of HTML/RTF), and save internal state.
	// TODO: Change the 'gettextselection' command, so that it can fetch the HTML
	// version of the copied text **maintaining typefaces**.
	_onCutCopy: function _onCutCopy(ev) {
		var plaintext = document.getSelection().toString();

		this._lastClipboardText = plaintext;

		if (ev.type === 'copy') {
			this._map._socket.sendMessage('uno .uno:Copy');
		} else if (ev.type === 'cut') {
			this._map._socket.sendMessage('uno .uno:Cut');
		}

		if (event.clipboardData) {
			event.clipboardData.setData('text/plain', plaintext); // non-IE11
		} else if (window.clipboardData) {
			window.clipboardData.setData('Text', plaintext); // IE 11
		} else {
			console.warn('Could not set the clipboard contents to plain text.');
			return;
		}

		event.preventDefault();
	},

	// Check arrow keys on 'keyup' event; using 'ArrowLeft' or 'ArrowRight'
	// shall empty the textarea, to prevent FFX/Gecko from ever not having
	// whitespace around the caret.
	_onKeyUp: function _onKeyUp(ev) {
		if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
			this._emptyArea();
		}
	},

	// MSIE11 doesn't send any "textinput" events on enter, delete or backspace.
	// To handle those, an event handler is added to the "keydown" event (which repeats)
	_onMSIEKeyDown: function _onMSIEKeyDown(ev) {
		if (!ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
			if (ev.key === 'Delete' || ev.key === 'Del') {
				this._sendKeyEvent(46, 1286);
				this._emptyArea();
			} else if (ev.key === 'Backspace') {
				this._sendKeyEvent(8, 1283);
				this._emptyArea();
			} else if (ev.key === 'Enter') {
				this._queueInput('\n');
				this._emptyArea();
			}
		}
	},

	// Edge18 doesn't send any "input" events on delete or backspace.
	// To handle those, an event handler is added to the "keydown" event (which repeats)
	_onEdgeKeyDown: function _onEdgeKeyDown(ev) {
		if (!ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
			if (ev.key === 'Delete' || ev.key === 'Del') {
				this._sendKeyEvent(46, 1286);
				this._emptyArea();
			} else if (ev.key === 'Backspace') {
				this._sendKeyEvent(8, 1283);
				this._emptyArea();
			}
		}
	},

	// Tiny helper - encapsulates sending a 'textinput' websocket message.
	// "type" is either "input" for updates or "end" for commits.
	_sendCompositionEvent: function _sendCompositionEvent(type, text) {
		this._map._socket.sendMessage(
			'textinput id=' +
				this._map.getWinId() +
				' type=' +
				type +
				' text=' +
				encodeURIComponent(text)
		);
	},

	// Tiny helper - encapsulates sending a 'key' or 'windowkey' websocket message
	_sendKeyEvent: function _sendKeyEvent(charCode, unoKeyCode) {
		if (this._map.getWinId() === 0) {
			this._map._socket.sendMessage(
				'key type=input char=' + charCode + ' key=' + unoKeyCode + '\n'
			);
		} else {
			this._map._socket.sendMessage(
				'windowkey id=' +
					this._map.getWinId() +
					' type=input char=' +
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
	}
});

L.clipboardContainer = function() {
	return new L.ClipboardContainer();
};
