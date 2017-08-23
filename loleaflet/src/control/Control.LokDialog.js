/*
 * L.Control.LokDialog used for displaying LOK dialogs
 */

/* global vex $ */
L.Control.LokDialog = L.Control.extend({
	onAdd: function (map) {
		map.on('dialogpaint', this._onDialogPaint, this);
		map.on('dialog', this._onDialogMsg, this);
	},

	_dialogs: {},

	_isOpen: function(dialogId) {
		return this._dialogs[dialogId];
	},

	_onDialogMsg: function(e) {
		if (e.action === 'invalidate') {
			// FIXME: core sends a different id for spelling dialog in 'invalidate' cb
			if (e.dialogId === 'SpellingDialog')
				e.dialogId = 'SpellingAndGrammarDialog';

			// ignore any invalidate callbacks when we have closed the dialog
			if (this._isOpen(e.dialogId))
				this._map.sendDialogCommand(e.dialogId);
		}
	},

	_openDialog: function(dialogId, width, height) {
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

		this._dialogs[dialogId] = true;
	},

	_onDialogClose: function(dialogId) {
		$('#' + dialogId).remove();
		this._dialogs[dialogId] = false;
	},

	_paintDialog: function(dialogId, img) {
		if (!this._isOpen(dialogId))
			return;

		$('#' + dialogId + ' > .lokdialog_content').attr('src', img);
	},

	_onDialogPaint: function (e) {
		var dialogId = e.id.replace('.uno:', '');
		if (!this._isOpen(dialogId)) {
			this._openDialog(dialogId, e.width, e.height);
		}

		this._paintDialog(dialogId, e.dialog);
	}
});

L.control.lokDialog = function (options) {
	return new L.Control.LokDialog(options);
};
