/*
 * L.Control.LokDialog used for displaying LOK dialogs
 */

/* global vex $ map */
L.Control.LokDialog = L.Control.extend({
	onAdd: function (map) {
		map.on('dialogpaint', this._onDialogPaint, this);
		map.on('dialogchildpaint', this._onDialogChildPaint, this);
		map.on('dialogchild', this._onDialogChildMsg, this);
		map.on('dialog', this._onDialogMsg, this);
		map.on('opendialog', this._openDialog, this);
	},

	_dialogs: {},

	_isOpen: function(dialogId) {
		return this._dialogs[dialogId];
	},

	_transformDialogId: function(dialogId) {
		var ret = dialogId;
		if (dialogId === 'SpellingDialog')
			ret = 'SpellingAndGrammarDialog';
		else if (dialogId === 'FindReplaceDialog')
			ret = 'SearchDialog';
		else if (dialogId === 'AcceptRejectChangesDialog')
			ret = 'AcceptTrackedChanges';
		else if (dialogId === 'FieldDialog')
			ret = 'InsertField';
		else if (dialogId === 'BibliographyEntryDialog')
			ret = 'InsertAuthoritiesEntry';
		else if (dialogId === 'IndexEntryDialog')
			ret = 'InsertIndexesEntry';

		return ret;
	},

	_onDialogMsg: function(e) {
		// FIXME: core sends a different id for spelling dialog in cbs
		e.dialogId = this._transformDialogId(e.dialogId);
		if (e.action === 'invalidate') {
			// ignore any invalidate callbacks when we have closed the dialog
			if (this._isOpen(e.dialogId)) {
				this._map.sendDialogCommand(e.dialogId);
			}
		} else if (e.action === 'close') {
			this._onDialogClose(e.dialogId);
		}
	},

	_openDialog: function(e) {
		e.dialogId = e.dialogId.replace('.uno:', '');
		this._dialogs[e.dialogId] = true;

		this._map.sendDialogCommand(e.dialogId);
	},

	_launchDialog: function(dialogId, width, height) {
		var canvas = '<div style="padding: 0px; margin: 0px; overflow: hidden;" id="' + dialogId + '">' +
		    '<canvas tabindex="0" id="' + dialogId + '-canvas" width="' + width + 'px" height="' + height + 'px"></canvas>' +
		    '</div>';
		$(document.body).append(canvas);
		var that = this;
		$('#' + dialogId).dialog({
			width: width,
			height: 'auto',
			title: 'LOK Dialog', // TODO: Get the 'real' dialog title from the backend
			modal: false,
			closeOnEscape: true,
			resizable: false,
			close: function() {
				that._onDialogClose(dialogId);
			}
		});

		// attach the mouse/key events
		$('#' + dialogId + '-canvas').on('mousedown', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogMouseEvent('buttondown', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + '-canvas').on('mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogMouseEvent('buttonup', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + '-canvas').on('keyup keypress keydown', function(e) {
			e.dialogId = dialogId;
			that._handleDialogKeyEvent(e);
		});

		$('#' + dialogId + '-canvas').on('mousemove', function(e) {
			//that._postDialogMouseEvent('move', dialogId, e.offsetX, e.offsetY, 1, 0, 0);
		});

		this._dialogs[dialogId] = true;
	},

	_postDialogMouseEvent: function(type, dialogid, x, y, count, buttons, modifier) {
		if (!dialogid.startsWith('.uno:'))
			dialogid = '.uno:' + dialogid;

		this._map._socket.sendMessage('dialogmouse dialogid=' + dialogid +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' count=' + count +
		                              ' buttons=' + buttons + ' modifier=' + modifier);
	},

	_postDialogKeyboardEvent: function(type, dialogid, charcode, keycode) {
		console.trace('sending: ' + type);
		this._map._socket.sendMessage('dialogkey dialogid=' + dialogid + ' type=' + type +
		                              ' char=' + charcode + ' key=' + keycode);
	},

	_postDialogChildMouseEvent: function(type, dialogid, x, y, count, buttons, modifier) {
		if (!dialogid.startsWith('.uno:'))
			dialogid = '.uno:' + dialogid;

		this._map._socket.sendMessage('dialogchildmouse dialogid=' + dialogid +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' count=' + count +
		                              ' buttons=' + buttons + ' modifier=' + modifier);
	},

	_handleDialogKeyEvent: function(e) {
		console.log('handle dialog key event ' + e.type);
		var docLayer = this._map._docLayer;
		this.modifier = 0;
		var shift = e.originalEvent.shiftKey ? this._map['keyboard'].keyModifier.shift : 0;
		var ctrl = e.originalEvent.ctrlKey ? this._map['keyboard'].keyModifier.ctrl : 0;
		var alt = e.originalEvent.altKey ? this._map['keyboard'].keyModifier.alt : 0;
		var cmd = e.originalEvent.metaKey ? this._map['keyboard'].keyModifier.ctrl : 0;
		var location = e.originalEvent.location;
		this.modifier = shift | ctrl | alt | cmd;

		var charCode = e.originalEvent.charCode;
		var keyCode = e.originalEvent.keyCode;
		var unoKeyCode = this._map['keyboard']._toUNOKeyCode(keyCode);

		if (this.modifier) {
			unoKeyCode |= this.modifier;
			if (e.type !== 'keyup') {
				this._postDialogKeyboardEvent('input', e.dialogId, charCode, unoKeyCode);
				return;
			}
		}

		if (e.type === 'keydown' && this._map['keyboard'].handleOnKeyDownKeys[keyCode]) {
			this._postDialogKeyboardEvent('input', e.dialogId, charCode, unoKeyCode);
		}
		else if (e.type === 'keypress' && (!this._map['keyboard'].handleOnKeyDownKeys[keyCode] || charCode !== 0)) {
			if (charCode === keyCode && charCode !== 13) {
				keyCode = 0;
				unoKeyCode = this._map['keyboard']._toUNOKeyCode(keyCode);
			}
			this._postDialogKeyboardEvent('input', e.dialogId, charCode, unoKeyCode);
		}
		else if (e.type === 'keyup') {
			this._postDialogKeyboardEvent('up', e.dialogId, charCode, unoKeyCode);
		}
	},

	_onDialogClose: function(dialogId) {
		$('#' + dialogId).remove();
		delete this._dialogs[dialogId];
	},

	_paintDialog: function(dialogId, imgData) {
		if (!this._isOpen(dialogId))
			return;

		var img = new Image();
		var canvas = document.getElementById(dialogId + '-canvas');
		var ctx = canvas.getContext('2d');
		img.onload = function() {
			ctx.drawImage(img, 0, 0);
		};
		img.src = imgData;
	},

	_isSameSize: function(dialogId, newWidth, newHeight) {
		var ret = false;
		if (this._isOpen(dialogId))
		{
			var oldWidth = $('#' + dialogId + '-canvas').width();
			var oldHeight = $('#' + dialogId + '-canvas').height();
			if (oldWidth === newWidth && oldHeight === newHeight)
				ret = true;
		}

		return ret;
	},

	// Binary dialog msg recvd from core
	_onDialogPaint: function (e) {
		var dialogId = e.id.replace('.uno:', '');
		// is our request to open dialog still valid?
		if (!this._dialogs[dialogId])
			return;

		if (!this._isOpen(dialogId)) {
			this._launchDialog(dialogId, e.width, e.height);
		} else if (!this._isSameSize(dialogId, e.width, e.height)) {
			// size changed - destroy the old sized dialog
			this._onDialogClose(dialogId);
			this._launchDialog(dialogId, e.width, e.height);
		}

		this._paintDialog(dialogId, e.dialog);
	},

	_onDialogChildPaint: function(e) {
		var dialogId = e.id.replace('.uno:', '');
		var img = new Image();
		var canvas = document.getElementById(dialogId + '-floating');
		canvas.width = e.width;
		canvas.height = e.height;
		var ctx = canvas.getContext('2d');
		img.onload = function() {
			ctx.drawImage(img, 0, 0);
		};
		img.src = e.dialog;
	},

	_onDialogChildClose: function(dialogId) {
		$('#' + dialogId + '-floating').remove();
	},

	_isDialogChildUnchanged: function(dialogId, left, top) {
		// get pervious dialog child's specs
		var oldLeft = $('#' + dialogId + '-floating').css('left');
		var oldTop = $('#' + dialogId + '-floating').css('top');
		if (!oldLeft || !oldTop) {
			// no left or top position set earlier; this is first dialog child placement
			return false;
		}

		oldLeft = parseInt(oldLeft);
		oldTop = parseInt(oldTop);
		if (oldLeft !== left || oldTop !== top) {
			// something changed in new dialog child
			return false;
		}

		return true;
	},

	_launchDialogChild: function(e) {
		var positions = e.position.split(',');
		var left = parseInt(positions[0]);
		var top = parseInt(positions[1]);
		// ignore spurious "0, 0" dialog child position recvd from backend
		if (e.position === '0, 0' || this._isDialogChildUnchanged(e.dialogId, left, top)) {
			// ignore
			return;
		}

		// remove any existing floating element if there's any
		$('#' + e.dialogId + '-floating').remove();
		var floatingCanvas = '<canvas id="' + e.dialogId + '-floating"></canvas>';
		$('#' + e.dialogId).append(floatingCanvas);
		$('#' + e.dialogId + '-floating').css({position: 'absolute', left: left, top: top});

		var that = this;
		var dialogId = e.dialogId;
		// attach events
		$('#' + dialogId + '-floating').on('mousedown', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogChildMouseEvent('buttondown', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + '-floating').on('mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogChildMouseEvent('buttonup', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + '-floating').on('mousemove', function(e) {
			that._postDialogChildMouseEvent('move', dialogId, e.offsetX, e.offsetY, 1, 0, 0);
		});

	},

	_onDialogChildMsg: function(e) {
		e.dialogId = this._transformDialogId(e.dialogId);
		if (e.action === 'invalidate') {
			if (this._isOpen(e.dialogId))
			{
				this._map.sendDialogCommand(e.dialogId, false /* no json */, true /* dialog child*/);
				this._launchDialogChild(e);
			}
		} else if (e.action === 'close') {
			this._onDialogChildClose(e.dialogId);
		}
	}
});

L.control.lokDialog = function (options) {
	return new L.Control.LokDialog(options);
};
