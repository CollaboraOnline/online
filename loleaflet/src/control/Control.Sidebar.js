/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Sidebar
 */

/* global $ */
L.Control.Sidebar = L.Control.extend({
	panelIdPrefix: 'sidebarpanel-',

	onAdd: function (map) {
		map.on('window', this._onWindowMsg, this);
		map.on('windowpaint', this._onWindowPaint, this);
	},

	_isParent: function(id) {
		return this._currentDeck != null && this._currentDeck.id === id;
	},

	// If returns non-null, then id is that of a panels and we have a parent (with the returned id).
	_getParentId: function(id) {
		if (this._isChild(parseInt(id)))
			return this._currentDeck.id;
		return null;
	},

	_isOpen: function(id) {
		return this._isParent(id) && $('#' + this._toStrId(id)).length > 0;
	},

	// Converts an string Id to its raw integer Id.
	_toIntId: function(id) {
		if (typeof(id) === 'string')
			return parseInt(id.replace(this.panelIdPrefix, ''));
		return id;
	},

	// Converts an integer Id to string, such as 'sidebarpanel-123'.
	_toStrId: function(id) {
		return this.panelIdPrefix + id;
	},

	_isChild: function(id) {
		return this._currentDeck != null && this._currentDeck.child != null && this._currentDeck.child.id === id;
	},

	_isChildOpen: function(id) {
		return this._isChild(id) && $('#' + this._currentDeck.strId + '-floating').length > 0;
	},

	_sendPaintWindowRect: function(id, x, y, width, height) {
		if (!width)
			width = this._currentDeck.width;
		if (width <= 0)
			return;	// Don't request rendering an empty area.
		if (!height)
			height = this._currentDeck.height;
		if (height <= 0)
			return;	// Don't request rendering an empty area.
		if (!x)
			x = 0;
		if (!y)
			y = 0;

		// pre-multiplied by the scale factor
		var dpiscale = L.getDpiScaleFactor();
		var rect = [x * dpiscale, y * dpiscale, width * dpiscale, height * dpiscale].join(',');
		this._sendPaintWindow(id, rect);
	},

	_sendPaintWindow: function(id, rectangle) {
		if (!rectangle)
			return; // Don't request rendering an empty area.

		rectangle = rectangle.replace(/ /g, '');
		if (!rectangle)
			return; // Don't request rendering an empty area.

		var dpiscale = L.getDpiScaleFactor();
		console.log('_sendPaintWindow: rectangle: ' + rectangle + ', dpiscale: ' + dpiscale);
		this._map._socket.sendMessage('paintwindow ' + id + ' rectangle=' + rectangle + ' dpiscale=' + dpiscale);
	},

	_isRectangleValid: function(rect) {
		rect = rect.split(',');
		return (parseInt(rect[0]) >= 0 && parseInt(rect[1]) >= 0 &&
				parseInt(rect[2]) >= 0 && parseInt(rect[3]) >= 0);
	},

	_onWindowMsg: function(e) {
		e.id = parseInt(e.id);
		var strId = this._toStrId(e.id);

		if (e.action === 'created') {
			var width = parseInt(e.size.split(',')[0]);
			var height = parseInt(e.size.split(',')[1]);

			if (e.position) {
				var left = parseInt(e.position.split(',')[0]);
				var top = parseInt(e.position.split(',')[1]);
			}

			if (e.winType === 'deck') {
				this._launchSidebar(e.id, left, top, width, height);
			} else if (e.winType === 'child') {
				var parentId = parseInt(e.parentId);
				if (!this._isOpen(parentId))
					return;

				left -= this._currentDeck.left;
				top -= this._currentDeck.top;

				this._removeChild(parentId);
				this._currentDeck.child = {
					open: true,
					id: e.id,
					strId: strId,
					left: left,
					top: top,
					width: width,
					height: height,
					parentId: parentId
				};

				this._createChild(e.id, parentId, top, left);
				this._sendPaintWindowRect(e.id, 0, 0, width, height);
			}
			else {
				// We only handle sidebar panels here (see Control.LokDialog.js)
				return;
			}
		}

		// The following act on an existing window.
		if (!this._isOpen(e.id) && !this._isChildOpen(e.id))
			return;

		if (e.action === 'invalidate') {
			var rectangle = e.rectangle;
			if (!rectangle || !this._isRectangleValid(rectangle))
			{
				if (this._isChild(e.id))
					rectangle = '0,0,' + this._currentDeck.child.width + ',' + this._currentDeck.child.height;
				else
					rectangle = '0,0,' + this._currentDeck.width + ',' + this._currentDeck.height;

				this._sendPaintWindow(e.id, rectangle);
			}
			else if (this._isChild(e.id))
			{
				// Child windows are given relative coordinates.
				this._sendPaintWindow(e.id, rectangle);
			}
			else
			{
				// Convert from absolute screen coordinates to relative.
				rectangle = rectangle.split(',');
				rectangle[0] = parseInt(rectangle[0]) - this._currentDeck.left;
				rectangle[1] = parseInt(rectangle[1]) - this._currentDeck.top;
				this._sendPaintWindowRect(e.id, rectangle[0], rectangle[1], rectangle[2], rectangle[3]);
			}
		} else if (e.action === 'size_changed') {
			width = parseInt(e.size.split(',')[0]);
			height = parseInt(e.size.split(',')[1]);
			left = parseInt(e.position.split(',')[0]);
			top = parseInt(e.position.split(',')[1]);
			this._launchSidebar(e.id, left, top, width, height);
		} else if (e.action === 'cursor_invalidate') {
			if (this._isOpen(e.id) && !!e.rectangle) {
				rectangle = e.rectangle.split(',');
				var x = parseInt(rectangle[0]);
				var y = parseInt(rectangle[1]);
				height = parseInt(rectangle[3]);

				// Relative x to the sidebar.
				x -= this._currentDeck.left;

				this._updateDialogCursor(e.id, x, y, height);
			}
		} else if (e.action === 'cursor_visible') {
			this._currentDeck.cursor.cursorVisible = e.visible === 'true';
			if (this._currentDeck.cursor.cursorVisible)
				$('#' + strId + '-cursor').css({display: 'block'});
			else
				$('#' + strId + '-cursor').css({display: 'none'});
		} else if (e.action === 'close') {
			var parent = this._getParentId(e.id);
			if (parent)
				this._onPanelChildClose(this._toStrId(parent));
			else
				this._onPanelClose(e.id, false);
		}
	},

	_updateDialogCursor: function(dlgId, x, y, height) {
		var strId = this._toStrId(dlgId);
		var dialogCursor = L.DomUtil.get(strId + '-cursor');
		L.DomUtil.setStyle(dialogCursor, 'height', height + 'px');
		L.DomUtil.setStyle(dialogCursor, 'display', this._currentDeck.cursor.cursorVisible ? 'block' : 'none');
		// set the position of the cursor container element
		L.DomUtil.setStyle(this._currentDeck.cursor, 'left', x + 'px');
		L.DomUtil.setStyle(this._currentDeck.cursor, 'top', y + 'px');

		// update the input as well
		this._updateDialogInput(dlgId);
	},

	_createDialogCursor: function(dialogId) {
		this._currentDeck.cursor = L.DomUtil.create('div', 'sidebar-cursor-container', L.DomUtil.get(dialogId));
		var cursor = L.DomUtil.create('div', 'leaflet-cursor lokdialog-cursor', this._currentDeck.cursor);
		cursor.id = dialogId + '-cursor';
		L.DomUtil.addClass(cursor, 'blinking-cursor');
	},

	_createDialogInput: function(dialogId) {
		var clipDlgContainer = L.DomUtil.create('div', 'clipboard-container', L.DomUtil.get(dialogId));
		clipDlgContainer.id = dialogId + '-clipboard-container';
		var dlgTextArea = L.DomUtil.create('input', 'clipboard', clipDlgContainer);
		dlgTextArea.setAttribute('type', 'text');
		dlgTextArea.setAttribute('autocorrect', 'off');
		dlgTextArea.setAttribute('autocapitalize', 'off');
		dlgTextArea.setAttribute('autocomplete', 'off');
		dlgTextArea.setAttribute('spellcheck', 'false');
		this._currentDeck.input = dlgTextArea;

		return dlgTextArea;
	},

	_updateDialogInput: function(dlgId) {
		if (!this._currentDeck.input)
			return;

		var strId = this._toStrId(dlgId);
		var left = parseInt(L.DomUtil.getStyle(this._currentDeck.cursor, 'left'));
		var top = parseInt(L.DomUtil.getStyle(this._currentDeck.cursor, 'top'));
		var dlgContainer = L.DomUtil.get(strId + '-clipboard-container');
		L.DomUtil.setPosition(dlgContainer, new L.Point(left, top));
	},

	focus: function(dlgId) {
		if (!this._isOpen(dlgId) || !this._currentDeck.input)
			return;

		this._currentDeck.input.focus();
	},

	_setCanvasWidthHeight: function(canvas, width, height) {
		// FIXME: Setting the style width/height is messing up the cursor.
		// L.DomUtil.setStyle(canvas, 'width', width + 'px');
		// L.DomUtil.setStyle(canvas, 'height', height + 'px');

		var scale = L.getDpiScaleFactor();
		canvas.width = width * scale;
		canvas.height = height * scale;
	},

	_launchSidebar: function(id, left, top, width, height) {

		if (!left)
			left = 0;
		if (!top)
			top = 0;

		var strId = this._toStrId(id);

		if (this._currentDeck)
		{
			if (width > 0)
			{
				this._resizeSidebar(strId, width);
			}

			// Render window.
			this._sendPaintWindowRect(id);
			return;
		}

		var panelContainer = L.DomUtil.create('div', 'panel', L.DomUtil.get('sidebar-panel'));
		L.DomUtil.setStyle(panelContainer, 'padding', '0px');
		L.DomUtil.setStyle(panelContainer, 'margin', '0px');
		L.DomUtil.setStyle(panelContainer, 'position', 'relative');
		panelContainer.width = width;
		panelContainer.height = height;
		panelContainer.id = strId;

		// Create the panel canvas.
		var panelCanvas = L.DomUtil.create('canvas', 'panel_canvas', panelContainer);
		L.DomUtil.setStyle(panelCanvas, 'position', 'absolute');
		this._setCanvasWidthHeight(panelCanvas, width, height);
		panelCanvas.id = strId + '-canvas';

		// Create the child canvas now, to make it on top of the main panel canvas.
		var floatingCanvas = L.DomUtil.create('canvas', 'lokdialogchild-canvas', panelContainer);
		L.DomUtil.setStyle(floatingCanvas, 'position', 'absolute');
		floatingCanvas.width = 0;
		floatingCanvas.height = 0;
		floatingCanvas.id = strId + '-floating';

		// Don't show the sidebar until we get the contents.
		$(panelContainer).parent().hide();

		this._currentDeck = {
			open: true,
			id: id,
			strId: strId,
			left: left,
			top: top,
			width: width,
			height: height,
			cursor: null,
			input: null,
			child: null // One child, typically drop-down list
		};

		// don't make 'TAB' focus on this button; we want to cycle focus in the lok dialog with each TAB
		// $('.lokdialog_container button.ui-dialog-titlebar-close').attr('tabindex', '-1').blur();

		this._createDialogCursor(strId);
		var dlgInput = this._createDialogInput(strId);

		L.DomEvent.on(panelCanvas, 'resize', function() {
			this._map._socket.sendMessage('resizewindow ' + id + ' size=' + panelCanvas.width + ',' + panelCanvas.height);
		}, this);
		L.DomEvent.on(panelContainer, 'resize', function() {
			var sidebarpanel = L.DomUtil.get('sidebar-panel');
			if (sidebarpanel) {
				var sidebar = sidebarpanel.children[0];
				if (sidebar) {
					this._map._socket.sendMessage('resizewindow ' + id + ' size=' + sidebar.width + ',' + sidebar.height);
				}
			}
		}, this);

		L.DomEvent.on(panelCanvas, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.on(panelContainer, 'mouseleave', function() {
			// Move the mouse off-screen when we leave the sidebar
			// so we don't leave edge-elements highlighted as if
			// the mouse is still over them.
			this._map.lastActiveTime = Date.now();
			this._postWindowMouseEvent('move', id, -1, -1, 1, 0, 0);
		}, this);
		L.DomEvent.on(panelCanvas, 'mousemove', function(e) {
			this._map.lastActiveTime = Date.now();
			this._postWindowMouseEvent('move', id, e.offsetX, e.offsetY, 1, 0, 0);
		}, this);
		L.DomEvent.on(panelCanvas, 'mousedown mouseup', function(e) {
			L.DomEvent.stopPropagation(e);
			var buttons = 0;
			buttons |= e.button === this._map['mouse'].JSButtons.left ? this._map['mouse'].LOButtons.left : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.middle ? this._map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.right ? this._map['mouse'].LOButtons.right : 0;
			// 'mousedown' -> 'buttondown'
			var lokEventType = e.type.replace('mouse', 'button');
			this._postWindowMouseEvent(lokEventType, id, e.offsetX, e.offsetY, 1, buttons, 0);
			dlgInput.focus();
		}, this);

		L.DomEvent.on(dlgInput,
		              'keyup keypress keydown compositionstart compositionupdate compositionend textInput',
		              function(e) {
			              e.originalEvent = e; // _onKeyDown fn below requires real event in e.originalEvent
			              this._map['keyboard']._onKeyDown(e,
			                                         L.bind(this._postWindowKeyboardEvent,
			                                                this,
			                                                id),
			                                         L.bind(this._postWindowCompositionEvent,
			                                                this,
			                                                id),
			                                         dlgInput);

			              // keep map active while user is playing with panel
			              this._map.lastActiveTime = Date.now();
		              }, this);
		L.DomEvent.on(dlgInput, 'contextmenu', function() {
			return false;
		});

		// Render window.
		this._sendPaintWindowRect(id);
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

	_onPanelClose: function(id, notifyBackend) {
		if (notifyBackend)
			this._sendCloseWindow(id);
		$('#' + this._toStrId(id)).remove();
		var sidebar = L.DomUtil.get(this._currentDeck.strId);
		if (sidebar)
			sidebar.style.width = '0px';
		var docContainer = this._map.options.documentContainer;
		docContainer.style.right = '0px';
		var spreadsheetRowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
		if (spreadsheetRowColumnFrame)
			spreadsheetRowColumnFrame.style.right = '0px';
		this._map.focus();
		this._currentDeck = null;
	},

	/// Rendered image sent from Core.
	_paintPanel: function (parentId, rectangle, imgData) {

		var strId = this._toStrId(parentId);
		var canvas = document.getElementById(strId + '-canvas');
		if (!canvas)
			return; // no window to paint to

		// The actual image of the window may be larger/smaller than the dimension we get on size_changed.
		var width = this._currentDeck.width;

		var ctx = canvas.getContext('2d');

		var that = this;
		var img = new Image();
		img.onload = function() {
			var x = 0;
			var y = 0;
			if (rectangle) {
				rectangle = rectangle.split(',');
				x = parseInt(rectangle[0]);
				y = parseInt(rectangle[1]);
			}

			that._resizeSidebar(strId, width);

			// Render.
			ctx.drawImage(img, x, y);

			// If sidebar panel is hidden, show it.
			var sidebarContainer = L.DomUtil.get(strId);
			if (sidebarContainer)
				$(sidebarContainer).parent().show();
		};
		img.src = imgData;
	},

	/// Rendered image sent from Core.
	_onWindowPaint: function (e) {
		var parent = this._getParentId(e.id);
		if (parent) {
			this._paintPanelChild(parent, e.width, e.height, e.rectangle, e.img);
		} else {
			this._paintPanel(e.id, e.rectangle, e.img);
		}
	},

	_paintPanelChild: function(parentId, width, height, rectangle, imgData) {
		var strId = this._toStrId(parentId);
		var img = new Image();
		var canvas = L.DomUtil.get(strId + '-floating');
		if (!canvas)
			return; // no floating window to paint to

		this._setCanvasWidthHeight(canvas, width, height);

		var ctx = canvas.getContext('2d');
		img.onload = function() {
			ctx.drawImage(img, 0, 0);
		};
		img.src = imgData;
	},

	_resizeSidebar: function(strId, width) {
		this._currentDeck.width = width;
		var sidebar = L.DomUtil.get(strId);
		sidebar.width = width;
		sidebar.style.width = width.toString() + 'px';
		this._map.options.documentContainer.style.right = sidebar.style.width;
		var spreadsheetRowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
		if (spreadsheetRowColumnFrame)
			spreadsheetRowColumnFrame.style.right = sidebar.style.width;
	},

	_onPanelChildClose: function(parentId) {
		this._removeChild(parentId);

		// remove any extra height allocated for the parent container
		var canvasHeight = document.getElementById(parentId + '-canvas').height;
		$('#' + parentId).height(canvasHeight + 'px');
	},

	_removeChild: function(parentId) {
		if (typeof parentId === 'number')
			parentId = this._toStrId(parentId);
		var floatingCanvas = L.DomUtil.get(parentId + '-floating');
		floatingCanvas.width = 0;
		floatingCanvas.height = 0;
	},

	_createChild: function(childId, parentId, top, left) {
		var strId = this._toStrId(parentId);
		var floatingCanvas = L.DomUtil.get(strId + '-floating');
		L.DomUtil.setStyle(floatingCanvas, 'position', 'relative'); // Relative to the sidebar
		L.DomUtil.setStyle(floatingCanvas, 'left', left + 'px'); // yes, it's necessary to append 'px'
		L.DomUtil.setStyle(floatingCanvas, 'top', top + 'px');

		// attach events
		this._setupChildEvents(childId, floatingCanvas);
	},

	_setupChildEvents: function(childId, canvas) {
		L.DomEvent.on(canvas, 'contextmenu', L.DomEvent.preventDefault);

		L.DomEvent.on(canvas, 'mousedown mouseup', function(e) {
			var buttons = 0;
			buttons |= e.button === this._map['mouse'].JSButtons.left ? this._map['mouse'].LOButtons.left : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.middle ? this._map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.right ? this._map['mouse'].LOButtons.right : 0;
			var lokEventType = e.type.replace('mouse', 'button');
			this._postWindowMouseEvent(lokEventType, childId, e.offsetX, e.offsetY, 1, buttons, 0);
		}, this);
		L.DomEvent.on(canvas, 'mousemove', function(e) {
			this._postWindowMouseEvent('move', childId, e.offsetX, e.offsetY, 1, 0, 0);
		}, this);
		L.DomEvent.on(canvas, 'contextmenu', function() {
			return false;
		});
	}
});

L.control.sidebar = function (options) {
	return new L.Control.Sidebar(options);
};
