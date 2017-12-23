/*
 * L.Control.LokDialog used for displaying LOK dialogs
 */

/* global $ map */
L.Control.LokDialog = L.Control.extend({

	dialogIdPrefix: 'lokdialog-',

	onAdd: function (map) {
		map.on('window', this._onDialogMsg, this);
		map.on('windowpaint', this._onDialogPaint, this);
		map.on('opendialog', this._openDialog, this);
		map.on('docloaded', this._docLoaded, this);
	},

	_dialogs: {},

	_docLoaded: function(e) {
		if (!e.status) {
			$('.lokdialog_container').remove();
			$('.lokdialogchild-canvas').remove();
		}
	},

	_getParentDialog: function(id) {
		id = parseInt(id);
		for (var winId in this._dialogs) {
			if (this._dialogs[winId].childid && this._dialogs[winId].childid === id) {
				return winId;
			}
		}
		return null;
	},

	_isOpen: function(dialogId) {
		return this._dialogs[dialogId] &&
			this._dialogs[dialogId].open &&
			$('#' + this._toDlgPrefix(dialogId)).length > 0;
	},

	// given a prefixed dialog id like 'lokdialog-323', gives a raw id, 323
	_toRawDlgId: function(dialogId) {
		if (typeof(dialogId) === 'string')
			return parseInt(dialogId.replace(this.dialogIdPrefix, ''));
		return dialogId;
	},

	// converts a raw dialog id like 432, to 'lokdialog-432'
	_toDlgPrefix: function(id) {
		return this.dialogIdPrefix + id;
	},

	// Create a rectangle string of form "x,y,width,height"
	// if params are missing, assumes 0,0,dialog width, dialog height
	_createRectStr: function(id, x, y, width, height) {
		if (!width)
			width = this._dialogs[parseInt(id)].width;
		if (!height)
			height = this._dialogs[parseInt(id)].height;
		if (!x)
			x = 0;
		if (!y)
			y = 0;

		return [x, y, width, height].join(',');
	},

	_sendPaintWindow: function(id, rectangle) {
		if (rectangle)
			rectangle = rectangle.replace(/ /g, '');

		this._map._socket.sendMessage('paintwindow ' + id + (rectangle ? ' rectangle=' + rectangle : ''));
	},

	_sendCloseWindow: function(id) {
		this._map._socket.sendMessage('windowcommand ' + id + ' close');
	},

	_isRectangleValid: function(rect) {
		rect = rect.split(',');
		if (parseInt(rect[0]) < 0 || parseInt(rect[1]) < 0 || parseInt(rect[2]) < 0 || parseInt(rect[3]) < 0)
			return false;
		return true;
	},

	_onDialogMsg: function(e) {
		e.id = parseInt(e.id);
		var strDlgId = this._toDlgPrefix(e.id);

		if (e.action === 'created') {
			var width = parseInt(e.size.split(',')[0]);
			var height = parseInt(e.size.split(',')[1]);
			if (e.winType === 'dialog') {
				this._launchDialog(this._toDlgPrefix(e.id), width, height, e.title);
				this._sendPaintWindow(e.id, this._createRectStr(e.id));
			} else if (e.winType === 'child') {
				if (!this._isOpen(e.parentId))
					return;

				var parentId = parseInt(e.parentId);
				var left = parseInt(e.position.split(',')[0]);
				var top = parseInt(e.position.split(',')[1]);

				this._removeDialogChild(parentId);
				this._dialogs[parentId].childid = e.id;
				this._dialogs[parentId].childwidth = width;
				this._dialogs[parentId].childheight = height;
				this._dialogs[parentId].childx = left;
				this._dialogs[parentId].childy = top;
				this._createDialogChild(e.id, parentId, top, left);
				this._sendPaintWindow(e.id, this._createRectStr(null, 0, 0, width, height));
			}
		} else if (e.action === 'invalidate') {
			var parent = this._getParentDialog(e.id);
			var rectangle = e.rectangle;
			if (parent) { // this is a floating window
				rectangle = '0,0,' + this._dialogs[parent].childwidth + ',' + this._dialogs[parent].childheight;
			} else { // this is the actual dialog
				if (rectangle && !this._isRectangleValid(rectangle))
					return;

				if (!rectangle)
					rectangle = '0,0,' + this._dialogs[e.id].width + ',' + this._dialogs[e.id].height;
			}
			this._sendPaintWindow(e.id, rectangle);
		} else if (e.action === 'size_changed') {
			width = parseInt(e.size.split(',')[0]);
			height = parseInt(e.size.split(',')[1]);
			// FIXME: we don't really have to destroy and launch the dialog again but do it for
			// now because the size sent to us previously in 'created' cb is not correct
			$('#' + strDlgId).remove();
			this._launchDialog(strDlgId, width, height, this._dialogs[parseInt(e.id)].title);
			this._sendPaintWindow(e.id, this._createRectStr(e.id));
		} else if (e.action === 'cursor_invalidate') {
			if (this._isOpen(e.id) && !!e.rectangle) {
				rectangle = e.rectangle.split(',');
				var x = parseInt(rectangle[0]);
				var y = parseInt(rectangle[1]);
				height = parseInt(rectangle[3]);

				var dialogCursor = L.DomUtil.get(strDlgId + '-cursor');
				L.DomUtil.setStyle(dialogCursor, 'height', height + 'px');
				L.DomUtil.setStyle(dialogCursor, 'display', this._dialogs[e.id].cursorVisible ? 'block' : 'none');
				// set the position of the cursor container element
				L.DomUtil.setStyle(this._dialogs[e.id].cursor, 'left', x + 'px');
				L.DomUtil.setStyle(this._dialogs[e.id].cursor, 'top', y + 'px');
			}
		} else if (e.action === 'title_changed') {
			if (e.title && this._dialogs[parseInt(e.id)]) {
				this._dialogs[parseInt(e.id)].title = e.title;
				$('#' + strDlgId).dialog('option', 'title', e.title);
			}
		} else if (e.action === 'cursor_visible') {
			this._dialogs[e.id].cursorVisible = e.visible === 'true';
			if (this._dialogs[e.id].cursorVisible)
				$('#' + strDlgId + '-cursor').css({display: 'block'});
			else
				$('#' + strDlgId + '-cursor').css({display: 'none'});
		} else if (e.action === 'close') {
			parent = this._getParentDialog(e.id);
			if (parent)
				this._onDialogChildClose(this._toDlgPrefix(parent));
			else
				this._onDialogClose(e.id, false);
		}
	},

	_openDialog: function(e) {
		this._map.sendUnoCommand(e.uno);
	},

	_launchDialogCursor: function(dialogId) {
		var id = this._toRawDlgId(dialogId);
		this._dialogs[id].cursor = L.DomUtil.create('div', 'leaflet-cursor-container', L.DomUtil.get(dialogId));
		var cursor = L.DomUtil.create('div', 'leaflet-cursor lokdialog-cursor', this._dialogs[id].cursor);
		cursor.id = dialogId + '-cursor';
		L.DomUtil.addClass(cursor, 'blinking-cursor');
	},

	_launchDialog: function(strDlgId, width, height, title) {
		var dialogContainer = L.DomUtil.create('div', 'lokdialog', document.body);
		L.DomUtil.setStyle(dialogContainer, 'padding', '0px');
		L.DomUtil.setStyle(dialogContainer, 'margin', '0px');
		L.DomUtil.setStyle(dialogContainer, 'overflow', 'hidden');
		dialogContainer.id = strDlgId;

		var dialogCanvas = L.DomUtil.create('canvas', 'lokdialog_canvas', dialogContainer);
		dialogCanvas.width = width;
		dialogCanvas.height = height;
		dialogCanvas.tabIndex = '0';
		dialogCanvas.contentEditable = true;
		dialogCanvas.id = strDlgId + '-canvas';

		var that = this;
		$(dialogContainer).dialog({
			width: width,
			title: title ? title : '',
			modal: false,
			closeOnEscape: true,
			resizable: false,
			dialogClass: 'lokdialog_container',
			close: function() {
				that._onDialogClose(that._toRawDlgId(strDlgId), true);
			}
		});

		this._dialogs[this._toRawDlgId(strDlgId)] = {
			open: true,
			width: width,
			height: height,
			title: title
		};

		// don't make 'TAB' focus on this button; we want to cycle focus in the lok dialog with each TAB
		$('.lokdialog_container button.ui-dialog-titlebar-close').attr('tabindex', '-1').blur();

		L.DomEvent.on(dialogCanvas, 'mousedown mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var lokEventType = e.type.replace('mouse', 'button');
			this._postWindowMouseEvent(lokEventType, this._toRawDlgId(strDlgId), e.offsetX, e.offsetY, 1, buttons, 0);
		}, this);
		L.DomEvent.on(dialogCanvas, 'keyup keypress keydown', function(e) {
			// _onKeyDown fn below requires this kind of structure but leaflet DomEvent.on doesn't pass it
			e.originalEvent = e;
			map['keyboard']._onKeyDown(e, L.bind(this._postWindowKeyboardEvent, this, this._toRawDlgId(strDlgId)));
		}, this);
		L.DomEvent.on(dialogCanvas, 'contextmenu', function() {
			return false;
		});

		this._launchDialogCursor(strDlgId);
	},

	_postWindowMouseEvent: function(type, winid, x, y, count, buttons, modifier) {
		this._map._socket.sendMessage('windowmouse id=' + winid +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' count=' + count +
		                              ' buttons=' + buttons + ' modifier=' + modifier);
	},

	_postWindowKeyboardEvent: function(winid, type, charcode, keycode) {
		this._map._socket.sendMessage('windowkey id=' + winid + ' type=' + type +
		                              ' char=' + charcode + ' key=' + keycode);
	},

	_onDialogClose: function(dialogId, notifyBackend) {
		if (notifyBackend)
			this._sendCloseWindow(dialogId);
		$('#' + this._toDlgPrefix(dialogId)).remove();
		this._map.focus();
		delete this._dialogs[dialogId];
	},

	_paintDialog: function(dialogId, rectangle, imgData) {
		if (!this._isOpen(dialogId))
			return;

		var strDlgId = this._toDlgPrefix(dialogId);
		var img = new Image();
		var canvas = document.getElementById(strDlgId + '-canvas');
		var ctx = canvas.getContext('2d');
		img.onload = function() {
			var x = 0;
			var y = 0;
			if (rectangle) {
				rectangle = rectangle.split(',');
				x = parseInt(rectangle[0]);
				y = parseInt(rectangle[1]);
			}

			ctx.drawImage(img, x, y);
		};
		img.src = imgData;
	},

	// Binary dialog msg recvd from core
	_onDialogPaint: function (e) {
		var parent = this._getParentDialog(e.id);
		if (parent) {
			this._paintDialogChild(parent, e.width, e.height, e.rectangle, e.img);
		} else {
			this._paintDialog(e.id, e.rectangle, e.img);
		}
	},

	// Dialog Child Methods

	_paintDialogChild: function(dialogId, width, height, rectangle, imgData) {
		var strDlgId = this._toDlgPrefix(dialogId);
		var img = new Image();
		var canvas = document.getElementById(strDlgId + '-floating');
		canvas.width = width;
		canvas.height = height;
		var ctx = canvas.getContext('2d');
		img.onload = function() {
			ctx.drawImage(img, 0, 0);
		};
		img.src = imgData;

		// increase the height of the container,
		// so that if the floating window goes out of the parent,
		// it doesn't get stripped off
		height = parseInt(canvas.style.top) + canvas.height;
		var currentHeight = parseInt($('#' + strDlgId).css('height'));
		if (height > currentHeight)
			$('#' + strDlgId).css('height', height + 'px');
	},

	_onDialogChildClose: function(dialogId) {
		$('#' + dialogId + '-floating').remove();
		// remove any extra height allocated for the parent container
		var canvasHeight = document.getElementById(dialogId + '-canvas').height;
		$('#' + dialogId).height(canvasHeight + 'px');
	},

	_removeDialogChild: function(id) {
		if (typeof id === 'number')
			id = this._toDlgPrefix(id);
		$('#' + id + '-floating').remove();
	},

	_createDialogChild: function(childId, dialogId, top, left) {
		var strDlgId = this._toDlgPrefix(dialogId);
		var dialogContainer = L.DomUtil.get(strDlgId);
		var floatingCanvas = L.DomUtil.create('canvas', 'lokdialogchild-canvas', dialogContainer);
		floatingCanvas.id = strDlgId + '-floating';
		L.DomUtil.setStyle(floatingCanvas, 'position', 'absolute');
		L.DomUtil.setStyle(floatingCanvas, 'left', left + 'px'); // yes, it's necessary to append 'px'
		L.DomUtil.setStyle(floatingCanvas, 'top', top + 'px');

		// attach events
		L.DomEvent.on(floatingCanvas, 'mousedown mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === map['mouse'].JSButtons.left ? map['mouse'].LOButtons.left : 0;
			buttons |= e.button === map['mouse'].JSButtons.middle ? map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === map['mouse'].JSButtons.right ? map['mouse'].LOButtons.right : 0;
			var lokEventType = e.type.replace('mouse', 'button');
			this._postWindowMouseEvent(lokEventType, childId, e.offsetX, e.offsetY, 1, buttons, 0);
		}, this);
		L.DomEvent.on(floatingCanvas, 'mousemove', function(e) {
			this._postWindowMouseEvent('move', childId, e.offsetX, e.offsetY, 1, 0, 0);
		}, this);
		L.DomEvent.on(floatingCanvas, 'contextmenu', function() {
			return false;
		});
	}
});

L.control.lokDialog = function (options) {
	return new L.Control.LokDialog(options);
};
