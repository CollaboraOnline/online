/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
 *
 * It handles keyboard interactions which are NOT text input, including those which
 * don't require edit permissions (e.g. page scroll). Text input is handled
 * at TextInput.
 */

/* global app vex UNOKey UNOModifier _ */

L.Map.mergeOptions({
	keyboard: true,
	keyboardPanOffset: 20,
	keyboardZoomOffset: 1
});

L.Map.Keyboard = L.Handler.extend({

	keymap: {
		8   : UNOKey.BACKSPACE,
		9   : UNOKey.TAB,
		13  : UNOKey.RETURN,
		16  : null, // shift		: UNKOWN
		17  : null, // ctrl		: UNKOWN
		18  : null, // alt		: UNKOWN
		19  : null, // pause/break	: UNKOWN
		20  : null, // caps lock	: UNKOWN
		27  : UNOKey.ESCAPE,
		32  : UNOKey.SPACE,
		33  : UNOKey.PAGEUP,
		34  : UNOKey.PAGEDOWN,
		35  : UNOKey.END,
		36  : UNOKey.HOME,
		37  : UNOKey.LEFT,
		38  : UNOKey.UP,
		39  : UNOKey.RIGHT,
		40  : UNOKey.DOWN,
		45  : UNOKey.INSERT,
		46  : UNOKey.DELETE,
		48  : UNOKey.NUM0,
		49  : UNOKey.NUM1,
		50  : UNOKey.NUM2,
		51  : UNOKey.NUM3,
		52  : UNOKey.NUM4,
		53  : UNOKey.NUM5,
		54  : UNOKey.NUM6,
		55  : UNOKey.NUM7,
		56  : UNOKey.NUM8,
		57  : UNOKey.NUM9,
		65  : UNOKey.A,
		66  : UNOKey.B,
		67  : UNOKey.C,
		68  : UNOKey.D,
		69  : UNOKey.E,
		70  : UNOKey.F,
		71  : UNOKey.G,
		72  : UNOKey.H,
		73  : UNOKey.I,
		74  : UNOKey.J,
		75  : UNOKey.K,
		76  : UNOKey.L,
		77  : UNOKey.M,
		78  : UNOKey.N,
		79  : UNOKey.O,
		80  : UNOKey.P,
		81  : UNOKey.Q,
		82  : UNOKey.R,
		83  : UNOKey.S,
		84  : UNOKey.T,
		85  : UNOKey.U,
		86  : UNOKey.V,
		87  : UNOKey.W,
		88  : UNOKey.X,
		89  : UNOKey.Y,
		90  : UNOKey.Z,
		91  : null, // left window key	: UNKOWN
		92  : null, // right window key	: UNKOWN
		93  : null, // select key	: UNKOWN
		96  : UNOKey.NUM0,
		97  : UNOKey.NUM1,
		98  : UNOKey.NUM2,
		99  : UNOKey.NUM3,
		100 : UNOKey.NUM4,
		101 : UNOKey.NUM5,
		102 : UNOKey.NUM6,
		103 : UNOKey.NUM7,
		104 : UNOKey.NUM8,
		105 : UNOKey.NUM9,
		106 : UNOKey.MULTIPLY,
		107 : UNOKey.ADD,
		109 : UNOKey.SUBTRACT,
		110 : UNOKey.DECIMAL,
		111 : UNOKey.DIVIDE,
		112 : UNOKey.F1,
		113 : UNOKey.F2,
		114 : UNOKey.F3,
		115 : UNOKey.F4,
		116 : UNOKey.F5,
		117 : UNOKey.F6,
		118 : UNOKey.F7,
		119 : UNOKey.F8,
		120 : UNOKey.F9,
		121 : UNOKey.F10,
		122 : UNOKey.F11,
		144 : UNOKey.NUMLOCK,
		145 : UNOKey.SCROLLLOCK,
		173 : UNOKey.SUBTRACT,
		186 : UNOKey.SEMICOLON,
		187 : UNOKey.EQUAL,
		188 : UNOKey.COMMA,
		189 : UNOKey.SUBTRACT,
		190 : null, // period		: UNKOWN
		191 : null, // forward slash	: UNKOWN
		192 : null, // grave accent	: UNKOWN
		219 : null, // open bracket	: UNKOWN
		220 : null, // back slash	: UNKOWN
		221 : null, // close bracket	: UNKOWN
		222 : null  // single quote	: UNKOWN
	},

	handleOnKeyDownKeys: {
		// these keys need to be handled on keydown in order for them
		// to work on chrome
		// Backspace and Delete are handled at TextInput's 'beforeinput' handler.
		9   : true, // tab
		19  : true, // pause/break
		20  : true, // caps lock
		27  : true, // escape
		33  : true, // page up
		34  : true, // page down
		35  : true, // end
		36  : true, // home
		37  : true, // left arrow
		38  : true, // up arrow
		39  : true, // right arrow
		40  : true, // down arrow
		45  : true, // insert
		113 : true  // f2
	},

	keyCodes: {
		pageUp:   33,
		pageDown: 34,
		enter:    13
	},

	navigationKeyCodes: {
		left:    [37],
		right:   [39],
		down:    [40],
		up:      [38],
		zoomIn:  [187, 107, 61, 171],
		zoomOut: [189, 109, 173]
	},

	initialize: function (map) {
		this._map = map;
		this._setPanOffset(map.options.keyboardPanOffset);
		this._setZoomOffset(map.options.keyboardZoomOffset);
		this.modifier = 0;
	},

	addHooks: function () {
		var container = this._map._container;

		// make the container focusable by tabbing
		if (container.tabIndex === -1) {
			container.tabIndex = '0';
		}

		L.DomEvent.on(this._map.getContainer(), 'keydown keyup keypress', this._onKeyDown, this);
		L.DomEvent.on(window.document, 'keydown', this._globalKeyEvent, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._map.getContainer(), 'keydown keyup keypress', this._onKeyDown, this);
		L.DomEvent.off(window.document, 'keydown', this._globalKeyEvent, this);
	},

	_ignoreKeyEvent: function(ev) {
		var shift = ev.shiftKey ? UNOModifier.SHIFT : 0;
		if (shift && (ev.keyCode === 45 || ev.keyCode === 46)) {
			// don't handle shift+insert, shift+delete
			// These are converted to 'cut', 'paste' events which are
			// automatically handled by us, so avoid double-handling
			return true;
		}
	},

	_setPanOffset: function (pan) {
		var keys = this._panKeys = {},
		    codes = this.navigationKeyCodes,
		    i, len;

		for (i = 0, len = codes.left.length; i < len; i++) {
			keys[codes.left[i]] = [-1 * pan, 0];
		}
		for (i = 0, len = codes.right.length; i < len; i++) {
			keys[codes.right[i]] = [pan, 0];
		}
		for (i = 0, len = codes.down.length; i < len; i++) {
			keys[codes.down[i]] = [0, pan];
		}
		for (i = 0, len = codes.up.length; i < len; i++) {
			keys[codes.up[i]] = [0, -1 * pan];
		}
	},

	_setZoomOffset: function (zoom) {
		var keys = this._zoomKeys = {},
		    codes = this.navigationKeyCodes,
		    i, len;

		for (i = 0, len = codes.zoomIn.length; i < len; i++) {
			keys[codes.zoomIn[i]] = zoom;
		}
		for (i = 0, len = codes.zoomOut.length; i < len; i++) {
			keys[codes.zoomOut[i]] = -zoom;
		}
	},

	// Convert javascript key codes to UNO key codes.
	_toUNOKeyCode: function (keyCode) {
		return this.keymap[keyCode] || keyCode;
	},

	// _onKeyDown - called only as a DOM event handler
	// Calls _handleKeyEvent(), but only if the event doesn't have
	// a charCode property (set to something different than 0) - that ignores
	// any 'beforeinput', 'keypress' and 'input' events that would add
	// printable characters. Those are handled by TextInput.js.
	_onKeyDown: function (ev) {
		if (this._map.uiManager.isUIBlocked())
			return;

		var completeEvent = app.socket.createCompleteTraceEvent('L.Map.Keyboard._onKeyDown', { type: ev.type, charCode: ev.charCode });
		window.app.console.log('keyboard handler:', ev.type, ev.key, ev.charCode, this._expectingInput, ev);

		if (ev.charCode == 0) {
			this._handleKeyEvent(ev);
		}
		if (this._map._docLayer)
			if (ev.shiftKey && ev.type === 'keydown')
				this._map._docLayer.shiftKeyPressed = true;
			else if (ev.keyCode === 16 && ev.type === 'keyup')
				this._map._docLayer.shiftKeyPressed = false;
		if (completeEvent)
			completeEvent.finish();
	},

	_globalKeyEvent: function(ev) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (this._map.jsdialog && this._map.jsdialog.hasDialogOpened()
			&& this._map.jsdialog.handleKeyEvent(ev)) {
			ev.preventDefault();
			return;
		}
	},

	// _handleKeyEvent - checks if the given keyboard event shall trigger
	// a message to coolwsd, and calls the given keyEventFn(type, charcode, keycode)
	// callback if so.
	// Called from _onKeyDown
	_handleKeyEvent: function (ev, keyEventFn) {
		if (this._map.uiManager.isUIBlocked())
			return;

		this._map.notifyActive();
		if (this._map.slideShow && this._map.slideShow.fullscreen) {
			return;
		}
		var docLayer = this._map._docLayer;
		if (!keyEventFn) {
			// default is to post keyboard events on the document
			keyEventFn = L.bind(docLayer.postKeyboardEvent, docLayer);
		}

		this.modifier = 0;
		var shift = ev.shiftKey ? UNOModifier.SHIFT : 0;
		var ctrl = ev.ctrlKey ? UNOModifier.CTRL : 0;
		var alt = ev.altKey ? UNOModifier.ALT : 0;
		var cmd = ev.metaKey ? UNOModifier.CTRL : 0;
		var location = ev.location;
		this.modifier = shift | ctrl | alt | cmd;

		// On Windows, pressing AltGr = Alt + Ctrl
		// Presence of AltGr is detected if previous Ctrl + Alt 'location' === 2 (i.e right)
		// because Ctrl + Alt + <some char> won't give any 'location' information.
		if (ctrl && alt) {
			if (ev.type === 'keydown' && location === 2) {
				this._prevCtrlAltLocation = location;
				return;
			}
			else if (location === 1) {
				this._prevCtrlAltLocation = undefined;
			}

			if (this._prevCtrlAltLocation === 2 && location === 0) {
				// and we got the final character
				if (ev.type === 'keypress') {
					ctrl = alt = this.modifier = 0;
				}
				else {
					// Don't handle remnant 'keyup'
					return;
				}
			}
		}

		if (ctrl || cmd) {
			if (this._handleCtrlCommand(ev)) {
				return;
			}
		}

		var charCode = ev.charCode;
		var keyCode = ev.keyCode;

		if ((this.modifier == UNOModifier.ALT || this.modifier == UNOModifier.SHIFT + UNOModifier.ALT) &&
		    keyCode >= 48) {
			// Presumably a Mac or iOS client accessing a "special character". Just ignore the alt modifier.
			// But don't ignore it for Alt + non-printing keys.
			this.modifier -= alt;
			alt = 0;
		}

		// handle help - F1
		if (ev.type === 'keydown' && !shift && !ctrl && !alt && !cmd && keyCode === 112) {
			this._map.showHelp('online-help');
			ev.preventDefault();
			return;
		}

		var unoKeyCode = this._toUNOKeyCode(keyCode);

		if (this.modifier) {
			unoKeyCode |= this.modifier;
			if (ev.type !== 'keyup' && (this.modifier !== shift || (keyCode === 32 && !this._map._isCursorVisible))) {
				keyEventFn('input', charCode, unoKeyCode);
				ev.preventDefault();
				return;
			}
		}

		if (this._map.stateChangeHandler._items['.uno:SlideMasterPage'] === 'true') {
			ev.preventDefault();
			return;
		}

		if (this._map.isPermissionEdit()) {
			docLayer._resetPreFetching();

			if (this._ignoreKeyEvent(ev)) {
				// key ignored
			}
			else if (ev.type === 'keydown') {
				// window.app.console.log(e);
				if (this.handleOnKeyDownKeys[keyCode] && charCode === 0) {
					keyEventFn('input', charCode, unoKeyCode);
					ev.preventDefault();
				}
			}
			else if ((ev.type === 'keypress') && (!this.handleOnKeyDownKeys[keyCode] || charCode !== 0)) {
				if (keyCode === 8 || keyCode === 46 || keyCode === 13)
				{
					// handled generically in TextInput.js
					window.app.console.log('Ignore backspace/delete/enter keypress');
					return;
				}
				if (charCode === keyCode && charCode !== 13) {
					// Chrome sets keyCode = charCode for printable keys
					// while LO requires it to be 0
					keyCode = 0;
					unoKeyCode = this._toUNOKeyCode(keyCode);
				}
				if (docLayer._debug) {
					// key press times will be paired with the invalidation messages
					docLayer._debugKeypressQueue.push(+new Date());
				}

				keyEventFn('input', charCode, unoKeyCode);
			}
			else if (ev.type === 'keyup') {
				if ((this.handleOnKeyDownKeys[keyCode] && charCode === 0) ||
				    (this.modifier) ||
				    unoKeyCode === UNOKey.RETURN) {
					keyEventFn('up', charCode, unoKeyCode);
				} else {
					// was handled as textinput
				}
			}
			if (keyCode === 9) {
				// tab would change focus to other DOM elements
				ev.preventDefault();
			}
		}
		else if (!this.modifier && (keyCode === 33 || keyCode === 34) && ev.type === 'keydown') {
			if (this._map._docLayer._docType === 'presentation' || this._map._docLayer._docType === 'drawing') {
				var partToSelect = keyCode === 33 ? 'prev' : 'next';
				this._map._docLayer._preview._scrollViewByDirection(partToSelect);
				if (app.file.fileBasedView)
					this._map._docLayer._checkSelectedPart();
			}
			return;
		}
		else if (!this.modifier && (keyCode === 35 || keyCode === 36) && ev.type === 'keydown') {
			if (this._map._docLayer._docType === 'drawing' && app.file.fileBasedView === true) {
				partToSelect = keyCode === 36 ? 0 : this._map._docLayer._parts -1;
				this._map._docLayer._preview._scrollViewToPartPosition(partToSelect);
				this._map._docLayer._checkSelectedPart();
			}
			return;
		}
		else if (ev.type === 'keydown') {
			var key = ev.keyCode;
			var map = this._map;
			if (key in this._panKeys && !ev.shiftKey) {
				if (map._panAnim && map._panAnim._inProgress) {
					return;
				}
				map.fire('scrollby', {x: this._panKeys[key][0], y: this._panKeys[key][1]});
			}
			else if (key in this._panKeys && ev.shiftKey &&
					!docLayer._textCSelections.empty()) {
				// if there is a selection and the user wants to modify it
				keyEventFn('input', charCode, unoKeyCode);
			}
			else if (key in this._zoomKeys) {
				map.setZoom(map.getZoom() + (ev.shiftKey ? 3 : 1) * this._zoomKeys[key], null, true /* animate? */);
			}
		}

		L.DomEvent.stopPropagation(ev);
	},

	_isCtrlKey: function (e) {
		if (window.ThisIsTheiOSApp || navigator.appVersion.indexOf('Mac') != -1 || navigator.userAgent.indexOf('Mac') != -1)
			return e.metaKey;
		else
			return e.ctrlKey;
	},

	// Given a DOM keyboard event that happened while the Control key was depressed,
	// triggers the appropriate action or coolwsd message.
	_handleCtrlCommand: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		// Control
		if (e.keyCode == 17)
			return true;

		if (e.type !== 'keydown' && e.key !== 'c' && e.key !== 'v' && e.key !== 'x' &&
		/* Safari */ e.keyCode !== 99 && e.keyCode !== 118 && e.keyCode !== 120) {
			e.preventDefault();
			return true;
		}

		if (e.keyCode !== 67 && e.keyCode !== 86 && e.keyCode !== 88 &&
		/* Safari */ e.keyCode !== 99 && e.keyCode !== 118 && e.keyCode !== 120 &&
			e.key !== 'c' && e.key !== 'v' && e.key !== 'x') {
			// not copy or paste
			e.preventDefault();
		}

		if (this._isCtrlKey(e) && e.shiftKey && e.key === '?') {
			this._map.showHelp('keyboard-shortcuts');
			e.preventDefault();
			return true;
		}

		// Handles paste special. The "Your browser" thing seems to indicate that this code
		// snippet is relevant in a browser only.
		if (!window.ThisIsAMobileApp && e.ctrlKey && e.shiftKey && e.altKey && (e.key === 'v' || e.key === 'V')) {
			var map = this._map;
			var msg = _('<p>Your browser has very limited access to the clipboard</p><p>Please press now: <kbd>Ctrl</kbd><span class="kbd--plus">+</span><kbd>V</kbd> to see more options</p><p class="vex-footnote">Close popup to ignore paste special</p>');
			msg = L.Util.replaceCtrlAltInMac(msg);
			this._map._clip.pasteSpecialVex = vex.open({
				unsafeContent: msg,
				showCloseButton: true,
				escapeButtonCloses: true,
				overlayClosesOnClick: false,
				buttons: {},
				afterOpen: function() {
					map.focus();
				}
			});
			return true;
		}

		// Handles unformatted paste
		if (this._isCtrlKey(e) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
			return true;
		}

		if (this._isCtrlKey(e) && (e.key === 'k' || e.key === 'K')) {
			this._map.showHyperlinkDialog();
			e.preventDefault();
			return true;
		}

		if (this._isCtrlKey(e) && (e.key === 'z' || e.key === 'Z')) {
			app.socket.sendMessage('uno .uno:Undo');
			e.preventDefault();
			return true;
		}

		if (this._isCtrlKey(e) && (e.key === 'y' || e.key === 'Y')) {
			app.socket.sendMessage('uno .uno:Redo');
			e.preventDefault();
			return true;
		}

		if (this._isCtrlKey(e) && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
			if (!this._map.uiManager.isStatusBarVisible()) {
				this._map.uiManager.showStatusBar();
			}
			this._map.fire('focussearch');
			e.preventDefault();
			return true;
		}

		if (e.altKey || e.shiftKey) {

			// need to handle Ctrl + Alt + C separately for Firefox
			if (e.key === 'c' && e.altKey) {
				this._map.insertComment();
				return true;
			}

			// Ctrl + Alt
			if (!e.shiftKey) {
				switch (e.keyCode) {
				case 53: // 5
					app.socket.sendMessage('uno .uno:Strikeout');
					return true;
				case 70: // f
					app.socket.sendMessage('uno .uno:InsertFootnote');
					return true;
				case 67: // c
				case 77: // m
					app.socket.sendMessage('uno .uno:InsertAnnotation');
					return true;
				case 68: // d
					app.socket.sendMessage('uno .uno:InsertEndnote');
					return true;
				}
			} else if (e.altKey) {
				switch (e.keyCode) {
				case 68: // Ctrl + Shift + Alt + d for tile debugging mode
					this._map._docLayer.toggleTileDebugMode();
				}
			}

			return false;
		}
		/* Without specifying the key type, the messages are sent twice (both keydown/up) */
		if (e.type === 'keydown' && window.ThisIsAMobileApp) {
			if (e.key === 'c' || e.key === 'C') {
				app.socket.sendMessage('uno .uno:Copy');
				return true;
			}
			else if (e.key === 'v' || e.key === 'V') {
				app.socket.sendMessage('uno .uno:Paste');
				return true;
			}
			else if (e.key === 'x' || e.key === 'X') {
				app.socket.sendMessage('uno .uno:Cut');
				return true;
			}
			if (window.ThisIsTheAndroidApp)
				e.preventDefault();
		}

		switch (e.keyCode) {
		case 51: // 3
			if (this._map.getDocType() === 'spreadsheet') {
				app.socket.sendMessage('uno .uno:SetOptimalColumnWidthDirect');
				app.socket.sendMessage('commandvalues command=.uno:ViewRowColumnHeaders');
				return true;
			}
			return false;
		case 53: // 5
			if (this._map.getDocType() === 'spreadsheet') {
				app.socket.sendMessage('uno .uno:Strikeout');
				return true;
			}
			return false;
		case 67: // 'C'
		case 88: // 'X'
		case 99: // 'c'
		case 120: // 'x'
		case 91: // Left Cmd (Safari)
		case 93: // Right Cmd (Safari)
			// we prepare for a copy or cut event
			this._map.focus();
			this._map._textInput.select();
			return true;
		case 80: // p
			this._map.print();
			return true;
		case 83: // s
			// Save only when not read-only.
			if (!this._map.isPermissionReadOnly()) {
				this._map.fire('postMessage', {msgId: 'UI_Save'});
				if (!this._map._disableDefaultAction['UI_Save']) {
					this._map.save(false /* An explicit save should terminate cell edit */,
					               false /* An explicit save should save it again */);
				}
			}
			return true;
		case 86: // v
		case 118: // v (Safari)
			return true;
		case 112: // f1
			app.socket.sendMessage('uno .uno:NoteVisible');
			return true;
		case 188: // ,
			app.socket.sendMessage('uno .uno:SubScript');
			return true;
		case 190: // .
			app.socket.sendMessage('uno .uno:SuperScript');
			return true;
		}
		if (e.type === 'keypress' && (e.ctrlKey || e.metaKey) &&
			(e.key === 'c' || e.key === 'v' || e.key === 'x')) {
			// need to handle this separately for Firefox
			return true;
		}
		return false;
	}
});
