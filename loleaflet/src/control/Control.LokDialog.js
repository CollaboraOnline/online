/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.LokDialog used for displaying LOK dialogs
 */

/* global $ L Hammer w2ui */
L.WinUtil = {

};

var firstTouchPositionX = null;
var firstTouchPositionY = null;
var previousTouchType = null;

function updateTransformation(target) {
	if (target !== null && target !== undefined) {
		var value = [
			'translate3d(' + target.transformation.translate.x + 'px, ' + target.transformation.translate.y + 'px, 0)',
			'scale(' + target.transformation.scale + ', ' + target.transformation.scale + ')'
		];

		value = value.join(' ');
		target.value.style.webkitTransform = value;
		target.value.style.mozTransform = value;
		target.value.style.transform = value;
	}
}

var zoomTargets = [];

function findZoomTarget(id) {
	for (var item in zoomTargets) {
		if (zoomTargets[item].key === id) {
			return zoomTargets[item];
		}
	}
	return null;
}

function removeZoomTarget(id) {
	for (var item in zoomTargets) {
		if (zoomTargets[item].key === id) {
			delete zoomTargets[item];
		}
	}
}

function toZoomTargetId(id) {
	return id.replace('-canvas', '');
}

L.Control.LokDialog = L.Control.extend({

	dialogIdPrefix: 'lokdialog-',

	onPan: function (ev, dialogID) {
		var id = toZoomTargetId(ev.target.id);
		var target = findZoomTarget(id);

		if (target) {
			if (ev.pointers.length == 1) {
				if (ev.type == 'panstart') {
					firstTouchPositionX = ev.pointers[0].offsetX;
					firstTouchPositionY = ev.pointers[0].offsetY;
					this._postWindowGestureEvent(dialogID, 'panBegin', firstTouchPositionX, firstTouchPositionY, ev.deltaY);
				}
				else if (ev.type == 'panstop') {
					this._postWindowGestureEvent(dialogID, 'panEnd', firstTouchPositionX, firstTouchPositionY, ev.deltaY);
					firstTouchPositionX = null;
					firstTouchPositionY = null;
				}
				else {
					this._postWindowGestureEvent(dialogID, 'panUpdate', firstTouchPositionX, firstTouchPositionY, ev.deltaY);
				}
			}
			else {
				var newX = target.initialState.startX + ev.deltaX;
				var newY = target.initialState.startY + ev.deltaY;

				// Don't allow to put dialog outside the view
				if (window.mode.isDesktop() &&
					(newX < -target.width/2 || newY < -target.height/2
					|| newX > window.innerWidth - target.width/2
					|| newY > window.innerHeight - target.height/2))
					return;

				target.transformation.translate = {
					x: newX,
					y: newY
				};

				updateTransformation(target);
			}
		}
	},

	onPinch: function (ev) {
		var id = toZoomTargetId(ev.target.id);
		var target = findZoomTarget(id);

		if (target) {
			if (ev.type == 'pinchstart') {
				target.initialState.initScale = target.transformation.scale || 1;
			}

			if (target.initialState.initScale * ev.scale > 0.4) {
				target.transformation.scale = target.initialState.initScale * ev.scale;
			}

			updateTransformation(target);
		}
	},

	onAdd: function (map) {
		map.on('window', this._onDialogMsg, this);
		map.on('windowpaint', this._onDialogPaint, this);
		map.on('opendialog', this._openDialog, this);
		map.on('docloaded', this._docLoaded, this);
		map.on('closepopup', this.onCloseCurrentPopUp, this);
		map.on('closesidebar', this._closeSidebar, this);
		map.on('editorgotfocus', this._onEditorGotFocus, this);
		L.DomEvent.on(document, 'mouseup', this.onCloseCurrentPopUp, this);

		this.slideAnimationDuration = 250;//sidebar open animation duration

		//open sidebar on left swipe on document view
		var documentContainerHammer = new Hammer(document.getElementById('document-container'));
		documentContainerHammer.on('swipeleft', function (e) {
			var startX = e.changedPointers[0].clientX - e.deltaX;
			if (startX < window.screen.width * 0.7)//detect open swipes only near screen edge
				return;
			map._socket.sendMessage('uno .uno:Sidebar');
		})

		//close sidebar on right swipe on sidebar panel, also on document view(for tablets)
		var sidebarPanelHammer = new Hammer(document.getElementById('sidebar-panel'));
		[sidebarPanelHammer, documentContainerHammer].forEach(function (hammerElement) {
			hammerElement.on('swiperight', function () {
				map._socket.sendMessage('uno .uno:Sidebar');
			})
		})
	},

	_dialogs: {},

	_docLoaded: function(e) {
		if (!e.status) {
			$('.lokdialog_container').remove();
			$('.lokdialogchild-canvas').remove();
		}
	},

	_getParentId: function(id) {
		id = parseInt(id);
		for (var winId in this._dialogs) {
			if (this._dialogs[winId].childid && this._dialogs[winId].childid === id) {
				return winId;
			}
		}
		return null;
	},

	_isOpen: function(id) {
		return this._dialogs[id] &&
			$('#' + this._toStrId(id)).length > 0;
	},

	_isSidebar: function(id) {
		return this._dialogs[id].isSidebar;
	},

	// Given a prefixed dialog id like 'lokdialog-323', gives a raw id, 323.
	_toIntId: function(id) {
		if (typeof(id) === 'string')
			return parseInt(id.replace(this.dialogIdPrefix, ''));
		return id;
	},

	// Converts a raw dialog id like 432, to 'lokdialog-432'.
	_toStrId: function(id) {
		return this.dialogIdPrefix + id;
	},

	// Create a rectangle string of form "x,y,width,height"
	// if params are missing, assumes 0,0,dialog width, dialog height
	_createRectStr: function(id, x, y, width, height) {
		if (!width)
			width = this._dialogs[parseInt(id)].width;
		if (width <= 0)
			return null;
		if (!height)
			height = this._dialogs[parseInt(id)].height;
		if (height <= 0)
			return null;
		if (!x)
			x = 0;
		if (!y)
			y = 0;

		// pre-multiplied by the scale factor
		var dpiscale = L.getDpiScaleFactor();
		return [x * dpiscale, y * dpiscale, width * dpiscale, height * dpiscale].join(',');
	},

	_sendPaintWindowRect: function(id, x, y, width, height) {
		if (!width)
			width = this._dialogs[id].width;
		if (width <= 0)
			return;	// Don't request rendering an empty area.
		if (!height)
			height = this._dialogs[id].height;
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
		//console.log('_sendPaintWindow: rectangle: ' + rectangle + ', dpiscale: ' + dpiscale);
		this._map._socket.sendMessage('paintwindow ' + id + ' rectangle=' + rectangle + ' dpiscale=' + dpiscale);
	},

	_sendCloseWindow: function(id) {
		this._map._socket.sendMessage('windowcommand ' + id + ' close');
	},

	_isRectangleValid: function(rect) {
		rect = rect.split(',');
		return (!isNaN(parseInt(rect[0])) && !isNaN(parseInt(rect[1])) &&
				parseInt(rect[2]) >= 0 && parseInt(rect[3]) >= 0);
	},

	_onDialogMsg: function(e) {
		if (e.winType != undefined && e.winType !== 'dialog' && e.winType !== 'child' && e.winType !== 'deck') {
			return;
		}

		e.id = parseInt(e.id);
		var strId = this._toStrId(e.id);

		var width = 0;
		var height = 0;
		if (e.size) {
			width = parseInt(e.size.split(',')[0]);
			height = parseInt(e.size.split(',')[1]);
		}

		var left;
		var top;
		if (e.position) {
			left = parseInt(e.position.split(',')[0]);
			top = parseInt(e.position.split(',')[1]);
		}

		if (e.action === 'created') {
			if (e.winType === 'dialog') {
				// When left/top are invalid, the dialog shows in the center.
				this._launchDialog(e.id, left, top, width, height, e.title);
			} else if (e.winType === 'deck') {
				this._launchSidebar(e.id, width, height);
			} else if (e.winType === 'child') {
				var parentId = parseInt(e.parentId);
				if (!this._isOpen(parentId))
					return;

				if (!left)
					left = 0;
				if (!top)
					top = 0;
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

		// All other callbacks doen't make sense without an active dialog.
		if (!(this._isOpen(e.id) || this._getParentId(e.id)))
			return;

		if (e.action === 'invalidate') {
			var parent = this._getParentId(e.id);
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
			// FIXME: we don't really have to destroy and launch the dialog again but do it for
			// now because the size sent to us previously in 'created' cb is not correct
			$('#' + strId).remove();
			this._launchDialog(e.id, null, null, width, height, this._dialogs[parseInt(e.id)].title);
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
				$('#' + strId).dialog('option', 'title', e.title);
			}
		} else if (e.action === 'cursor_visible') {
			this._dialogs[e.id].cursorVisible = e.visible === 'true';
			if (this._dialogs[e.id].cursorVisible) {
				$('#' + strId + '-cursor').css({display: 'block'});
				this._map._onLostFocus();
			}
			else {
				$('#' + strId + '-cursor').css({display: 'none'});
			}
		} else if (e.action === 'close') {
			parent = this._getParentId(e.id);
			if (parent)
				this._onDialogChildClose(parent);
			else if (this._isSidebar(e.id))
				this._onSidebarClose(e.id);
			else
				this._onDialogClose(e.id, false);
		} else if (e.action === 'hide') {
			$('#' + strId).parent().css({display: 'none'});
		} else if (e.action === 'show') {
			$('#' + strId).parent().css({display: 'block'});
		}
	},

	_openDialog: function(e) {
		this._map.sendUnoCommand(e.uno);
	},

	_updateDialogCursor: function(dlgId, x, y, height) {
		var strId = this._toStrId(dlgId);
		var dialogCursor = L.DomUtil.get(strId + '-cursor');
		L.DomUtil.setStyle(dialogCursor, 'height', height + 'px');
		L.DomUtil.setStyle(dialogCursor, 'display', this._dialogs[dlgId].cursorVisible ? 'block' : 'none');
		// set the position of the cursor container element
		L.DomUtil.setStyle(this._dialogs[dlgId].cursor, 'left', x + 'px');
		L.DomUtil.setStyle(this._dialogs[dlgId].cursor, 'top', y + 'px');

		// update the input as well
		this._updateDialogInput(dlgId);
	},

	_createDialogCursor: function(dialogId) {
		var id = this._toIntId(dialogId);
		this._dialogs[id].cursor = L.DomUtil.create('div', 'leaflet-cursor-container', L.DomUtil.get(dialogId));
		var cursor = L.DomUtil.create('div', 'leaflet-cursor lokdialog-cursor', this._dialogs[id].cursor);
		cursor.id = dialogId + '-cursor';
		L.DomUtil.addClass(cursor, 'blinking-cursor');
	},

	_createDialogInput: function(dialogId) {
		var id = this._toIntId(dialogId);
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

		var strId = this._toStrId(dlgId);
		var left = parseInt(L.DomUtil.getStyle(this._dialogs[dlgId].cursor, 'left'));
		var top = parseInt(L.DomUtil.getStyle(this._dialogs[dlgId].cursor, 'top'));
		var dlgContainer = L.DomUtil.get(strId + '-clipboard-container');
		L.DomUtil.setPosition(dlgContainer, new L.Point(left, top));
	},

	focus: function(dlgId, force) {
		if (!force && (!this._isOpen(dlgId) || !this._dialogs[dlgId].input || !this._dialogs[dlgId].cursorVisible))
			return;

		this._dialogs[dlgId].input.focus();
	},

	_setCanvasWidthHeight: function(canvas, width, height) {
		var scale = L.getDpiScaleFactor();
		var newWidth = width * scale;
		if (canvas.width != newWidth) {
			L.DomUtil.setStyle(canvas, 'width', width + 'px');
			canvas.width = newWidth;
		}

		var newHeight = height * scale;
		if (canvas.height != newHeight) {
			L.DomUtil.setStyle(canvas, 'height', height + 'px');
			canvas.height = newHeight;
		}
	},

	_launchDialog: function(id, leftTwips, topTwips, width, height, title) {
		if (window.ThisIsTheiOSApp)
			w2ui['editbar'].disable('closemobile');
		this.onCloseCurrentPopUp();
		var dialogContainer = L.DomUtil.create('div', 'lokdialog', document.body);
		L.DomUtil.setStyle(dialogContainer, 'padding', '0px');
		L.DomUtil.setStyle(dialogContainer, 'margin', '0px');
		L.DomUtil.setStyle(dialogContainer, 'touch-action', 'manipulate');

		var strId = this._toStrId(id);
		dialogContainer.id = strId;

		var dialogCanvas = L.DomUtil.create('canvas', 'lokdialog_canvas', dialogContainer);
		this._setCanvasWidthHeight(dialogCanvas, width, height);
		dialogCanvas.id = strId + '-canvas';

		var dialogClass = 'lokdialog_container';
		if (!title)
			dialogClass += ' lokdialog_notitle';

		var that = this;
		var size = $(window).width();
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
				that._onDialogClose(id, true);
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

		// Override default minHeight, which can be too large for thin dialogs.
		L.DomUtil.setStyle(dialogContainer, 'minHeight', height + 'px');

		this._dialogs[id] = {
			id: id,
			strId: strId,
			isSidebar: false,
			width: width,
			height: height,
			cursor: null,
			input: null,
			title: title
		};

		// don't make 'TAB' focus on this button; we want to cycle focus in the lok dialog with each TAB
		$('.lokdialog_container button.ui-dialog-titlebar-close').attr('tabindex', '-1').blur();

		this._createDialogCursor(strId);
		var dlgInput = this._createDialogInput(strId);
		this._setupWindowEvents(id, dialogCanvas, dlgInput);
		this._setupGestures(id, dialogCanvas);

		this._currentId = id;
		this._sendPaintWindow(id, this._createRectStr(id));
	},

	_launchSidebar: function(id, width, height) {

		if ((window.mode.isMobile() || window.mode.isTablet())
		    && this._map._permission != 'edit')
			return;

		$('#sidebar-dock-wrapper').css('display', 'block');

		var ratio = 1.0;
		if (width > window.screen.width) {
			ratio = window.screen.width / width;
		}

		var strId = this._toStrId(id);

		if (this._currentDeck) {
			this._currentDeck.width = width;
			this._currentDeck.height = height;

			// Hide cursor.
			this._currentDeck.cursorVisible = false;
			$('#' + strId + '-cursor').css({display: 'none'});

			var panel = L.DomUtil.get('sidebar-panel');
			if (width > 1)
				$(panel).parent().show();
			else
				$(panel).parent().hide();

			// Render window.
			this._sendPaintWindowRect(id);

			if (window.mode.isTablet())
				$('#sidebar-dock-wrapper').addClass('tablet');

			if (ratio < 1.0) {
				$('#sidebar-dock-wrapper').css('width', String(width * ratio) + 'px');
			}
			return;
		}

		var panelContainer = L.DomUtil.create('div', 'panel', L.DomUtil.get('sidebar-panel'));
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

		this._dialogs[id] = {
			open: true,
			id: id,
			strId: strId,
			isSidebar: true,
			left: 0,
			top: 0,
			width: width,
			height: height,
			cursor: null,
			input: null,
			child: null, // One child, typically drop-down list
			title: null  // Never used for sidebars
		};

		this._currentDeck = this._dialogs[id];

		this._createDialogCursor(strId);
		var dlgInput = this._createDialogInput(strId);
		this._setupWindowEvents(id, panelCanvas, dlgInput);

		L.DomEvent.on(panelContainer, 'resize', function() {
			// Don't resize the window as we handle overflowing with scrollbars.
			// this._map._socket.sendMessage('resizewindow ' + id + ' size=' + panelContainer.width + ',' + panelContainer.height);
		}, this);

		L.DomEvent.on(panelContainer, 'mouseleave', function() {
			// Move the mouse off-screen when we leave the sidebar
			// so we don't leave edge-elements highlighted as if
			// the mouse is still over them.
			this._map.lastActiveTime = Date.now();
			this._postWindowMouseEvent('move', id, -1, -1, 1, 0, 0);
		}, this);

		// Render window.
		this._sendPaintWindowRect(id);

		//play slide from right animation on mobile and tablets
		if (L.Browser.mobile) {
			var sidebar = $('#sidebar-dock-wrapper');
			var bottomBar = $('#toolbar-down');
			sidebar.css('bottom', '0px');//to take the space occupied by the bottom menu
			sidebar.css('position', 'fixed');//fixed position in order to prevent scrollbars to appear while opening/closing
			bottomBar.animate({ 'opacity': 0 }, this.slideAnimationDuration);
			sidebar.css('margin-right', -width * ratio + 'px').animate({ 'margin-right': '0px' }, this.slideAnimationDuration, function () {
				$('#toolbar-down').hide();
				sidebar.css('position', '');
			});
		}
	},

	_setupWindowEvents: function(id, canvas, dlgInput) {
		L.DomEvent.on(canvas, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.on(canvas, 'mousemove', function(e) {
			this._postWindowMouseEvent('move', id, e.offsetX, e.offsetY, 1, 0, 0);
			// Keep map active while user is playing with sidebar/dialog.
			this._map.lastActiveTime = Date.now();
		}, this);
		L.DomEvent.on(canvas, 'mousedown mouseup', function(e) {
			L.DomEvent.stopPropagation(e);
			var buttons = 0;
			buttons |= e.button === this._map['mouse'].JSButtons.left ? this._map['mouse'].LOButtons.left : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.middle ? this._map['mouse'].LOButtons.middle : 0;
			buttons |= e.button === this._map['mouse'].JSButtons.right ? this._map['mouse'].LOButtons.right : 0;
			// 'mousedown' -> 'buttondown'
			var lokEventType = e.type.replace('mouse', 'button');
			this._postWindowMouseEvent(lokEventType, id, e.offsetX, e.offsetY, 1, buttons, 0);
			this.focus(id, !this._dialogs[id].isSidebar);
			// Keep map active while user is playing with sidebar/dialog.
			this._map.lastActiveTime = Date.now();
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

			              // Keep map active while user is playing with sidebar/dialog.
			              this._map.lastActiveTime = Date.now();
		              }, this);
		L.DomEvent.on(dlgInput, 'paste', function(e) {
			var clipboardData = e.clipboardData || window.clipboardData;
			var data, blob;

			L.DomEvent.preventDefault(e);
			if (clipboardData) {
				data = clipboardData.getData('text/plain') || clipboardData.getData('Text');
				if (data) {
					var cmd = {
						MimeType: {
							type: 'string',
							value: 'mimetype=text/plain;charset=utf-8'
						},
						Data: {
							type: '[]byte',
							value: data
						}
					};

					blob = new Blob(['windowcommand ' + id + ' paste ', encodeURIComponent(JSON.stringify(cmd))]);
					this._map._socket.sendMessage(blob);
				}
			}
		}, this);
		L.DomEvent.on(dlgInput, 'contextmenu', function() {
			return false;
		});
	},

	_setupGestures: function(id, canvas) {
		var self = this;
		var dialogID = id;
		var targetId = toZoomTargetId(canvas.id);
		var zoomTarget = $('#' + targetId).parent().get(0);

		var ratio = 1.0;
		var width = this._dialogs[id].width;
		var height = this._dialogs[id].height;
		var offsetX = 0;
		var offsetY = 0;

		if ((window.mode.isMobile() || window.mode.isTablet()) && width > window.screen.width) {
			ratio = window.screen.width / (width + 40);
			offsetX = -(width - window.screen.width) / 2;
			offsetY = -(height - window.screen.height) / 2;
		}

		var state = {
			startX: offsetX,
			startY: offsetY,
			initScale: ratio
		}
		var transformation = {
			translate: { x: offsetX, y: offsetY },
			scale: ratio,
			angle: 0,
			rx: 0,
			ry: 0,
			rz: 0
		};

		if (findZoomTarget(targetId) != null) {
			removeZoomTarget(targetId);
		}

		zoomTargets.push({key: targetId, value: zoomTarget, transformation: transformation, initialState: state, width:width, height: height});

		var hammerAll = new Hammer(canvas);
		hammerAll.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
		hammerAll.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith([hammerAll.get('pan')]);

		hammerAll.on('panstart panmove panstop', function(ev) {
			self.onPan(ev, dialogID);
		});
		hammerAll.on('pinchstart pinchmove', this.onPinch);
		hammerAll.on('hammer.input', function(ev) {
			if (ev.isFinal) {
				var id = toZoomTargetId(ev.target.id);
				var target = findZoomTarget(id);
				if (target) {
					target.initialState.startX = target.transformation.translate.x;
					target.initialState.startY = target.transformation.translate.y;
				}
			}
		});

		updateTransformation(findZoomTarget(targetId));
	},

	_postWindowCompositionEvent: function(winid, type, text) {
		this._map._docLayer._postCompositionEvent(winid, type, text);
		// Keep map active while user is playing with sidebar/dialog.
		this._map.lastActiveTime = Date.now();
	},

	_postWindowMouseEvent: function(type, winid, x, y, count, buttons, modifier) {
		this._map._socket.sendMessage('windowmouse id=' + winid +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' count=' + count +
		                              ' buttons=' + buttons + ' modifier=' + modifier);
		// Keep map active while user is playing with sidebar/dialog.
		this._map.lastActiveTime = Date.now();
	},

	_postWindowGestureEvent: function(winid, type, x, y, offset) {
		console.log('x ' + x + ' y ' + y + ' o ' + offset);
		this._map._socket.sendMessage('windowgesture id=' + winid +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' offset=' + offset);
		// Keep map active while user is playing with sidebar/dialog.
		this._map.lastActiveTime = Date.now();
	},

	_postWindowKeyboardEvent: function(winid, type, charcode, keycode) {
		this._map._socket.sendMessage('windowkey id=' + winid + ' type=' + type +
		                              ' char=' + charcode + ' key=' + keycode);
		// Keep map active while user is playing with sidebar/dialog.
		this._map.lastActiveTime = Date.now();
	},

	_onSidebarClose: function(dialogId) {
		this._resizeSidebar(dialogId, 0);
		$('#' + this._currentDeck.strId).remove();
		this._map.focus();
		delete this._dialogs[dialogId];
		this._currentDeck = null;

		//play slide animation to right if this is a mobile or tablet
		if (L.Browser.mobile) {
			var sidebar = $('#sidebar-dock-wrapper');
			var bottomBar = $('#toolbar-down');
			var sidebarWidth = $('#sidebar-dock-wrapper').width();
			bottomBar.animate({ 'opacity': 1 }, this.slideAnimationDuration);
			sidebar.css('position', 'fixed');//fixed position in order to prevent scrollbars to appear while opening/closing
			sidebar.animate({ 'margin-right': -sidebarWidth + 'px' }, this.slideAnimationDuration, function () {
				//remove artifacts from the animation
				sidebar.css('margin-right', '');
				sidebar.css('display', '');
				sidebar.css('position', '');
				$('#toolbar-down').show();
			});
		}
	},

	_onDialogClose: function(dialogId, notifyBackend) {
		if (window.ThisIsTheiOSApp)
			w2ui['editbar'].enable('closemobile');
		if (notifyBackend)
			this._sendCloseWindow(dialogId);
		$('#' + this._toStrId(dialogId)).remove();
		this._map.focus();
		delete this._dialogs[dialogId];
		this._currentId = null;

		removeZoomTarget(this._toStrId(dialogId));
	},

	onCloseCurrentPopUp: function() {
		// for title-less dialog only (context menu, pop-up)
		if (!this._currentId || !this._isOpen(this._currentId) || this._dialogs[this._currentId].title)
			return;
		this._onDialogClose(this._currentId, true);
	},

	_closeSidebar: function() {
		for (var dialog in this._dialogs) {
			if (this._dialogs[dialog].isSidebar == true) {
				this._onSidebarClose(dialog);
			}
		}
		$('#sidebar-dock-wrapper').css({display: ''});
	},

	_onEditorGotFocus: function() {
		// We need to lose focus on any dialogs/sidebars currently with focus.
		for (var winId in this._dialogs) {
			$('#' + this._dialogs[winId].strId + '-cursor').css({display: 'none'});
		}
	},

	_paintDialog: function(parentId, rectangle, imgData) {

		var strId = this._toStrId(parentId);
		var canvas = document.getElementById(strId + '-canvas');
		if (!canvas)
			return; // no window to paint to

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

			// Sidebars find out their size and become visible on first paint.
			var isSidebar = that._isSidebar(parentId);
			if (isSidebar) {
				that._resizeSidebar(strId, that._currentDeck.width);

				// Update the underlying canvas.
				var panelCanvas = L.DomUtil.get(that._currentDeck.strId + '-canvas');
				that._setCanvasWidthHeight(panelCanvas, that._currentDeck.width, that._currentDeck.height);
			}

			ctx.drawImage(img, x, y);

			// if dialog is hidden, show it
			var container = L.DomUtil.get(strId);
			if (container)
				$(container).parent().show();
			that.focus(parentId, !isSidebar);
		};
		img.src = imgData;
	},

	// Binary dialog msg recvd from core
	_onDialogPaint: function (e) {
		var parentId = this._getParentId(e.id);
		if (parentId) {
			this._paintDialogChild(parentId, e.img);
		} else {
			this._paintDialog(e.id, e.rectangle, e.img);
		}
	},

	// Dialog Child Methods

	_paintDialogChild: function(parentId, imgData) {
		var strId = this._toStrId(parentId);
		var canvas = L.DomUtil.get(strId + '-floating');
		if (!canvas)
			return; // no floating window to paint to

		// The image is rendered per the HiDPI scale we used
		// while requesting rendering the image. Here we
		// set the canvas to have the actual size, while
		// the image is rendred with the HiDPI scale.
		this._setCanvasWidthHeight(canvas, this._dialogs[parentId].childwidth,
										   this._dialogs[parentId].childheight);

		var ctx = canvas.getContext('2d');
		var img = new Image();
		img.onload = function() {
			ctx.drawImage(img, 0, 0);
			$(canvas).show();
		};
		img.src = imgData;
	},

	_resizeSidebar: function(strId, width) {
		this._currentDeck.width = width;
		if (width > 1) {
			// Add extra space for scrollbar only when visible
			width = width + 15;
		}
		var sidebar = L.DomUtil.get(strId);
		if (sidebar) {
			sidebar.width = width;
			if (sidebar.style)
				sidebar.style.width = width.toString() + 'px';
		}

		this._map.options.documentContainer.style.right = (width + 1).toString() + 'px';
		var spreadsheetRowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
		if (spreadsheetRowColumnFrame)
			spreadsheetRowColumnFrame.style.right = width.toString() + 'px';

		// If we didn't have the focus, don't steal it form the editor.
		if ($('#' + this._currentDeck.strId + '-cursor').css('display') === 'none') {
			this._map.fire('editorgotfocus');
			this._map.focus();
		}
	},

	_onDialogChildClose: function(dialogId) {
		$('#' + this._toStrId(dialogId) + '-floating').remove();
		if (!this._isSidebar(dialogId)) {
			// Remove any extra height allocated for the parent container (only for floating dialogs).
			var canvas = document.getElementById(dialogId + '-canvas');
			if (!canvas) {
				canvas = document.getElementById(this._toStrId(dialogId) + '-canvas');
				if (!canvas)
					return;
			}
			var canvasHeight = canvas.height;
			$('#' + dialogId).height(canvasHeight + 'px');
		}
	},

	_removeDialogChild: function(id) {
		$('#' + this._toStrId(id) + '-floating').remove();
	},

	_createDialogChild: function(childId, parentId, top, left) {
		var strId = this._toStrId(parentId);
		var dialogContainer = L.DomUtil.get(strId).parentNode;
		var floatingCanvas = L.DomUtil.create('canvas', 'lokdialogchild-canvas', dialogContainer);
		$(floatingCanvas).hide(); // Hide to avoid flickering while we set the dimensions.

		// Since child windows are now top-level, their 'top' offset
		// needs adjusting. If we are in a dialog, our top is from the
		// dialog body, not the title bar, which is a separate div.
		// This doesn't apply for context menus, which don't have titles.
		var dialogTitle = $('.lokdialog_notitle');
		if (dialogTitle != null && dialogTitle.length == 0) {
			var dialogTitleBar = $('.ui-dialog-titlebar');
			top += dialogTitleBar.outerHeight();
		}

		floatingCanvas.id = strId + '-floating';
		L.DomUtil.setStyle(floatingCanvas, 'position', 'absolute');
		L.DomUtil.setStyle(floatingCanvas, 'left', (left - 1) + 'px'); // Align drop-down list with parent.
		L.DomUtil.setStyle(floatingCanvas, 'top', top + 'px');
		L.DomUtil.setStyle(floatingCanvas, 'width', '0px');
		L.DomUtil.setStyle(floatingCanvas, 'height', '0px');

		// attach events
		this._setupChildEvents(childId, floatingCanvas);
	},

	_setupChildEvents: function(childId, canvas) {
		L.DomEvent.on(canvas, 'contextmenu', L.DomEvent.preventDefault);

		L.DomEvent.on(canvas, 'touchstart touchmove touchend', function(e) {
			L.DomEvent.preventDefault(e);
			var rect = canvas.getBoundingClientRect();
			var touchX = (e.type === 'touchend') ? e.changedTouches[0].clientX : e.targetTouches[0].clientX;
			var touchY = (e.type === 'touchend') ? e.changedTouches[0].clientY : e.targetTouches[0].clientY;
			touchX = touchX - rect.x;
			touchY = touchY - rect.y;
			if (e.type === 'touchstart')
			{
				firstTouchPositionX = touchX;
				firstTouchPositionY = touchY;
				this._postWindowGestureEvent(childId, 'panBegin', firstTouchPositionX, firstTouchPositionY, 0);
			}
			else if (e.type === 'touchend')
			{
				this._postWindowGestureEvent(childId, 'panEnd', firstTouchPositionX, firstTouchPositionY, firstTouchPositionY - touchY);
				if (previousTouchType === 'touchstart') {
					// Simulate mouse click
					this._postWindowMouseEvent('buttondown', childId, firstTouchPositionX, firstTouchPositionY, 1, this._map['mouse'].LOButtons.left, 0);
					this._postWindowMouseEvent('buttonup', childId, firstTouchPositionX, firstTouchPositionY, 1, this._map['mouse'].LOButtons.left, 0);
				}
				firstTouchPositionX = null;
				firstTouchPositionY = null;
			}
			else if (e.type === 'touchmove')
			{
				this._postWindowGestureEvent(childId, 'panUpdate', firstTouchPositionX, firstTouchPositionY, firstTouchPositionY - touchY);
			}
			previousTouchType = e.type;
		}, this);

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

L.control.lokDialog = function (options) {
	return new L.Control.LokDialog(options);
};
