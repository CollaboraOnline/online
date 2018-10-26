/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.LokDialog used for displaying LOK dialogs
 */

/* global $ L */
L.Control.LokDialog = L.Control.extend({

	dialogIdPrefix: 'lokdialog-',

	onAdd: function (map) {
		map.on('window', this._onDialogMsg, this);
		map.on('windowpaint', this._onDialogPaint, this);
		map.on('opendialog', this._openDialog, this);
		map.on('docloaded', this._docLoaded, this);
		map.on('closepopup', this.onCloseCurrentPopUp, this);
		L.DomEvent.on(document, 'mouseup', this.onCloseCurrentPopUp, this);
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

		// pre-multiplied by the scale factor
		var dpiscale = L.getDpiScaleFactor();
		return [x * dpiscale, y * dpiscale, width * dpiscale, height * dpiscale].join(',');
	},

	_sendPaintWindow: function(id, rectangle) {
		if (rectangle)
			rectangle = rectangle.replace(/ /g, '');

		var dpiscale = L.getDpiScaleFactor();
		console.log('_sendPaintWindow: rectangle: ' + rectangle + ', dpiscale: ' + dpiscale);
		this._map._socket.sendMessage('paintwindow ' + id + (rectangle ? ' rectangle=' + rectangle + ' dpiscale=' + dpiscale : ''));
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
		var left, top;
		var strDlgId = this._toDlgPrefix(e.id);

		if (e.action === 'created') {
			var width = parseInt(e.size.split(',')[0]);
			var height = parseInt(e.size.split(',')[1]);

			if (e.winType === 'dialog') {
				left = (e.position != null)? parseInt(e.position.split(',')[0]): null;
				top = (e.position != null)? parseInt(e.position.split(',')[1]): null;

				this._launchDialog(this._toDlgPrefix(e.id), left, top, width, height, e.title);
				this._sendPaintWindow(e.id, this._createRectStr(e.id));
			} else if (e.winType === 'child') {
				if (!this._isOpen(e.parentId))
					return;

				var parentId = parseInt(e.parentId);
				left = parseInt(e.position.split(',')[0]);
				top = parseInt(e.position.split(',')[1]);

				this._removeDialogChild(parentId);
				this._dialogs[parentId].childid = e.id;
				this._dialogs[parentId].childwidth = width;
				this._dialogs[parentId].childheight = height;
				this._dialogs[parentId].childx = left;
				this._dialogs[parentId].childy = top;
				this._createDialogChild(e.id, parentId, top, left);
				this._sendPaintWindow(e.id, this._createRectStr(null, 0, 0, width, height));
			}
		}

		// all other callbacks doens't make sense without an active dialog
		if (!(this._isOpen(e.id) || this._getParentDialog(e.id)))
			return;

		if (e.action === 'invalidate') {
			var parent = this._getParentDialog(e.id);
			var rectangle = e.rectangle;
			if (parent) { // this is a floating window
				rectangle = this._createRectStr(null, 0, 0, this._dialogs[parent].childwidth, this._dialogs[parent].childheight);
			} else if (rectangle) { // this is the actual dialog
				if (this._isRectangleValid(rectangle)) {
					rectangle = e.rectangle.split(',');
					x = parseInt(rectangle[0]);
					y = parseInt(rectangle[1]);
					width = parseInt(rectangle[2]);
					height = parseInt(rectangle[3]);

					rectangle = this._createRectStr(null, x, y, width, height);
				} else {
					return;
				}
			} else {
				rectangle = this._createRectStr(e.id);
			}
			this._sendPaintWindow(e.id, rectangle);
		} else if (e.action === 'size_changed') {
			width = parseInt(e.size.split(',')[0]);
			height = parseInt(e.size.split(',')[1]);
			// FIXME: we don't really have to destroy and launch the dialog again but do it for
			// now because the size sent to us previously in 'created' cb is not correct
			$('#' + strDlgId).remove();
			this._launchDialog(strDlgId, null, null, width, height, this._dialogs[parseInt(e.id)].title);
			this._sendPaintWindow(e.id, this._createRectStr(e.id));
		} else if (e.action === 'cursor_invalidate') {
			if (this._isOpen(e.id) && !!e.rectangle) {
				rectangle = e.rectangle.split(',');
				var x = parseInt(rectangle[0]);
				var y = parseInt(rectangle[1]);
				height = parseInt(rectangle[3]);

				this._updateDialogCursor(e.id, x, y, height);
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

	_updateDialogCursor: function(dlgId, x, y, height) {
		var strDlgId = this._toDlgPrefix(dlgId);
		var dialogCursor = L.DomUtil.get(strDlgId + '-cursor');
		L.DomUtil.setStyle(dialogCursor, 'height', height + 'px');
		L.DomUtil.setStyle(dialogCursor, 'display', this._dialogs[dlgId].cursorVisible ? 'block' : 'none');
		// set the position of the cursor container element
		L.DomUtil.setStyle(this._dialogs[dlgId].cursor, 'left', x + 'px');
		L.DomUtil.setStyle(this._dialogs[dlgId].cursor, 'top', y + 'px');

		// update the input as well
		this._updateDialogInput(dlgId);
	},

	_createDialogCursor: function(dialogId) {
		var id = this._toRawDlgId(dialogId);
		this._dialogs[id].cursor = L.DomUtil.create('div', 'leaflet-cursor-container', L.DomUtil.get(dialogId));
		var cursor = L.DomUtil.create('div', 'leaflet-cursor lokdialog-cursor', this._dialogs[id].cursor);
		cursor.id = dialogId + '-cursor';
		L.DomUtil.addClass(cursor, 'blinking-cursor');
	},

	_createDialogInput: function(dialogId) {
		var id = this._toRawDlgId(dialogId);
		var clipDlgContainer = L.DomUtil.create('div', 'clipboard-container', L.DomUtil.get(dialogId));
		clipDlgContainer.id = dialogId + '-clipboard-container';
		var dlgTextArea = L.DomUtil.create('input', 'clipboard', clipDlgContainer);
		dlgTextArea.setAttribute('type', 'text');
		dlgTextArea.setAttribute('autocorrect', 'off');
		dlgTextArea.setAttribute('autocapitalize', 'off');
		dlgTextArea.setAttribute('autocomplete', 'off');
		dlgTextArea.setAttribute('spellcheck', 'false');
		this._dialogs[id].input = dlgTextArea;

		return dlgTextArea;
	},

	_updateDialogInput: function(dlgId) {
		if (!this._dialogs[dlgId].input)
			return;

		var strDlgId = this._toDlgPrefix(dlgId);
		var left = parseInt(L.DomUtil.getStyle(this._dialogs[dlgId].cursor, 'left'));
		var top = parseInt(L.DomUtil.getStyle(this._dialogs[dlgId].cursor, 'top'));
		var dlgContainer = L.DomUtil.get(strDlgId + '-clipboard-container');
		L.DomUtil.setPosition(dlgContainer, new L.Point(left, top));
	},

	focus: function(dlgId) {
		if (!this._isOpen(dlgId) || !this._dialogs[dlgId].input)
			return;

		this._dialogs[dlgId].input.focus();
	},

	_setCanvasWidthHeight: function(canvas, width, height) {
		L.DomUtil.setStyle(canvas, 'width', width + 'px');
		L.DomUtil.setStyle(canvas, 'height', height + 'px');

		var scale = L.getDpiScaleFactor();
		canvas.width = width * scale;
		canvas.height = height * scale;
	},

	_launchDialog: function(strDlgId, leftTwips, topTwips, width, height, title) {
		this.onCloseCurrentPopUp();
		var dialogContainer = L.DomUtil.create('div', 'lokdialog', document.body);
		L.DomUtil.setStyle(dialogContainer, 'padding', '0px');
		L.DomUtil.setStyle(dialogContainer, 'margin', '0px');
		dialogContainer.id = strDlgId;

		var dialogCanvas = L.DomUtil.create('canvas', 'lokdialog_canvas', dialogContainer);
		this._setCanvasWidthHeight(dialogCanvas, width, height);
		dialogCanvas.id = strDlgId + '-canvas';

		L.DomEvent.on(dialogCanvas, 'contextmenu', L.DomEvent.preventDefault);

		var dialogClass = 'lokdialog_container';
		if (!title)
			dialogClass += ' lokdialog_notitle';

		var that = this;
		var size = this._map.getSize();
		$(dialogContainer).dialog({
			minWidth: Math.min(width, size.x),
			width: Math.min(width, size.x),
			maxHeight: $(window).height(),
			height: 'auto',
			title: title ? title : '',
			modal: false,
			closeOnEscape: true,
			resizable: false,
			dialogClass: dialogClass,
			close: function() {
				that._onDialogClose(that._toRawDlgId(strDlgId), true);
			}
		});

		if (leftTwips != null && topTwips != null) {
			// magic to re-calculate the position in twips to absolute pixel
			// position inside the #document-container
			var pixels = this._map._docLayer._twipsToPixels(new L.Point(leftTwips, topTwips));
			var origin = this._map.getPixelOrigin();
			var panePos = this._map._getMapPanePos();

			var left = pixels.x + panePos.x - origin.x;
			var top = pixels.y + panePos.y - origin.y;

			if (left >= 0 && top >= 0) {
				$(dialogContainer).dialog('option', 'position', { my: 'left top', at: 'left+' + left + ' top+' + top, of: '#document-container' });
			}
		}

		// don't show the dialog surround until we have the dialog content
		$(dialogContainer).parent().hide();

		this._dialogs[this._toRawDlgId(strDlgId)] = {
			open: true,
			width: width,
			height: height,
			title: title
		};

		// don't make 'TAB' focus on this button; we want to cycle focus in the lok dialog with each TAB
		$('.lokdialog_container button.ui-dialog-titlebar-close').attr('tabindex', '-1').blur();

		this._createDialogCursor(strDlgId);
		var dlgInput = this._createDialogInput(strDlgId);

		L.DomEvent.on(dialogCanvas, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.on(dialogCanvas, 'mousemove', function(e) {
			this._map.lastActiveTime = Date.now();
			if (!this._dialogs[this._currentId].title) // For context menu
				this._postWindowMouseEvent('move', this._toRawDlgId(strDlgId), e.offsetX, e.offsetY, 1, 0, 0);
		}, this);
		L.DomEvent.on(dialogCanvas, 'mousedown mouseup', function(e) {
			L.DomEvent.stopPropagation(e);
			var buttons = 0;
			buttons |= e.button === this._map['mouse'].JSButtons.left ? this._map['mouse'].LOButtons.left : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.middle ? this._map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.right ? this._map['mouse'].LOButtons.right : 0;
			// 'mousedown' -> 'buttondown'
			var lokEventType = e.type.replace('mouse', 'button');
			this._postWindowMouseEvent(lokEventType, this._toRawDlgId(strDlgId), e.offsetX, e.offsetY, 1, buttons, 0);
			dlgInput.focus();
		}, this);
		L.DomEvent.on(dlgInput,
		              'keyup keypress keydown compositionstart compositionupdate compositionend textInput',
		              function(e) {
			              e.originalEvent = e; // _onKeyDown fn below requires real event in e.originalEvent
			              this._map['keyboard']._onKeyDown(e,
			                                         L.bind(this._postWindowKeyboardEvent,
			                                                this,
			                                                this._toRawDlgId(strDlgId)),
			                                         L.bind(this._postWindowCompositionEvent,
			                                                this,
			                                                this._toRawDlgId(strDlgId)),
			                                         dlgInput);

			              // keep map active while user is playing with dialog
			              this._map.lastActiveTime = Date.now();
		              }, this);
		L.DomEvent.on(dlgInput, 'contextmenu', function() {
			return false;
		});

		this._currentId = this._toRawDlgId(strDlgId);
	},

	_postWindowCompositionEvent: function(winid, type, text) {
		this._map._docLayer._postCompositionEvent(winid, type, text);
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
		this._currentId = null;
	},

	onCloseCurrentPopUp: function() {
		// for title-less dialog only (context menu, pop-up)
		if (!this._currentId || !this._isOpen(this._currentId) || this._dialogs[this._currentId].title)
			return;
		this._onDialogClose(this._currentId, true);
	},

	_paintDialog: function(dialogId, rectangle, imgData) {
		if (!this._isOpen(dialogId))
			return;

		var strDlgId = this._toDlgPrefix(dialogId);
		var img = new Image();
		var canvas = document.getElementById(strDlgId + '-canvas');
		var ctx = canvas.getContext('2d');
		var that = this;
		img.onload = function() {
			var x = 0;
			var y = 0;
			if (rectangle) {
				rectangle = rectangle.split(',');
				x = parseInt(rectangle[0]);
				y = parseInt(rectangle[1]);
			}

			ctx.drawImage(img, x, y);

			// if dialog is hidden, show it
			var dialogContainer = L.DomUtil.get(strDlgId);
			$(dialogContainer).parent().show();
			that.focus(dialogId);
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
		var canvas = L.DomUtil.get(strDlgId + '-floating');
		if (!canvas)
			return; // no floating window to paint to

		this._setCanvasWidthHeight(canvas, width, height);

		var ctx = canvas.getContext('2d');
		img.onload = function() {
			ctx.drawImage(img, 0, 0);
		};
		img.src = imgData;
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

		L.DomEvent.on(floatingCanvas, 'contextmenu', L.DomEvent.preventDefault);

		// attach events
		L.DomEvent.on(floatingCanvas, 'mousedown mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === this._map['mouse'].JSButtons.left ? this._map['mouse'].LOButtons.left : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.middle ? this._map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.right ? this._map['mouse'].LOButtons.right : 0;
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
