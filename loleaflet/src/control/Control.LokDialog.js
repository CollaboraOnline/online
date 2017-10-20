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
		var content = '<div class="lokdialog_container" id="' + dialogId + '">' +
		    '<img class="lokdialog_content" width="' + width + '" height="' + height + '"></div>';
		$(document.body).append(content);
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
		$('#' + dialogId + ' > .lokdialog_content').on('mousedown', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogMouseEvent('buttondown', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + ' > .lokdialog_content').on('mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogMouseEvent('buttonup', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + ' > .lokdialog_content').on('mousemove', function(e) {
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

	_postDialogChildMouseEvent: function(type, dialogid, x, y, count, buttons, modifier) {
		if (!dialogid.startsWith('.uno:'))
			dialogid = '.uno:' + dialogid;

		this._map._socket.sendMessage('dialogchildmouse dialogid=' + dialogid +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' count=' + count +
		                              ' buttons=' + buttons + ' modifier=' + modifier);
	},

	_onDialogClose: function(dialogId) {
		$('#' + dialogId).remove();
		delete this._dialogs[dialogId];
	},

	_paintDialog: function(dialogId, img) {
		if (!this._isOpen(dialogId))
			return;

		$('#' + dialogId + ' > .lokdialog_content').attr('src', img);
	},

	_isSameSize: function(dialogId, newWidth, newHeight) {
		var ret = false;
		if (this._isOpen(dialogId))
		{
			var oldWidth = $('#' + dialogId + ' > .lokdialog_content').width();
			var oldHeight = $('#' + dialogId + ' > .lokdialog_content').height();
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
		$('#' + dialogId + ' .lokdialog_floating_content').attr('src', e.dialog);

		var that = this;
		// attach events
		$('#' + dialogId + ' .lokdialog_floating_content').on('mousedown', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogChildMouseEvent('buttondown', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + ' .lokdialog_floating_content').on('mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var modifier = 0;
			that._postDialogChildMouseEvent('buttonup', dialogId, e.offsetX, e.offsetY, 1, buttons, modifier);
		});

		$('#' + dialogId + ' .lokdialog_floating_content').on('mousemove', function(e) {
			that._postDialogChildMouseEvent('move', dialogId, e.offsetX, e.offsetY, 1, 0, 0);
		});
	},

	_onDialogChildClose: function(dialogId) {
		$('#' + dialogId + ' .lokdialog_floating').remove();
	},

	_launchDialogChild: function(e) {
		if (e.position === '0, 0') {
			// ignore
			return;
		}

		var floatingContentDiv = '<div class="lokdialog_floating"><img class="lokdialog_floating_content"></div>';
		$('#' + e.dialogId).append(floatingContentDiv);
		var positions = e.position.split(',');
		var left = parseInt(positions[0]);
		var top = parseInt(positions[1]);
		$('#' + e.dialogId + ' > .lokdialog_floating').css({position: 'absolute', left: left, top: top});
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
