/*
 * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
 */

L.Map.mergeOptions({
	keyboard: true,
});

L.Map.Keyboard = L.Handler.extend({

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
		186 : 1317, // semi-colon	: SEMICOLON
		187 : 1295, // equal sign	: EQUAL
		188 : 1292, // comma		: COMMA
		189 : 5,    // dash		: DASH
		190 : null, // period		: UNKOWN
		191 : null, // forward slash	: UNKOWN
		192 : null, // grave accent	: UNKOWN
		219 : null, // open bracket	: UNKOWN
		220 : null, // back slash	: UNKOWN
		221 : null, // close bracket	: UNKOWN
		222 : null  // single quote	: UNKOWN
	},

	handleOnKeyDown: {
		// these keys need to be handled on keydown in order for them
		// to work on chrome
		8   : true, // backspace
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
		46  : true // delete
	},

	initialize: function (map) {
		this._map = map;
	},

	addHooks: function () {
		var container = this._map._container;

		// make the container focusable by tabbing
		if (container.tabIndex === -1) {
			container.tabIndex = '0';
		}

		this._map.on('mousedown', this._onMouseDown, this);
		this._map.on('keydown keyup keypress', this._onKeyDown, this);
	},

	_onMouseDown: function () {
		if (this._map._docLayer._permission === 'edit') {
			return;
		}
		this._map._container.focus();
	},

	// Convert javascript key codes to UNO key codes.
	_toUNOKeyCode: function (keyCode) {
		return this.keymap[keyCode] || keyCode;
	},

	_onKeyDown: function (e) {
		var docLayer = this._map._docLayer;
		if (e.originalEvent.ctrlKey) {
			// we prepare for a copy event
			docLayer._textArea.value = 'dummy text';
			docLayer._textArea.focus();
			docLayer._textArea.select();
			return;
		}

		if (docLayer._permission !== 'edit') {
			return;
		}

		var charCode = e.originalEvent.charCode;
		var keyCode = e.originalEvent.keyCode;
		if (e.type === 'keydown' && this.handleOnKeyDown[keyCode] && charCode === 0) {
			docLayer._postKeyboardEvent('input', charCode, this._toUNOKeyCode(keyCode));
		}
		else if (e.type === 'keypress' &&
				(!this.handleOnKeyDown[keyCode] || charCode !== 0)) {
			if (charCode === keyCode && charCode !== 13) {
				// Chrome sets keyCode = charCode for printable keys
				// while LO requires it to be 0
				keyCode = 0;
			}
			docLayer._postKeyboardEvent('input', charCode, this._toUNOKeyCode(keyCode));
		}
		else if (e.type === 'keyup') {
			docLayer._postKeyboardEvent('up', charCode, this._toUNOKeyCode(keyCode));
		}
		if (keyCode === 9) {
			// tab would change focus to other DOM elements
			e.originalEvent.preventDefault();
		}
		L.DomEvent.stopPropagation(e.originalEvent);
	}
});

L.Map.addInitHook('addHandler', 'keyboard', L.Map.Keyboard);
