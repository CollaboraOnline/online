/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.LokDialog used for displaying LOK dialogs
 */

/* global app $ L Hammer w2ui brandProductName UNOModifier */

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

		if (target.transformation.origin) {
			target.value.style[L.DomUtil.TRANSFORM_ORIGIN] = target.transformation.origin;
		}
	}
}

var draggedObject = null;

var zoomTargets = [];

function findZoomTarget(id) {
	for (var item in zoomTargets) {
		if (zoomTargets[item].key === id || zoomTargets[item].titlebar.id === id) {
			return zoomTargets[item];
		}
	}
	return null;
}

function removeZoomTarget(id) {
	for (var item in zoomTargets) {
		if (zoomTargets[item].key === id || zoomTargets[item].titlebar.id === id) {
			delete zoomTargets[item];
		}
	}
}

function toZoomTargetId(id) {
	return id.replace('-canvas', '');
}

L.Control.LokDialog = L.Control.extend({

	dialogIdPrefix: 'lokdialog-',

	hasDialogInMobilePanelOpened: function() {
		return window.mobileDialogId !== undefined;
	},

	onPan: function (ev) {
		if (!draggedObject)
			return;

		var id = toZoomTargetId(draggedObject.id);
		var target = findZoomTarget(id);

		if (target) {
			var newX = target.initialState.startX + ev.deltaX;
			var newY = target.initialState.startY + ev.deltaY;

			// Don't allow to put dialog outside the view
			if (window.mode.isDesktop() &&
				(newX < -target.width/2 || newY < -target.height/2
				|| newX > window.innerWidth - target.width/2
				|| newY > window.innerHeight - target.height/2)) {
				var dialog = $('.lokdialog_container');
				var left = parseFloat(dialog.css('left'));
				var top = parseFloat(dialog.css('top'));
				newX = Math.max(newX, -left);
				newY = Math.max(newY, -top);
			}

			target.transformation.translate = {
				x: newX,
				y: newY
			};

			target.transformation.translate = {
				x: newX,
				y: newY
			};

			updateTransformation(target);
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
		map.on('docloaded', this._docLoaded, this);
		map.on('closepopup', this.onCloseCurrentPopUp, this);
		map.on('closepopups', this._onClosePopups, this);
		map.on('editorgotfocus', this._onEditorGotFocus, this);
		// Fired to signal that the input focus is being changed.
		map.on('changefocuswidget', this._changeFocusWidget, this);
		L.DomEvent.on(document, 'mouseup', this.onCloseCurrentPopUp, this);
	},

	_dialogs: {},
	_calcInputBar: null, // The Formula-Bar.

	hasOpenedDialog: function() {
		var nonDialogEntries = 0;
		for (var index in this._dialogs) {
			if (this._dialogs[index].isCalcInputBar)
				nonDialogEntries++;
		}

		return Object.keys(this._dialogs).length > nonDialogEntries;
	},

	// method used to warn user about dialog modality
	blinkOpenDialog: function() {
		$('.lokdialog_container').addClass('lokblink');
		setTimeout(function () {
			$('.lokdialog_container').removeClass('lokblink');
		}, 600);
	},

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
		return (id in this._dialogs) && this._dialogs[id] &&
			$('#' + this._toStrId(id)).length > 0;
	},

	isCalcInputBar: function(id) {
		return (id in this._dialogs) && this._dialogs[id].isCalcInputBar;
	},

	isCursorVisible: function(id) {
		return (id in this._dialogs) && this._dialogs[id].cursorVisible;
	},

	_isSelectionHandle: function(el) {
		return L.DomUtil.hasClass(el, 'leaflet-selection-marker-start')	||
			L.DomUtil.hasClass(el, 'leaflet-selection-marker-end');
	},

	_isSelectionHandleDragged: function() {
		if (this._calcInputBar) {
			var selectionInfo = this._calcInputBar.textSelection;
			return (selectionInfo.startHandle && selectionInfo.startHandle.isDragged) ||
				(selectionInfo.endHandle && selectionInfo.endHandle.isDragged);
		}
		return false;
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
		if (!width && id !== null)
			width = this._dialogs[parseInt(id)].width;
		if (!width || width <= 0)
			return null;
		if (!height && id !== null)
			height = this._dialogs[parseInt(id)].height;
		if (!height || height <= 0)
			return null;
		if (!x)
			x = 0;
		if (!y)
			y = 0;

		// pre-multiplied by the scale factor
		return [x * app.roundedDpiScale, y * app.roundedDpiScale, width * app.roundedDpiScale, height * app.roundedDpiScale].join(',');
	},

	_sendPaintWindowRect: function(id, x, y, width, height) {
		this._sendPaintWindow(id, this._createRectStr(id, x, y, width, height));
	},

	_debugPaintWindow: function(id, rectangle) {
		var strId = this._toStrId(id);
		var canvas = document.getElementById(strId + '-canvas');
		if (!canvas)
			return; // no window to paint to
		var ctx = canvas.getContext('2d');
		ctx.beginPath();
		var rect = rectangle.split(',');
		ctx.rect(rect[0], rect[1], rect[2], rect[3]);
		ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
		ctx.fill();
	},

	_sendPaintWindow: function(id, rectangle) {
		if (!rectangle)
			return; // Don't request rendering an empty area.

		rectangle = rectangle.replace(/ /g, '');
		if (!rectangle)
			return; // Don't request rendering an empty area.

		//window.app.console.log('_sendPaintWindow: rectangle: ' + rectangle + ', dpiscale: ' + dpiscale);
		app.socket.sendMessage('paintwindow ' + id + ' rectangle=' + rectangle + ' dpiscale=' + app.roundedDpiScale);

		if (this._map._docLayer && this._map._docLayer._debug)
			this._debugPaintWindow(id, rectangle);
	},

	_sendCloseWindow: function(id) {
		app.socket.sendMessage('windowcommand ' + id + ' close');
		// CSV and Macro Security Warning Dialogs are shown before the document load
		// In that state the document is not really loaded and closing or cancelling it
		// returns docnotloaded error. Instead of this we can return to the integration
		if (!this._map._docLoaded && !window._firstDialogHandled) {
			window.onClose();
		}
	},

	_isRectangleValid: function(rect) {
		rect = rect.split(',');
		return (!isNaN(parseInt(rect[0])) && !isNaN(parseInt(rect[1])) &&
				parseInt(rect[2]) >= 0 && parseInt(rect[3]) >= 0);
	},

	_onDialogMsg: function(e) {
		// window.app.console.log('onDialogMsg: id: ' + e.id + ', winType: ' + e.winType + ', action: ' + e.action + ', size: ' + e.size + ', rectangle: ' + e.rectangle);
		if (e.winType != undefined &&
		    e.winType !== 'dialog' &&
		    e.winType !== 'calc-input-win' &&
		    e.winType !== 'child' &&
		    e.winType !== 'deck' &&
		    e.winType !== 'tooltip' &&
		    e.winType !== 'dropdown') {
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

		var lines = 0;

		if (e.title && typeof brandProductName !== 'undefined') {
			e.title = e.title.replace('Collabora Office', brandProductName);
		}

		if (e.action === 'created') {
			if ((e.winType === 'dialog' || e.winType === 'dropdown') && !window.mode.isMobile()) {
				// When left/top are invalid, the dialog shows in the center.
				this._launchDialog(e.id, left, top, width, height, e.title);
			} else if (e.winType === 'calc-input-win') {
				lines = parseInt(e.lines);
				this._launchCalcInputBar(e.id, left, top, width, height, lines);
			} else if (e.winType === 'child' || e.winType === 'tooltip') {
				var parentId = parseInt(e.parentId);
				if (!this._isOpen(parentId))
					return;

				// In case of tooltips, do not remove the previous popup
				// only if that's also a tooltip.
				if (e.winType === 'tooltip' &&
				    this._dialogs[parentId].childid !== undefined &&
				    this._dialogs[parentId].childistooltip !== true)
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

				if (e.winType === 'tooltip')
					this._dialogs[parentId].childistooltip = true;
				else
					this._dialogs[parentId].childistooltip = false;
				this._createDialogChild(e.id, parentId, top, left);
				this._sendPaintWindow(e.id, this._createRectStr(null, 0, 0, width, height));
			}
		}

		// All other callbacks don't make sense without an active dialog.
		if (!(this._isOpen(e.id) || this._getParentId(e.id))) {
			if (e.action == 'close' && window.mobileDialogId == e.id) {
				window.mobileDialogId = undefined;
				this._map.fire('closemobilewizard');
			}
			return;
		}

		// We don't want dialogs on smartphones, only calc input window is allowed
		if (window.mode.isMobile() && e.winType !== 'calc-input-win' && !this.isCalcInputBar(e.id))
			return;

		if (e.action === 'invalidate') {
			this.wasInvalidated = true;
			var parent = this._getParentId(e.id);
			var rectangle = e.rectangle;
			if (parent) { // this is a floating window
				if (e.rectangle && this._dialogs[parent].childistooltip === true) {
					// resize tooltips on invalidation
					this._removeDialogChild(parent);
					left = this._dialogs[parent].childx;
					top = this._dialogs[parent].childy;
					width = parseInt(e.rectangle.split(',')[2]);
					height = parseInt(e.rectangle.split(',')[3]);
					this._dialogs[parent].childwidth = width;
					this._dialogs[parent].childheight = height;
					this._createDialogChild(e.id, parent, top, left);
				}

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
			if (e.winType === 'calc-input-win' || this.isCalcInputBar(e.id)) {
				lines = parseInt(e.lines);
				left = left || this._calcInputBar.left;
				top = top || this._calcInputBar.top;
				this._launchCalcInputBar(e.id, left, top, width, height, lines);
			}
			else {
				$('#' + strId).remove();
				this._launchDialog(e.id, null, null, width, height, this._dialogs[parseInt(e.id)].title);
			}
			if (this._map._docLayer && this._map._docLayer._docType === 'spreadsheet') {
				if (this._map._docLayer._painter._sectionContainer.doesSectionExist(L.CSections.RowHeader.name)) {
					this._map._docLayer._painter._sectionContainer.getSectionWithName(L.CSections.RowHeader.name)._updateCanvas();
					this._map._docLayer._painter._sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name)._updateCanvas();
				}
			}
		} else if (e.action === 'cursor_invalidate') {
			if (this._isOpen(e.id) && !!e.rectangle) {
				rectangle = e.rectangle.split(',');
				var x = parseInt(rectangle[0]);
				var y = parseInt(rectangle[1]);
				height = parseInt(rectangle[3]);

				this._updateDialogCursor(e.id, x, y, height);
			}
		} else if (e.action === 'text_selection') {
			if (this._isOpen(e.id)) {
				var rectangles = [];
				var startHandleVisible, endHandleVisible;
				if (e.rectangles) {
					var dataList = e.rectangles.match(/\d+/g);
					if (dataList != null) {
						for (var i = 0; i < dataList.length; i += 4) {
							var rect = {};
							rect.x = parseInt(dataList[i]);
							rect.y = parseInt(dataList[i + 1]);
							rect.width = parseInt(dataList[i + 2]);
							rect.height = parseInt(dataList[i + 3]);
							rectangles.push(rect);
						}
					}
				}

				if (e.startHandleVisible) {
					startHandleVisible = e.startHandleVisible === 'true';
				}
				if (e.endHandleVisible) {
					endHandleVisible = e.endHandleVisible === 'true';
				}
				this._updateTextSelection(e.id, rectangles, startHandleVisible, endHandleVisible);
			}
		} else if (e.action === 'title_changed') {
			if (e.title && this._dialogs[parseInt(e.id)]) {
				this._dialogs[parseInt(e.id)].title = e.title;
				$('#' + strId).dialog('option', 'title', e.title);
			}
		} else if (e.action === 'cursor_visible') {
			// cursor_visible implies focus has changed, but can
			// be misleading when it flips back on forth on typing!
			var visible = (e.visible === 'true');
			this._dialogs[e.id].cursorVisible = visible;
			if (visible) {
				$('#' + strId + '-cursor').css({display: 'block'});
				this._map.fire('changefocuswidget', {winId: e.id, dialog: this, acceptInput: true}); // Us.
			}
			else {
				$('#' + strId + '-cursor').css({display: 'none'});
			}
		} else if (e.action === 'close') {
			parent = this._getParentId(e.id);
			if (parent)
				this._onDialogChildClose(parent);
			else if (this.isCalcInputBar(e.id))
				this._onCalcInputBarClose(e.id);
			else
				this._onDialogClose(e.id, false);
		} else if (e.action === 'hide') {
			$('#' + strId).parent().css({display: 'none'});
		} else if (e.action === 'show') {
			$('#' + strId).parent().css({display: 'block'});
		}
	},

	_updateDialogCursor: function(dlgId, x, y, height) {
		var strId = this._toStrId(dlgId);
		var dialogCursor = L.DomUtil.get(strId + '-cursor');
		var cursorVisible = this.isCursorVisible(dlgId);
		L.DomUtil.setStyle(dialogCursor, 'height', height + 'px');
		L.DomUtil.setStyle(dialogCursor, 'display', cursorVisible ? 'block' : 'none');
		// set the position of the cursor container element
		L.DomUtil.setStyle(this._dialogs[dlgId].cursor, 'left', x + 'px');
		L.DomUtil.setStyle(this._dialogs[dlgId].cursor, 'top', y + 'px');

		// Make sure the keyboard is visible if there is a cursor.
		// But don't hide the keyboard otherwise.
		// At least the formula-input hides the cursor after each key input.
		if (cursorVisible)
			this._map.focus(true);
	},

	_createDialogCursor: function(dialogId) {
		var id = this._toIntId(dialogId);
		this._dialogs[id].cursor = L.DomUtil.create('div', 'leaflet-cursor-container', L.DomUtil.get(dialogId));
		var cursor = L.DomUtil.create('div', 'leaflet-cursor lokdialog-cursor', this._dialogs[id].cursor);
		cursor.id = dialogId + '-cursor';
		L.DomUtil.addClass(cursor, 'blinking-cursor');
	},

	_updateTextSelection: function(dlgId, rectangles, startHandleVisible, endHandleVisible) {
		var strId = this._toIntId(dlgId);
		var selections = this._dialogs[strId].textSelection.rectangles;
		L.DomUtil.empty(selections);
		var handles = this._dialogs[strId].textSelection.handles;
		var startHandle, endHandle;
		if (startHandleVisible) {
			startHandle = this._dialogs[strId].textSelection.startHandle;
		} else if (handles.start) {
			L.DomUtil.remove(handles.start);
			handles.start = null;
		}
		if (endHandleVisible) {
			endHandle = this._dialogs[strId].textSelection.endHandle;
		}  else if (handles.end) {
			L.DomUtil.remove(handles.end);
			handles.end = null;
		}

		if (!handles.start && !handles.end)
			handles.draggingStopped = true;

		if (!rectangles || rectangles.length < 1) {
			return;
		}

		for (var i = 0; i < rectangles.length; ++i) {
			var container = L.DomUtil.create('div', 'leaflet-text-selection-container', selections);
			var selection = L.DomUtil.create('div', 'leaflet-text-selection', container);
			var rect = rectangles[i];
			L.DomUtil.setStyle(selection, 'width', rect.width + 'px');
			L.DomUtil.setStyle(selection, 'height', rect.height + 'px');
			L.DomUtil.setStyle(container, 'left',  rect.x + 'px');
			L.DomUtil.setStyle(container, 'top', rect.y + 'px');
		}

		var startPos;
		if (startHandle) {
			var startRect = rectangles[0];
			if (startRect.width < 1)
				return;
			startRect = {x: startRect.x, y: startRect.y, width: 1, height: startRect.height};
			startPos = L.point(startRect.x, startRect.y + startRect.height);
			startPos = startPos.subtract(L.point(0, 2));
			startHandle.lastPos = startPos;
			startHandle.rowHeight = startRect.height;
		}

		var endPos;
		if (endHandle) {
			var endRect = rectangles[rectangles.length - 1];
			if (endRect.width < 1)
				return;
			endRect = {x: endRect.x + endRect.width - 1, y: endRect.y, width: 1, height: endRect.height};
			endPos = L.point(endRect.x, endRect.y + endRect.height);
			endPos = endPos.subtract(L.point(0, 2));
			endHandle.lastPos = endPos;
			endHandle.rowHeight = endRect.height;
		}

		if (startHandle && handles.draggingStopped) {
			if (!handles.start)
				handles.start = handles.appendChild(startHandle);
			// window.app.console.log('lokdialog: _updateTextSelection: startPos: x: ' + startPos.x + ', y: ' + startPos.y);
			startHandle.pos = startPos;
			L.DomUtil.setStyle(startHandle, 'left',  startPos.x + 'px');
			L.DomUtil.setStyle(startHandle, 'top', startPos.y + 'px');
		}

		if (endHandle && handles.draggingStopped) {
			if (!handles.end)
				handles.end = handles.appendChild(endHandle);
			// window.app.console.log('lokdialog: _updateTextSelection: endPos: x: ' + endPos.x + ', y: ' + endPos.y);
			endHandle.pos = endPos;
			L.DomUtil.setStyle(endHandle, 'left',  endPos.x + 'px');
			L.DomUtil.setStyle(endHandle, 'top', endPos.y + 'px');
		}
	},

	_onSelectionHandleDragStart: function (e) {
		L.DomEvent.stop(e);
		var handles = e.target.parentNode;
		var mousePos = L.DomEvent.getMousePosition(e.pointers ? e.srcEvent : e, handles);
		e.target.isDragged = true;
		e.target.dragStartPos = mousePos;

		// single input line: check if after moving to a new line the handles have swapped position
		if (handles.scrollDir !== 0 && handles.start && handles.end) {
			var startDX = Math.abs(handles.beforeScrollingPosX - handles.start.pos.x);
			var endDX = Math.abs(handles.beforeScrollingPosX - handles.end.pos.x);
			if (handles.scrollDir === -1 && handles.lastDraggedHandle === 'end' && startDX < endDX) {
				handles.lastDraggedHandle = 'start';
			} else if (handles.scrollDir === 1 && handles.lastDraggedHandle === 'start' && endDX < startDX) {
				handles.lastDraggedHandle = 'end';
			}
		}

		handles.scrollDir = 0;
		handles.beforeScrollingPosX = 0;
		handles.draggingStopped = false;
		if (!handles.lastDraggedHandle)
			handles.lastDraggedHandle = 'end';
		var swap = handles.lastDraggedHandle !== e.target.type;
		// check if we need to notify the lok core of swapping the mark/cursor roles
		if (swap) {
			handles.lastDraggedHandle = e.target.type;
			var pos = e.target.pos;
			app.socket.sendMessage('windowselecttext id=' + e.target.dialogId +
				                          ' swap=true x=' + pos.x + ' y=' + pos.y);
		}
	},

	_onSelectionHandleDrag: function (e) {
		var handles = this._calcInputBar.textSelection.handles;
		var startHandle = handles.start;
		var endHandle = handles.end;

		var dragEnd = e.type === 'mouseup' || e.type === 'panend';
		// when stopDragging is true we do not update the text selection
		// further even if the dragging action is not over
		var stopDragging = dragEnd || e.type === 'mouseout';

		// single input line: dragging with no text selected -> move to previous/next line
		var keyCode = 0;
		if (dragEnd && (!startHandle || !startHandle.isDragged) && (!endHandle || !endHandle.isDragged)) {
			if (e.deltaX > 30 || e.deltaY > 20)
				keyCode = 1025; // ArrowUp
			else if (e.deltaX < -30 || e.deltaY < -20)
				keyCode = 1024; // ArrowDown
			if (keyCode) {
				this._map._docLayer.postKeyboardEvent('input', 0, keyCode);
				this._map._textInput._emptyArea();
				this._map._docLayer.postKeyboardEvent('up', 0, keyCode);
			}
			return;
		}

		var draggedHandle;
		if (startHandle && startHandle.isDragged)
			draggedHandle = startHandle;
		else if (endHandle && endHandle.isDragged)
			draggedHandle = endHandle;
		if (!draggedHandle)
			return;
		if (dragEnd)
			draggedHandle.isDragged = false;
		if (handles.draggingStopped)
			return;
		if (stopDragging)
			handles.draggingStopped = true;

		var mousePos = L.DomEvent.getMousePosition(e.pointers ? e.srcEvent : e, handles);
		var pos = draggedHandle.pos.add(mousePos.subtract(draggedHandle.dragStartPos));

		// try to avoid unpleasant small vertical bouncing when dragging the handle horizontally
		if (Math.abs(pos.y - draggedHandle.lastPos.y) < 6) {
			pos.y = draggedHandle.lastPos.y;
		}

		// try to avoid to swap the handles position when they are both visible
		if (startHandle && draggedHandle.type === 'end') {
			if (startHandle.pos.y - pos.y > 2)
				pos.y = draggedHandle.lastPos.y;
			if (startHandle.pos.y - pos.y > -2 && pos.x - startHandle.pos.x < 2)
				pos = draggedHandle.lastPos;
		}
		if (endHandle && draggedHandle.type === 'start') {
			if (pos.y - endHandle.pos.y > 2)
				pos.y = draggedHandle.lastPos.y;
			if (pos.y - endHandle.pos.y > -endHandle.rowHeight && endHandle.pos.x - pos.x < 2)
				pos = draggedHandle.lastPos;
		}

		var dragAreaWidth = parseInt(handles.style.width);
		var dragAreaHeight = parseInt(handles.style.height);
		var maxX = dragAreaWidth - 5;
		var maxY = dragAreaHeight - 5;

		// handle cases where the handle is dragged out of the input area
		if (pos.x < handles.offsetX)
			pos.x = stopDragging ? draggedHandle.lastPos.x : handles.offsetX;
		else if (pos.x > maxX)
			pos.x = stopDragging ? draggedHandle.lastPos.x : maxX;

		if (pos.y < handles.offsetY) {
			handles.scrollDir = -1;
			keyCode = 5121; // Shift + ArrowUp
			pos.y = stopDragging ? draggedHandle.lastPos.y : handles.offsetY;
		}
		else if (pos.y > maxY) {
			if (pos.y > dragAreaHeight - 1 || e.type === 'mouseout') { // on desktop mouseout works better
				handles.scrollDir = 1;
				keyCode = 5120; // Shift + ArrowDown
			}
			pos.y = stopDragging ? draggedHandle.lastPos.y : maxY;
		}

		if (keyCode)
			handles.draggingStopped = true;

		var handlePos = pos;
		if (stopDragging) {
			handlePos = draggedHandle.lastPos;
			draggedHandle.pos = pos;
		}

		L.DomUtil.setStyle(draggedHandle, 'left', handlePos.x + 'px');
		L.DomUtil.setStyle(draggedHandle, 'top', handlePos.y + 'px');
		app.socket.sendMessage('windowselecttext id=' + draggedHandle.dialogId +
			                          ' swap=false x=' + pos.x + ' y=' + pos.y);

		// check if we need to move to previous/next line
		if (keyCode) {
			handles.beforeScrollingPosX = pos.x;
			this._map._docLayer.postKeyboardEvent('input', 0, keyCode);
			this._map._textInput._emptyArea();
			this._map._docLayer.postKeyboardEvent('up', 0, keyCode);
		}
	},

	focus: function(dlgId, acceptInput) {
		if (this.isCalcInputBar(dlgId) && (!this._isOpen(dlgId) || !this.isCursorVisible(dlgId))) {
			return;
		}

		this._map.setWinId(dlgId);
		if (dlgId in this._dialogs) {
			this._map.focus(acceptInput);
		}
	},

	_setCanvasWidthHeight: function(canvas, width, height) {
		var newWidth = width * app.roundedDpiScale;
		var changed = false;
		if (canvas.width != newWidth) {
			L.DomUtil.setStyle(canvas, 'width', width + 'px');
			canvas.width = newWidth;
			changed = true;
		}

		var newHeight = height * app.roundedDpiScale;
		if (canvas.height != newHeight) {
			L.DomUtil.setStyle(canvas, 'height', height + 'px');
			canvas.height = newHeight;
			changed = true;
		}
		return changed;
	},

	_launchDialog: function(id, leftTwips, topTwips, width, height, title, type) {
		if (window.ThisIsTheiOSApp) {
			if (w2ui['editbar'])
				w2ui['editbar'].disable('closemobile');
		}
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
			draggable: false,
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
				$(dialogContainer).dialog('option', 'position',
							  { my: 'left top',
							    at: 'left+' + left + ' top+' + top,
							    of: type === 'dropdown' ? '#map' :
							    '#document-container' });
			}
		}

		// don't show the dialog surround until we have the dialog content
		$(dialogContainer).parent().hide();

		// Override default minHeight, which can be too large for thin dialogs.
		L.DomUtil.setStyle(dialogContainer, 'minHeight', height + 'px');

		this._dialogs[id] = {
			id: id,
			strId: strId,
			isCalcInputBar: false,
			width: width,
			height: height,
			cursor: null,
			title: title
		};

		// don't make 'TAB' focus on this button; we want to cycle focus in the lok dialog with each TAB
		$('.lokdialog_container button.ui-dialog-titlebar-close').attr('tabindex', '-1').blur();

		this._createDialogCursor(strId);
		this._setupWindowEvents(id, dialogCanvas/*, dlgInput*/);
		this._setupGestures(dialogContainer, id, dialogCanvas);

		this._currentId = id;
		this._sendPaintWindow(id, this._createRectStr(id));
	},

	_launchCalcInputBar: function(id, left, top, width, height, textLines) {
		// window.app.console.log('_launchCalcInputBar: start: id: ' + id + ', left: ' + left + ', top: ' + top
		// 	+ ', width: ' + width + ', height: ' + height + ', textLines: ' + textLines);
		if (!this._calcInputBar || this._calcInputBar.id !== id) {
			if (this._calcInputBar)
				$('#' + this._calcInputBar.strId).remove();
			this._createCalcInputbar(id, left, top, width, height, textLines);
		} else {
			// Update in-place. We will resize during rendering.
			this._adjustCalcInputBar(id, left, top, width, height, textLines);
		}

		// window.app.console.log('_launchCalcInputBar: end');
	},

	_adjustCalcInputBar: function(id, left, top, width, height, textLines) {
		if (this._calcInputBar) {
			var oldHeight = this._calcInputBar.height;
			var oldX = this._calcInputBar.left;
			var oldY = this._calcInputBar.top;
			var delta = height - oldHeight;
			if (delta !== 0 || oldX !== left || oldY !== top) {
				// window.app.console.log('_adjustCalcInputBar: start: id: ' + id + ', height: ' + oldHeight + ' -> ' + height);

				// Recreate the input-bar.
				$('#' + this._calcInputBar.strId).remove();
				this._createCalcInputbar(id, left, top, width, height, textLines);

				// window.app.console.log('_adjustCalcInputBarHeight: end');
			}

			var oldWidth = this._calcInputBar.width;
			delta = width - oldWidth;
			if (delta !== 0) {
				// window.app.console.log('_adjustCalcInputBar: start: id: ' + id + ', width: ' + oldWidth + ' -> ' + width);

				var strId = this._toStrId(id);

				var canvas = document.getElementById(strId + '-canvas');
				this._setCanvasWidthHeight(canvas, width, height);

				var handles = document.getElementById(strId + '-selection_handles');
				this._setCanvasWidthHeight(handles, width, height);

				this._calcInputBar.width = width;
			}
		}
	},

	_createCalcInputbar: function(id, left, top, width, height, textLines) {
		// window.app.console.log('_createCalcInputBar: start: id: ' + id + ', width: ' + width + ', height: ' + height + ', textLines: ' + textLines);
		var strId = this._toStrId(id);

		$('#calc-inputbar-wrapper').css({display: 'block'});

		var container = L.DomUtil.create('div', 'inputbar_container', L.DomUtil.get('calc-inputbar'));
		container.id = strId;
		L.DomUtil.setStyle(container, 'width', '100%');
		L.DomUtil.setStyle(container, 'height', height + 'px');

		if (textLines > 1) {
			$('#formulabar').addClass('inputbar_multiline');
		} else {
			$('#formulabar').removeClass('inputbar_multiline');
		}

		//var eventLayer = L.DomUtil.create('div', '', container);
		// Create the canvas.
		var canvas = L.DomUtil.create('canvas', 'inputbar_canvas', container);
		L.DomUtil.setStyle(canvas, 'position', 'absolute');
		this._setCanvasWidthHeight(canvas, width, height);
		canvas.id = strId + '-canvas';

		// create the text selections layer
		var textSelectionLayer = L.DomUtil.create('div', 'inputbar_selection_layer', container);
		var selections =  L.DomUtil.create('div', 'inputbar_selections', textSelectionLayer);

		// create text selection handles
		var handles =  L.DomUtil.create('div', 'inputbar_selection_handles', textSelectionLayer);
		handles.id = strId + '-selection_handles';
		L.DomUtil.setStyle(handles, 'position', 'absolute');
		L.DomUtil.setStyle(handles, 'background', 'transparent');
		this._setCanvasWidthHeight(handles, width, height);
		handles.draggingStopped = true;
		handles.scrollDir = 0;
		handles.offsetX = window.mode.isMobile() ? 0 : 48; // 48 with sigma and equal buttons
		handles.offsetY = 0;
		var startHandle = document.createElement('div');
		L.DomUtil.addClass(startHandle, 'leaflet-selection-marker-start');
		startHandle.dialogId = id;
		startHandle.type = 'start';
		L.DomEvent.on(startHandle, 'mousedown', this._onSelectionHandleDragStart, this);
		var endHandle = document.createElement('div');
		L.DomUtil.addClass(endHandle, 'leaflet-selection-marker-end');
		endHandle.dialogId = id;
		endHandle.type = 'end';
		L.DomEvent.on(endHandle, 'mousedown', this._onSelectionHandleDragStart, this);

		// Don't show the inputbar until we get the contents.
		$(container).parent().hide();

		this._dialogs[id] = {
			open: true,
			id: id,
			strId: strId,
			isCalcInputBar: true,
			left: left,
			top: top,
			width: width,
			height: height,
			textLines: textLines,
			cursor: null,
			textSelection: {rectangles: selections, handles: handles, startHandle: startHandle, endHandle: endHandle},
			child: null, // never used for inputbar
			title: null  // never used for inputbar
		};

		this._calcInputBar = this._dialogs[id];

		this._createDialogCursor(strId);

		this._postLaunch(id, container, handles);
		this._setupCalcInputBarGestures(id, handles, startHandle, endHandle);

		this._calcInputbarContainerWidth = width;
		this._calcInputbarContainerHeight = height;

		// window.app.console.log('_createCalcInputBar: end');
	},

	_postLaunch: function(id, panelContainer, panelCanvas) {
		if (!this.isCalcInputBar(id) || window.mode.isDesktop()) {
			this._setupWindowEvents(id, panelCanvas/*, dlgInput*/);
		}

		// Render window.
		this._sendPaintWindowRect(id);
	},

	_setupWindowEvents: function(id, canvas/*, dlgInput*/) {
		L.DomEvent.on(canvas, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.on(canvas, 'mousemove', function(e) {
			if (this._isSelectionHandleDragged()) {
				this._onSelectionHandleDrag(e);
				return;
			}

			var pos = this._isSelectionHandle(e.target) ? L.DomEvent.getMousePosition(e, canvas) : {x: e.offsetX, y: e.offsetY};
			if (this.isCalcInputBar(id)) {
				pos.x += this._calcInputBar.left;
				pos.y += this._calcInputBar.top;
			}
			this._postWindowMouseEvent('move', id, pos.x, pos.y, 1, 0, 0);
		}, this);

		L.DomEvent.on(canvas, 'mouseleave', function(e) {
			if (this._isSelectionHandleDragged()) {
				this._onSelectionHandleDrag(e);
			}
		}, this);

		L.DomEvent.on(canvas, 'mousedown mouseup', function(e) {
			L.DomEvent.preventDefault(e);

			if (this._map.uiManager.isUIBlocked())
				return;

			if (this.isCalcInputBar(id) && this.hasOpenedDialog()) {
				this.blinkOpenDialog();
				return;
			}

			if (this._isSelectionHandleDragged() && e.type === 'mouseup') {
				this._onSelectionHandleDrag(e);
				return;
			}

			if (canvas.lastDraggedHandle)
				canvas.lastDraggedHandle = null;

			var buttons = 0;
			if (this._map['mouse']) {
				buttons |= e.button === this._map['mouse'].JSButtons.left ? this._map['mouse'].LOButtons.left : 0;
				buttons |= e.button === this._map['mouse'].JSButtons.middle ? this._map['mouse'].LOButtons.middle : 0;
				buttons |= e.button === this._map['mouse'].JSButtons.right ? this._map['mouse'].LOButtons.right : 0;
			} else {
				buttons = 1;
			}

			var modifier = 0;
			var shift = e.shiftKey ? UNOModifier.SHIFT : 0;
			var ctrl = e.ctrlKey ? UNOModifier.CTRL : 0;
			var alt = e.altKey ? UNOModifier.ALT : 0;
			var cmd = e.metaKey ? UNOModifier.CTRLMAC : 0;
			modifier = shift | ctrl | alt | cmd;

			// 'mousedown' -> 'buttondown'
			var lokEventType = e.type.replace('mouse', 'button');
			var pos = this._isSelectionHandle(e.target) ? L.DomEvent.getMousePosition(e, canvas) : {x: e.offsetX, y: e.offsetY};
			if (this.isCalcInputBar(id)) {
				pos.x += this._calcInputBar.left;
				pos.y += this._calcInputBar.top;
			}
			this._postWindowMouseEvent(lokEventType, id, pos.x, pos.y, 1, buttons, modifier);
			this._map.setWinId(id);
			//dlgInput.focus();
		}, this);

		L.DomEvent.on(canvas, 'click', function(ev) {
			// Clicking on the dialog's canvas shall not trigger any
			// focus change - therefore the event is stopped and preventDefault()ed.
			L.DomEvent.stop(ev);
		});
	},

	_setupCalcInputBarGestures: function(id, canvas, startHandle, endHandle) {
		if (window.mode.isDesktop())
			return;

		var hammerContent = new Hammer.Manager(canvas, {});
		var that = this;
		var singleTap = new Hammer.Tap({event: 'singletap' });
		var doubleTap = new Hammer.Tap({event: 'doubletap', taps: 2 });
		var pan = new Hammer.Pan({event: 'pan' });
		hammerContent.add([doubleTap, singleTap, pan]);
		singleTap.requireFailure(doubleTap);


		hammerContent.on('singletap doubletap', function(ev) {
			var handles = that._calcInputBar.textSelection.handles;
			handles.lastDraggedHandle = null;
			var startHandle = handles.children[0];
			var endHandle = handles.children[1];
			if (startHandle)
				startHandle.isDragged = false;
			if (endHandle)
				endHandle.isDragged = false;

			var point = L.DomEvent.getMousePosition(ev.srcEvent, handles);
			point.x += that._calcInputBar.left;
			point.y += that._calcInputBar.top;

			that._postWindowMouseEvent('buttondown', id, point.x, point.y, 1, 1, 0);
			that._postWindowMouseEvent('buttonup', id, point.x, point.y, 1, 1, 0);
			if (ev.type === 'doubletap') {
				that._postWindowMouseEvent('buttondown', id, point.x, point.y, 1, 1, 0);
				that._postWindowMouseEvent('buttonup', id, point.x, point.y, 1, 1, 0);
			}
		});

		hammerContent.on('panmove panend', L.bind(this._onSelectionHandleDrag, this));

		var hammerEndHandle = new Hammer.Manager(endHandle, {recognizers:[[Hammer.Pan]]});
		hammerEndHandle.on('panstart',  L.bind(this._onSelectionHandleDragStart, this));

		var hammerStartHandle = new Hammer.Manager(startHandle, {recognizers:[[Hammer.Pan]]});
		hammerStartHandle.on('panstart',  L.bind(this._onSelectionHandleDragStart, this));
	},

	_setupGestures: function(dialogContainer, id, canvas) {
		var targetId = toZoomTargetId(canvas.id);
		var zoomTarget = $('#' + targetId).parent().get(0);
		var titlebar = $('#' + targetId).prev().children().get(0);

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
		};
		var transformation = {
			translate: { x: offsetX, y: offsetY },
			scale: ratio,
			angle: 0,
			rx: 0,
			ry: 0,
			rz: 0
		};

		// on mobile, force the positioning to the top, so that it is not
		// covered by the virtual keyboard
		if (window.mode.isMobile()) {
			$(dialogContainer).dialog('option', 'position', { my: 'center top', at: 'center top', of: '#document-container' });
			transformation.origin = 'center top';
			transformation.translate.y = 0;
		}

		if (findZoomTarget(targetId) != null) {
			removeZoomTarget(targetId);
		}
		zoomTargets.push({key: targetId, value: zoomTarget, titlebar: titlebar, transformation: transformation, initialState: state, width:width, height: height});

		var that = this;
		var hammerTitlebar = new Hammer(titlebar);
		hammerTitlebar.add(new Hammer.Pan({ threshold: 20, pointers: 0 }));
		hammerTitlebar.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith([hammerTitlebar.get('pan')]);

		hammerTitlebar.on('panstart', this.onPan);
		hammerTitlebar.on('panmove', this.onPan);
		hammerTitlebar.on('pinchstart pinchmove', this.onPinch);
		hammerTitlebar.on('hammer.input', function(ev) {
			if (ev.isFirst) {
				draggedObject = ev.target;
			}

			if (ev.isFinal && draggedObject) {
				var id = toZoomTargetId(draggedObject.id);
				var target = findZoomTarget(id);
				if (target) {
					target.initialState.startX = target.transformation.translate.x;
					target.initialState.startY = target.transformation.translate.y;
				}
				draggedObject = null;
			}
		});

		var hammerContent = new Hammer(canvas);
		hammerContent.add(new Hammer.Pan({ threshold: 20, pointers: 0 }));
		hammerContent.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith([hammerContent.get('pan')]);

		hammerContent.on('panstart', this.onPan);
		hammerContent.on('panmove', this.onPan);
		hammerContent.on('pinchstart pinchmove', this.onPinch);
		hammerContent.on('hammer.input', function(ev) {
			if (ev.isFirst) {
				that.wasInvalidated = false;
				draggedObject = ev.target;
			}
			else if (that.wasInvalidated) {
				draggedObject = null;
				that.wasInvalidated = false;
				return;
			}

			if (ev.isFinal && draggedObject) {
				var id = toZoomTargetId(draggedObject.id);
				var target = findZoomTarget(id);
				if (target) {
					target.initialState.startX = target.transformation.translate.x;
					target.initialState.startY = target.transformation.translate.y;
				}
				draggedObject = null;
			}
		});

		updateTransformation(findZoomTarget(targetId));
	},

	_postWindowMouseEvent: function(type, winid, x, y, count, buttons, modifier) {
		app.socket.sendMessage('windowmouse id=' + winid +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' count=' + count +
		                              ' buttons=' + buttons + ' modifier=' + modifier);
		// Keep map active while user is playing with dialog.
		this._map.lastActiveTime = Date.now();
	},

	_postWindowGestureEvent: function(winid, type, x, y, offset) {
		// window.app.console.log('x ' + x + ' y ' + y + ' o ' + offset);
		app.socket.sendMessage('windowgesture id=' + winid +  ' type=' + type +
		                              ' x=' + x + ' y=' + y + ' offset=' + offset);
		// Keep map active while user is playing with dialog.
		this._map.lastActiveTime = Date.now();
	},

	_onCalcInputBarClose: function(dialogId) {
		// window.app.console.log('_onCalcInputBarClose: start: id: ' + dialogId);
		$('#' + this._calcInputBar.strId).remove();
		this._map.focus();
		delete this._dialogs[dialogId];
		this._calcInputBar = null;

		$('#calc-inputbar-wrapper').css({display: ''});
		// window.app.console.log('_onCalcInputBarClose: end');
	},

	_closeChildWindows: function(dialogId) {
		// child windows - with greater id number
		var that = this;
		var foundCurrent = false;

		Object.keys(this._dialogs).forEach(function(id) {
			if (foundCurrent && !that._isCalcInputBar(id))
				that._onDialogClose(id, true);

			if (id == dialogId)
				foundCurrent = true;
		});
	},

	_onDialogClose: function(dialogId, notifyBackend) {
		this._closeChildWindows(dialogId);

		if (window.ThisIsTheiOSApp) {
			if (w2ui['editbar'])
				w2ui['editbar'].enable('closemobile');
		}

		if (notifyBackend)
			this._sendCloseWindow(dialogId);
		$('#' + this._toStrId(dialogId)).remove();

		// focus the main document
		this._map.fire('editorgotfocus');
		this._map.focus();

		delete this._dialogs[dialogId];
		this._currentId = null;

		removeZoomTarget(this._toStrId(dialogId));
	},

	_onClosePopups: function() {
		for (var dialogId in this._dialogs) {
			if (!this.isCalcInputBar(dialogId)) {
				this._onDialogClose(dialogId, true);
			}
		}
		if (this.hasDialogInMobilePanelOpened()) {
			this._onDialogClose(window.mobileDialogId, true);
		}
	},

	onCloseCurrentPopUp: function() {
		// for title-less dialog only (context menu, pop-up)
		if (this._currentId && this._isOpen(this._currentId) &&
			!this._dialogs[this._currentId].title && !this.isCalcInputBar(this._currentId))
			this._onDialogClose(this._currentId, true);
	},

	_onEditorGotFocus: function() {
		// We need to lose focus on any dialogs currently with focus.
		for (var winId in this._dialogs) {
			$('#' + this._dialogs[winId].strId + '-cursor').css({display: 'none'});
		}
	},

	// Focus is being changed, update states.
	_changeFocusWidget: function (e) {
		if (e.winId === 0) {
			// We lost the focus.
			this._onEditorGotFocus();
		} else {
			this.focus(e.winId, e.acceptInput);
			this._map.onFormulaBarFocus();
		}
	},

	_paintDialog: function(parentId, rectangle, img) {
		var strId = this._toStrId(parentId);
		var canvas = document.getElementById(strId + '-canvas');
		if (!canvas)
			return; // no window to paint to

		this._dialogs[parentId].isPainting = true;
		var ctx = canvas.getContext('2d');

		var that = this;
		var x = 0;
		var y = 0;
		if (rectangle) {
			rectangle = rectangle.split(',');
			x = parseInt(rectangle[0]);
			y = parseInt(rectangle[1]);
		}

		// calc input bar find out their size on first paint call
		var isCalcInputBar = that.isCalcInputBar(parentId);
		var container = L.DomUtil.get(strId);
		if (isCalcInputBar && container) {
			// window.app.console.log('_paintDialog: calc input bar: width: ' + that._calcInputBar.width);
			var canvas = L.DomUtil.get(that._calcInputBar.strId + '-canvas');
			var changed = that._setCanvasWidthHeight(canvas, that._calcInputBar.width, that._calcInputBar.height);
			$(container).parent().show(); // show or width is 0
			var deckOffset = 0;
			var sidebar = $('#sidebar-dock-wrapper');
			if (sidebar) {
				deckOffset = sidebar.get(0).clientWidth;
			}
			var correctWidth = container.clientWidth - deckOffset;

			// only touch styles & doc-layer sizing when absolutely necessary
			if (changed)
				that._map._docLayer._syncTileContainerSize();

			// resize the input bar to the correct size
			// the input bar is rendered only if when the size is the expected one
			if (correctWidth !== 0 && that._calcInputBar.width !== correctWidth) {
				// window.app.console.log('_paintDialog: correct width: ' + correctWidth + ', _calcInputBar width: ' + that._calcInputBar.width);
				that._dialogs[parentId].isPainting = false;
				app.socket.sendMessage('resizewindow ' + parentId + ' size=' + correctWidth + ',' + that._calcInputBar.height);
				return;
			}
		}

		ctx.drawImage(img, x, y);

		// if dialog is hidden, show it
		if (container)
			$(container).parent().show();

		if (parentId in that._dialogs) {
			// We might have closed the dialog by the time we render.
			that._dialogs[parentId].isPainting = false;
			if (!isCalcInputBar)
				that._map.fire('changefocuswidget', {winId: parentId, dialog: that});
		}
	},

	// Binary dialog msg recvd from core
	_onDialogPaint: function (e) {
		var id = parseInt(e.id);
		var parentId = this._getParentId(id);
		if (parentId) {
			this._paintDialogChild(parentId, e.img);
		} else {
			this._paintDialog(id, e.rectangle, e.img);
		}
	},

	// Dialog Child Methods

	_paintDialogChild: function(parentId, img) {
		var strId = this._toStrId(parentId);
		var canvas = L.DomUtil.get(strId + '-floating');
		if (!canvas)
			return; // no floating window to paint to

		// Make sure the child is not trimmed on the right.
		var width = this._dialogs[parentId].childwidth;
		var left = parseInt(canvas.style.left);
		var leftPos = left + width;
		if (leftPos > window.innerWidth) {
			var newLeft = window.innerWidth - width - 20;
			L.DomUtil.setStyle(canvas, 'left', newLeft + 'px');
		}
		// Also, make sure child is not trimmed on bottom.
		var top = parseInt(canvas.style.top);
		var height = this._dialogs[parentId].childheight;
		var bottomPos = top + height;
		if (bottomPos > window.innerHeight) {
			var newTop = top - height - 20;
			L.DomUtil.setStyle(canvas, 'top', newTop + 'px');
		}

		// The image is rendered per the HiDPI scale we used
		// while requesting rendering the image. Here we
		// set the canvas to have the actual size, while
		// the image is rendered with the HiDPI scale.
		this._setCanvasWidthHeight(canvas, this._dialogs[parentId].childwidth,
			this._dialogs[parentId].childheight);

		var ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0);
		$(canvas).show();
	},

	_resizeCalcInputBar: function() {
		if (this._calcInputBar && !this._calcInputBar.isPainting) {
			var id = this._calcInputBar.id;
			var calcInputbar = L.DomUtil.get('calc-inputbar');
			if (calcInputbar) {
				var calcInputbarContainer = calcInputbar.children[0];
				if (calcInputbarContainer) {
					var width = calcInputbarContainer.clientWidth;
					var height = calcInputbarContainer.clientHeight;
					if (width !== 0 && height !== 0) {
						if (width != this._calcInputbarContainerWidth || height != this._calcInputbarContainerHeight) {
							// window.app.console.log('_resizeCalcInputBar: id: ' + id + ', width: ' + width + ', height: ' + height);
							app.socket.sendMessage('resizewindow ' + id + ' size=' + width + ',' + height);
							this._calcInputbarContainerWidth = width;
							this._calcInputbarContainerHeight = height;
						}
					}
				}
			}
		}
	},

	_onDialogChildClose: function(dialogId) {
		$('#' + this._toStrId(dialogId) + '-floating').remove();
		if (!this.isCalcInputBar(dialogId)) {
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
		this._dialogs[dialogId].childid = undefined;
		this._dialogs[dialogId].childx = undefined;
		this._dialogs[dialogId].childy = undefined;
	},

	_removeDialogChild: function(id) {
		$('#' + this._toStrId(id) + '-floating').remove();
		this._dialogs[id].childid = undefined;
		this._dialogs[id].childx = undefined;
		this._dialogs[id].childy = undefined;
	},

	_createDialogChild: function(childId, parentId, top, left) {
		var strId = this._toStrId(parentId);
		var dialogContainer = L.DomUtil.get(strId);
		var floatingCanvas = L.DomUtil.create('canvas', 'lokdialogchild-canvas', dialogContainer);
		$(floatingCanvas).hide(); // Hide to avoid flickering while we set the dimensions.

		floatingCanvas.id = strId + '-floating';
		L.DomUtil.setStyle(floatingCanvas, 'position', 'fixed');
		L.DomUtil.setStyle(floatingCanvas, 'z-index', '11');
		L.DomUtil.setStyle(floatingCanvas, 'width', '0px');
		L.DomUtil.setStyle(floatingCanvas, 'height', '0px');

		/*
			Some notes:
				* Modal windows' child positions are relative to page borders.
				* So this code adapts to it.
		*/
		var containerTop = dialogContainer.getBoundingClientRect().top + dialogContainer.ownerDocument.defaultView.pageYOffset;
		var grandParentID = dialogContainer.parentNode.id;

		if (grandParentID.indexOf('calc-inputbar') >= 0) {
			// This is the calculator input bar.
			L.DomUtil.setStyle(floatingCanvas, 'margin-inline-start', left + 'px');
			L.DomUtil.setStyle(floatingCanvas, 'top', (containerTop + 20) + 'px');
		} else {
			// Add header height..
			var addition = 40;
			L.DomUtil.setStyle(floatingCanvas, 'margin-inline-start', left + 'px');
			L.DomUtil.setStyle(floatingCanvas, 'top', (top + addition) + 'px');
		}

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
					if (this._map['mouse']) {
						this._postWindowMouseEvent('buttondown', childId, firstTouchPositionX, firstTouchPositionY, 1, this._map['mouse'].LOButtons.left, 0);
						this._postWindowMouseEvent('buttonup', childId, firstTouchPositionX, firstTouchPositionY, 1, this._map['mouse'].LOButtons.left, 0);
					} else {
						this._postWindowMouseEvent('buttondown', childId, firstTouchPositionX, firstTouchPositionY, 1, 1, 0);
						this._postWindowMouseEvent('buttonup', childId, firstTouchPositionX, firstTouchPositionY, 1, 1, 0);
					}
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
			if (this._map['mouse']) {
				buttons |= e.button === this._map['mouse'].JSButtons.left ? this._map['mouse'].LOButtons.left : 0;
				buttons |= e.button === this._map['mouse'].JSButtons.middle ? this._map['mouse'].LOButtons.middle : 0;
				buttons |= e.button === this._map['mouse'].JSButtons.right ? this._map['mouse'].LOButtons.right : 0;
			} else {
				buttons = 1;
			}
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
