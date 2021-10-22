/* -*- js-indent-level: 8 -*- */
/*
 * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
 *
 * It handles keyboard interactions which are NOT text input, including those which
 * don't require edit permissions (e.g. page scroll). Text input is handled
 * at TextInput.
 */

/* global app vex _ */

L.Map.mergeOptions({
	keyboard: true,
	keyboardPanOffset: 20,
	keyboardZoomOffset: 1
});

L.Map.Keyboard = L.Handler.extend({

	keyModifier: {
		shift: 4096,
		ctrl: 8192,
		alt: 16384,
		ctrlMac: 32768
	},

	// For UNO keycodes cf. offapi/com/sun/star/awt/Key.idl
	keymap: {
		8   : 1283, // backspace	: BACKSPACE
		9   : 1282, // tab 		: TAB
		13  : 1280, // enter 		: RETURN
		16  : null, // shift		: UNKOWN
		17  : null, // ctrl		: UNKOWN
		18  : null, // alt		: UNKOWN
		19  : null, // pause/break	: UNKOWN
		20  : null, // caps lock	: UNKOWN
		27  : 1281, // escape		: ESCAPE
		32  : 1284, // space		: SPACE
		33  : 1030, // page up		: PAGEUP
		34  : 1031, // page down	: PAGEDOWN
		35  : 1029, // end		: END
		36  : 1028, // home		: HOME
		37  : 1026, // left arrow	: LEFT
		38  : 1025, // up arrow		: UP
		39  : 1027, // right arrow	: RIGHT
		40  : 1024, // down arrow	: DOWN
		45  : 1285, // insert		: INSERT
		46  : 1286, // delete		: DELETE
		48  : 256,  // 0		: NUM0
		49  : 257,  // 1		: NUM1
		50  : 258,  // 2		: NUM2
		51  : 259,  // 3		: NUM3
		52  : 260,  // 4		: NUM4
		53  : 261,  // 5		: NUM5
		54  : 262,  // 6		: NUM6
		55  : 263,  // 7		: NUM7
		56  : 264,  // 8		: NUM8
		57  : 265,  // 9		: NUM9
		65  : 512,  // A		: A
		66  : 513,  // B		: B
		67  : 514,  // C		: C
		68  : 515,  // D		: D
		69  : 516,  // E		: E
		70  : 517,  // F		: F
		71  : 518,  // G		: G
		72  : 519,  // H		: H
		73  : 520,  // I		: I
		74  : 521,  // J		: J
		75  : 522,  // K		: K
		76  : 523,  // L		: L
		77  : 524,  // M		: M
		78  : 525,  // N		: N
		79  : 526,  // O		: O
		80  : 527,  // P		: P
		81  : 528,  // Q		: Q
		82  : 529,  // R		: R
		83  : 530,  // S		: S
		84  : 531,  // T		: T
		85  : 532,  // U		: U
		86  : 533,  // V		: V
		87  : 534,  // W		: W
		88  : 535,  // X		: X
		89  : 536,  // Y		: Y
		90  : 537,  // Z		: Z
		91  : null, // left window key	: UNKOWN
		92  : null, // right window key	: UNKOWN
		93  : null, // select key	: UNKOWN
		96  : 256,  // numpad 0		: NUM0
		97  : 257,  // numpad 1		: NUM1
		98  : 258,  // numpad 2		: NUM2
		99  : 259,  // numpad 3		: NUM3
		100 : 260,  // numpad 4		: NUM4
		101 : 261,  // numpad 5		: NUM5
		102 : 262,  // numpad 6		: NUM6
		103 : 263,  // numpad 7		: NUM7
		104 : 264,  // numpad 8		: NUM8
		105 : 265,  // numpad 9		: NUM9
		106 : 1289, // multiply		: MULTIPLY
		107 : 1287, // add		: ADD
		109 : 1288, // subtract		: SUBTRACT
		110 : 1309, // decimal point	: DECIMAL
		111 : 1290, // divide		: DIVIDE
		112 : 768,  // f1		: F1
		113 : 769,  // f2		: F2
		114 : 770,  // f3		: F3
		115 : 771,  // f4		: F4
		116 : 772,  // f5		: F5
		117 : 773,  // f6		: F6
		118 : 774,  // f7		: F7
		119 : 775,  // f8		: F8
		120 : 776,  // f9		: F9
		121 : 777,  // f10		: F10
		122 : 778,  // f11		: F11
		144 : 1313, // num lock		: NUMLOCK
		145 : 1314, // scroll lock	: SCROLLLOCK
		173 : 1288, // dash		: DASH (on Firefox)
		186 : 1317, // semi-colon	: SEMICOLON
		187 : 1295, // equal sign	: EQUAL
		188 : 1292, // comma		: COMMA
		189 : 1288, // dash		: DASH
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
		var shift = ev.shiftKey ? this.keyModifier.shift : 0;
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
		console.log('keyboard handler:', ev.type, ev.key, ev.charCode, this._expectingInput, ev);

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
	// a message to loolwsd, and calls the given keyEventFn(type, charcode, keycode)
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
		var shift = ev.shiftKey ? this.keyModifier.shift : 0;
		var ctrl = ev.ctrlKey ? this.keyModifier.ctrl : 0;
		var alt = ev.altKey ? this.keyModifier.alt : 0;
		var cmd = ev.metaKey ? this.keyModifier.ctrl : 0;
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

		if ((this.modifier == this.keyModifier.alt || this.modifier == this.keyModifier.shift + this.keyModifier.alt) &&
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
				// console.log(e);
				if (this.handleOnKeyDownKeys[keyCode] && charCode === 0) {
					keyEventFn('input', charCode, unoKeyCode);
					ev.preventDefault();
				}
			}
			else if ((ev.type === 'keypress') && (!this.handleOnKeyDownKeys[keyCode] || charCode !== 0)) {
				if (keyCode === 8 || keyCode === 46 || keyCode === 13)
				{
					// handled generically in TextInput.js
					console.log('Ignore backspace/delete/enter keypress');
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
				    unoKeyCode === 1280) {
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
			}
			return;
		}
		else if (!this.modifier && (keyCode === 35 || keyCode === 36) && ev.type === 'keydown') {
			if (this._map._docLayer._docType === 'drawing' && app.file.fileBasedView === true) {
				var partToSelect = keyCode === 36 ? 0 : this._map._docLayer._parts -1;
				//this._map._selectedPart = partToSelect;
				this._map._docLayer._preview._scrollViewToPartPosition(partToSelect);
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
	// triggers the appropriate action or loolwsd message.
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
			msg = L.Util.replaceCtrlInMac(msg);
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
