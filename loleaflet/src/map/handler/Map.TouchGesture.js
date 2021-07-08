/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.Map.CalcTap is used to enable mobile taps.
 */

L.Map.mergeOptions({
	touchGesture: true,
});

/* global Hammer app $ */
L.Map.TouchGesture = L.Handler.extend({
	statics: {
		MAP: 1,
		CURSOR: 2,
		GRAPHIC: 4,
		MARKER: 8,
		TABLE: 16
	},

	initialize: function (map) {
		L.Handler.prototype.initialize.call(this, map);
		this._state = L.Map.TouchGesture.MAP;

		if (!this._hammer) {
			this._hammer = new Hammer(this._map._mapPane);
			this._hammer.get('swipe').set({
				direction: Hammer.DIRECTION_ALL
			});
			this._hammer.get('pan').set({
				direction: Hammer.DIRECTION_ALL
			});
			this._hammer.get('pinch').set({
				enable: true
			});
			// avoid to trigger the context menu too early so the user can start panning in a relaxed way
			this._hammer.get('press').set({
				time: 500
			});

			this._hammer.get('swipe').set({
				threshold: 5
			});

			var singleTap = this._hammer.get('tap');
			var doubleTap = this._hammer.get('doubletap');

			// Multi-tap detection tolerates a slight change in coordinates
			// between the taps. The default of 10 is too small for our needs.
			// So we use something more sensible to make it easier for users.
			var posThreshold = 100;
			doubleTap.options.posThreshold = posThreshold;

			var tripleTap = new Hammer.Tap({event: 'tripletap', taps: 3, posThreshold: posThreshold });
			this._hammer.add(tripleTap);
			tripleTap.recognizeWith([doubleTap, singleTap]);
			var hammer = this._hammer;
			if (L.Browser.touch) {
				L.DomEvent.on(this._map._mapPane, 'touchstart touchmove touchcancel', L.DomEvent.preventDefault);
				L.DomEvent.on(this._map._mapPane, 'touchend', function(e) {
					// sometimes inputs get stuck in hammer and further events get mixed with the old ones
					// this causes to a failure to use all the gestures properly.
					// This is a workaround until it is fixed by hammer.js
					if (hammer.input) {
						if (hammer.input.store)  {
							hammer.input.store = [];
						}
					}
					L.DomEvent.preventDefault(e);
				});
			}

			if (Hammer.prefixed(window, 'PointerEvent') !== undefined) {
				L.DomEvent.on(this._map._mapPane, 'pointerdown pointermove pointerup pointercancel', L.DomEvent.preventDefault);
			}

			// IE10 has prefixed support, and case-sensitive
			if (window.MSPointerEvent && !window.PointerEvent) {
				L.DomEvent.on(this._map._mapPane, 'MSPointerDown MSPointerMove MSPointerUp MSPointerCancel', L.DomEvent.preventDefault);
			}

			L.DomEvent.on(this._map._mapPane, 'mousedown mousemove mouseup', L.DomEvent.preventDefault);
			L.DomEvent.on(document, 'touchmove', L.DomEvent.preventDefault);
		}

		for (var events in L.Draggable.MOVE) {
			L.DomEvent.on(document, L.Draggable.END[events], this._onDocUp, this);
		}

		/// $.contextMenu does not support touch events so,
		/// attach 'touchend' menu clicks event handler
		if (this._hammer.input instanceof Hammer.TouchInput) {
			var $doc = $(document);
			$doc.on('click.contextMenu', '.context-menu-item', function (e) {
				var $elem = $(this);

				if ($elem.data().contextMenu.selector === '.leaflet-layer') {
					$.contextMenu.handle.itemClick.apply(this, [e]);
				}
			});
		}
	},

	addHooks: function () {
		this._hammer.on('hammer.input', L.bind(this._onHammer, this));
		this._hammer.on('tap', L.bind(this._onTap, this));
		this._hammer.on('panstart', L.bind(this._onPanStart, this));
		this._hammer.on('pan', L.bind(this._onPan, this));
		this._hammer.on('panend', L.bind(this._onPanEnd, this));
		this._hammer.on('pinchstart', L.bind(this._onPinchStart, this));
		this._hammer.on('pinchmove', L.bind(this._onPinch, this));
		this._hammer.on('pinchend', L.bind(this._onPinchEnd, this));
		this._hammer.on('tripletap', L.bind(this._onTripleTap, this));
		this._hammer.on('swipe', L.bind(this._onSwipe, this));
		this._map.on('updatepermission', this._onPermission, this);
		this._onPermission({perm: this._map._permission});
	},

	removeHooks: function () {
		this._hammer.off('hammer.input', L.bind(this._onHammer, this));
		this._hammer.off('tap', L.bind(this._onTap, this));
		this._hammer.off('panstart', L.bind(this._onPanStart, this));
		this._hammer.off('pan', L.bind(this._onPan, this));
		this._hammer.off('panend', L.bind(this._onPanEnd, this));
		this._hammer.off('pinchstart', L.bind(this._onPinchStart, this));
		this._hammer.off('pinchmove', L.bind(this._onPinch, this));
		this._hammer.off('pinchend', L.bind(this._onPinchEnd, this));
		this._hammer.off('doubletap', L.bind(this._onDoubleTap, this));
		this._hammer.off('press', L.bind(this._onPress, this));
		this._hammer.off('tripletap', L.bind(this._onTripleTap, this));
		this._hammer.off('swipe', L.bind(this._onSwipe, this));
		this._map.off('updatepermission', this._onPermission, this);
	},

	_onPermission: function (e) {
		if (e.perm == 'edit') {
			this._hammer.on('doubletap', L.bind(this._onDoubleTap, this));
			this._hammer.on('press', L.bind(this._onPress, this));
		} else {
			this._hammer.off('doubletap', L.bind(this._onDoubleTap, this));
			this._hammer.off('press', L.bind(this._onPress, this));
		}
	},

	_onHammer: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		this._map.notifyActive();

		// Function/Formula Wizard keeps the formula cell active all the time,
		// so the usual range selection doesn't work here.
		// Instead, the cells are highlighted with a certain color and opacity
		// to mark as selection. And that's why we are checking for it here.
		// FIXME: JS-ify. This code is written by a C++ dev.
		function getFuncWizRangeBounds (obj) {
			for (var i in obj._map._layers) {
				if (obj._map._layers[i].options && obj._map._layers[i].options.fillColor
					&& obj._map._layers[i].options.fillOpacity) {
					if (obj._map._layers[i].options.fillColor === '#ef0fff'
						&& obj._map._layers[i].options.fillOpacity === 0.25) {
						return obj._map._layers[i]._bounds;
					}
				}
			}
		}

		if (e.isFirst) {
			var point = e.pointers[0],
			    containerPoint = this._map.mouseEventToContainerPoint(point),
			    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
			    latlng = this._map.layerPointToLatLng(layerPoint),
			funcWizardRangeBounds = getFuncWizRangeBounds(this);

			if (this._map._docLayer._graphicMarker) {
				this._marker = this._map._docLayer._graphicMarker.transform.getMarker(layerPoint);
			}

			if (this._marker) {
				this._state = L.Map.TouchGesture.MARKER;
			} else if (this._map._docLayer._graphicMarker && this._map._docLayer._graphicMarker.getBounds().contains(latlng)) {
				if (this._map._docLayer.hasTableSelection())
					this._state = L.Map.TouchGesture.TABLE;
				else
					this._state = L.Map.TouchGesture.GRAPHIC;
			} else if (this._map._docLayer._cellCursor && this._map._docLayer._cellCursor.contains(latlng)) {
				this._state = L.Map.TouchGesture.CURSOR;
			} else if (this._map._docLayer._cellCursor && funcWizardRangeBounds && funcWizardRangeBounds.contains(latlng)) {
				this._state = L.Map.TouchGesture.CURSOR;
			} else {
				this._state = L.Map.TouchGesture.MAP;
			}
			this._moving = false;
		}

		if (e.isLast && this._state !== L.Map.TouchGesture.MAP) {
			this._state = L.Map.TouchGesture.hitTest.MAP;
			this._marker = undefined;
			this._moving = false;
		}

		if ($(e.srcEvent.target).has(this._map._mapPane)) {
			L.DomEvent.preventDefault(e.srcEvent);
			L.DomEvent.stopPropagation(e.srcEvent);
		}
	},

	_onDocUp: function () {
		if (!this._map.touchGesture.enabled()) {
			this._map.touchGesture.enable();
		}
	},

	_onPress: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		if (this._moving) {
			return;
		}

		this._map.fire('closepopups');

		var that = this;
		var docLayer = this._map._docLayer;

		var singleClick = function () {
			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
			docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
		};

		var doubleClick = function () {
			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 2, 1, 0);
			docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 2, 1, 0);
		};

		var rightClick = function () {
			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 4, 0);
			docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 4, 0);
		};

		var waitForSelectionMsg = function () {
			// check new selection if any
			var graphicSelection = docLayer._graphicSelection;
			var cellCursor = docLayer._cellCursor;
			if (!docLayer._cursorAtMispelledWord
				&& (!graphicSelection || !graphicSelection.contains(latlng))
				&& (!cellCursor || !cellCursor.contains(latlng))) {
				// try to select text
				doubleClick();
			}
			// send right click to trigger context menus
			that._map._contextMenu._onMouseDown({originalEvent: e.srcEvent});
			rightClick();
		};

		// we want to select the long touched object before triggering the context menu;
		// for selecting text we need to simulate a double click, anyway for a graphic object
		// a single click is enough, while a double click can lead to switch to edit mode
		// (not only for an embedded ole object, even for entering text inside a shape);
		// a similar problem regards spreadsheet cell: a single click moves the cell cursor,
		// while a double click enables text input;
		// in order to avoid these cases, we send a single click and wait for a few milliseconds
		// before checking if we received a possible selection message; if no such message is received
		// we simulate a double click for trying to select text and finally, in any case,
		// we trigger the context menu by sending a right click
		var graphicSelection = docLayer._graphicSelection;
		var cellCursor = docLayer._cellCursor;
		var bContainsSel = false;
		if (cellCursor)
			bContainsSel = docLayer.containsSelection(latlng);
		var textSelection;
		if (docLayer._textSelectionStart && docLayer._textSelectionEnd)
			textSelection = new L.LatLngBounds(docLayer._textSelectionStart.getSouthWest(), docLayer._textSelectionEnd.getNorthEast());

		if ((textSelection && textSelection.inBand(latlng))
			|| (graphicSelection && graphicSelection.contains(latlng))
			|| (cellCursor && cellCursor.contains(latlng)) || bContainsSel) {
			// long touched an already selected object
			// send right click to trigger context menus
			this._map._contextMenu._onMouseDown({originalEvent: e.srcEvent});
			rightClick();
		}
		else {
			// try to select a graphic object or move the cell cursor
			singleClick();
			setTimeout(waitForSelectionMsg, 300);
		}

		this._map.notifyActive();
		e.preventDefault();
	},

	_onTap: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		// We receive each tap here, even when double- and triple-taps
		// are detected. This is undesirable as the subsequent taps
		// processed here interfere with the double- and triple-tap
		// handlers, confusing Core (and the user) as the result
		// is not what's expected (objects not getting selected,
		// edit mode not entered, or toggled, keyboard toggles, etc.).
		// We only process the first tap and subsequent ones are handled
		// by the double-tap and triple-tap handlers below.
		// Note: Hammer has requireFailure() which suppresses this call
		// when multi-taps are detected. This isn't working for us.
		if (e.tapCount > 1)
			return;

		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		// clicked a hyperlink popup - not really designed for this.
		if (this._map.hyperlinkPopup && e.target &&
			this._map.hyperlinkPopup._contentNode == e.target.parentNode) {
			// not forward mouse events to core if the user tap on a hyperlink popup box
			// for instance on Writer that causes the text cursor to be moved
			return;
		}

		this._map.fire('closemobilewizard');

		// The validity dropdown marker icon (exists only in calc) needs to be notified of tap events if it is the target.
		var dropDownMarkers = document.getElementsByClassName('leaflet-marker-icon spreadsheet-drop-down-marker');
		if (dropDownMarkers.length == 1 && dropDownMarkers[0] && e.target && e.target == dropDownMarkers[0]) {
			this._map.fire('dropdownmarkertapped');
			// don't send the mouse-event to core
			return;
		}

		this._map.fire('closepopups');
		this._map.fire('editorgotfocus');

		var docLayer = this._map._docLayer;

		// unselect if anything is selected already
		if (app.sectionContainer.doesSectionExist(L.CSections.CommentList.name)) {
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).unselect();
		}

		this._map._contextMenu._onMouseDown({originalEvent: e.srcEvent});

		var acceptInput = false; // No keyboard by default.
		var sendMouseEvents = true; // By default, this is a single-click.
		if (docLayer) {
			if (docLayer.hasGraphicSelection()) {
				// Need keyboard when cursor is visible.
				acceptInput = this._map._docLayer.isCursorVisible();
			} else if (docLayer._docType === 'text') {
				acceptInput = true; // Always show the keyboard in Writer on tap.
			} else if (docLayer._docType === 'spreadsheet') {
				// If the tap is in the current cell, start editing.
				var cellCursor = docLayer._cellCursor;
				acceptInput = (cellCursor && cellCursor.contains(latlng));
				if (acceptInput) {
					// Enter cell-edit mode on second tap of a selected cell.
					if (this._map.isPermissionEdit()) {
						docLayer.postKeyboardEvent('input', 0, 769); // F2
						sendMouseEvents = false; // Mouse events will exit editing mode.
					}

				}
			}
		}

		if (sendMouseEvents) {
			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
			docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
		}

		this._cancelAutoScroll = true;

		// Always move the focus to the document on tap,
		// but only show the keyboard when we need editing.
		this._map.focus(acceptInput);
	},

	_onDoubleTap: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		var docLayer = this._map._docLayer;
		if (docLayer) {
			if (docLayer._docType === 'spreadsheet' && !docLayer.hasGraphicSelection()) {
				// Enter cell-edit mode on double-taping a cell.
				if (this._map.isPermissionEdit()) {
					docLayer.postKeyboardEvent('input', 0, 769); // F2
				}
			} else {
				docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 2, 1, 0);
				docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 2, 1, 0);
			}

			// Show keyboard when no graphic selection, or  cursor is visible.
			var acceptInput = !docLayer.hasGraphicSelection() || docLayer.isCursorVisible();

			if (navigator.platform === 'iPhone' && docLayer._docType === 'presentation')
				acceptInput = true;

			this._map.focus(acceptInput);
		}
	},

	_onTripleTap: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 8192);
		this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 8192);
	},

	_onPanStart: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (window.IgnorePanning)
			return;

		L.Util.cancelAnimFrame(this.autoscrollAnimReq);
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		var originalCellCursor = this._map._docLayer._cellCursor;
		var increaseRatio = 0.40;
		var increasedCellCursor = null;
		if (originalCellCursor) {
			increasedCellCursor = originalCellCursor.padVertically(increaseRatio);
		}

		if (increasedCellCursor && increasedCellCursor.contains(latlng)) {
			if (!originalCellCursor.contains(latlng)) {
				var lat = latlng.lat;
				var lng = latlng.lng;

				var sw = originalCellCursor._southWest,
				ne = originalCellCursor._northEast;
				var heightBuffer = Math.abs(sw.lat - ne.lat) * increaseRatio;

				if (lat < originalCellCursor.getSouthWest().lat) {
					lat = lat + heightBuffer;
				}

				if (lat > originalCellCursor.getNorthEast().lat) {
					lat = lat - heightBuffer;
				}

				latlng = new L.LatLng(lat, lng);
				mousePos = this._map._docLayer._latLngToTwips(latlng);
			}
		}

		if (this._state === L.Map.TouchGesture.MARKER) {
			this._map._fireDOMEvent(this._marker, point, 'mousedown');
		} else if (this._state === L.Map.TouchGesture.TABLE) {
			this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
		} else if (this._state === L.Map.TouchGesture.GRAPHIC) {
			var mouseEvent = this._map._docLayer._createNewMouseEvent('mousedown', point);
			this._map._docLayer._graphicMarker._onDragStart(mouseEvent);
		} else if (this._state === L.Map.TouchGesture.CURSOR) {
			this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
		} else {
			this._map.dragging._draggable._onDown(this._constructFakeEvent(point, 'mousedown'));
		}

		// No keyboard while dragging.
		this._map.focus(false);
	},

	_onPan: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (window.IgnorePanning)
			return;

		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		if (this._state === L.Map.TouchGesture.MARKER) {
			this._map._fireDOMEvent(this._map, point, 'mousemove');
			this._moving = true;
		} else if (this._state === L.Map.TouchGesture.GRAPHIC) {
			var mouseEvent = this._map._docLayer._createNewMouseEvent('mousemove', point);
			this._map._docLayer._graphicMarker._onDrag(mouseEvent);
			this._moving = true;
		} else if (this._state === L.Map.TouchGesture.TABLE) {
			this._map._docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, 1, 0);
			this._moving = true;
		} else if (this._state === L.Map.TouchGesture.CURSOR) {
			this._map._docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, 1, 0);
		} else if (this._map.scrollingIsHandled === false) {
			this._map.dragging._draggable._onMove(this._constructFakeEvent(point, 'mousemove'));
		}
	},

	_onPanEnd: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (window.IgnorePanning)
			return;

		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		if (this._state === L.Map.TouchGesture.MARKER) {
			this._map._fireDOMEvent(this._map, point, 'mouseup');
			this._moving = false;
		} else if (this._state === L.Map.TouchGesture.GRAPHIC) {
			var mouseEvent = this._map._docLayer._createNewMouseEvent('mouseup', point);
			this._map._docLayer._graphicMarker._onDragEnd(mouseEvent);
			this._moving = false;
		} else if (this._state === L.Map.TouchGesture.TABLE) {
			this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
			this._moving = false;
		} else if (this._state === L.Map.TouchGesture.CURSOR) {
			this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
		} else {
			this._map.dragging._draggable._onUp(this._constructFakeEvent(point, 'mouseup'));
		}

		// No keyboard after dragging.
		this._map.focus(false);
	},

	_onPinchStart: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (this._inSwipeAction) {
			this._cancelAutoscrollRAF();
			return;
		}

		if (isNaN(e.center.x) || isNaN(e.center.y))
			return;

		this._pinchStartCenter = {x: e.center.x, y: e.center.y};
		this._map._docLayer.preZoomAnimation();
	},

	_onPinch: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (!this._pinchStartCenter || isNaN(e.center.x) || isNaN(e.center.y))
			return;

		// we need to invert the offset or the map is moved in the opposite direction
		var offset = {x: e.center.x - this._pinchStartCenter.x, y: e.center.y - this._pinchStartCenter.y};
		var center = {x: this._pinchStartCenter.x - offset.x, y: this._pinchStartCenter.y - offset.y};
		this._zoom = this._map._limitZoom(this._map.getScaleZoom(e.scale));
		this._center = this._map._limitCenter(this._map.mouseEventToLatLng({clientX: center.x, clientY: center.y}),
						      this._zoom, this._map.options.maxBounds);

		this._origCenter = this._map._limitCenter(this._map.mouseEventToLatLng({clientX: center.x, clientY: center.y}),
							  this._map.getZoom(), this._map.options.maxBounds);

		if (this._map._docLayer.zoomStep) {
			this._map._docLayer.zoomStep(this._zoom, this._origCenter);
		}
	},

	_onPinchEnd: function () {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (!this._pinchStartCenter)
			return;

		var oldZoom = this._map.getZoom();
		var zoomDelta = this._zoom - oldZoom;
		var finalZoom = this._map._limitZoom(zoomDelta > 0 ? Math.ceil(this._zoom) : Math.floor(this._zoom));

		this._pinchStartCenter = undefined;

		if (this._map._docLayer.zoomStepEnd) {
			var thisObj = this;
			this._map._docLayer.zoomStepEnd(finalZoom, this._origCenter,
			// mapUpdater
			function (newMapCenter) {
				thisObj._map.setView(newMapCenter || thisObj._center, finalZoom);
			},
			// showMarkers
			function () {
				thisObj._map._docLayer.postZoomAnimation();
			});
		}
	},

	_constructFakeEvent: function (evt, type) {
		var fakeEvt = {
			type: type,
			canBubble: false,
			cancelable: true,
			screenX: evt.screenX,
			screenY: evt.screenY,
			clientX: evt.clientX,
			clientY: evt.clientY,
			ctrlKey: false,
			altKey: false,
			shiftKey: false,
			metaKey: false,
			button: 0,
			target: evt.target,
			preventDefault: function () {}
		};

		return fakeEvt;
	},

	// Code and maths for the ergonomic scrolling is inspired formul
	// https://ariya.io/2013/11/javascript-kinetic-scrolling-part-2
	// Some constants are changed based on the testing/experimenting/trial-error

	_onSwipe: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		this._velocity = new L.Point(e.velocityX, e.velocityY);
		this._amplitude = this._velocity.multiplyBy(32);
		this._newPos = L.DomUtil.getPosition(this._map._mapPane);
		var evt = this._constructFakeEvent({
			clientX: e.center.x,
			clientY: e.center.y,
			target: this._map._mapPane
		},'mousedown');
		this._startSwipePoint = new L.Point(evt.clientX, evt.clientY);
		this._map.dragging._draggable._onDown(evt);
		this._timeStamp = Date.now();
		this._inSwipeAction = true;
		this.autoscrollAnimReq = L.Util.requestAnimFrame(this._autoscroll, this, true);
	},

	_cancelAutoscrollRAF: function () {
		this._cancelAutoScroll = false;
		this._inSwipeAction = false;
		L.Util.cancelAnimFrame(this.autoscrollAnimReq);
		return;
	},

	_autoscroll: function() {
		if (this._cancelAutoScroll === true) {
			this._cancelAutoscrollRAF();
			return;
		}

		var elapsed, delta;

		elapsed = Date.now() - this._timeStamp;
		delta = this._amplitude.multiplyBy(Math.exp(-elapsed / 650));
		var e = this._constructFakeEvent({
			clientX: delta.x + this._startSwipePoint.x,
			clientY: delta.y + this._startSwipePoint.y,
			target: this._map._mapPane,
		}, 'mousemove');
		e.autoscroll = true;
		if (delta.x > 0.2 || delta.x < -0.2 || delta.y > 0.2 || delta.y < -0.2) {
			var org = this._map.getPixelOrigin();
			var docSize = this._map.getLayerMaxBounds().getSize().subtract(this._map.getSize());
			var horizontalEnd, verticalEnd;

			if (this._map.getDocSize().x < this._map.getSize().x) {
				//don't scroll horizontally if document fits the view
				delta.x = 0;
				horizontalEnd = true;
			} else {
				horizontalEnd = Math.max(Math.min(org.x, this._newPos.x), org.x - Math.max(docSize.x, 0)) !== this._newPos.x;
			}

			if (this._map.getDocSize().y < this._map.getSize().y) {
				//don't scroll vertically if document fits the view
				delta.y = 0;
				verticalEnd = true;
			} else {
				verticalEnd = Math.max(Math.min(org.y, this._newPos.y), org.y - Math.max(docSize.y, 0)) !== this._newPos.y;
			}

			this._map.dragging._draggable._startPoint = this._startSwipePoint;
			this._map.dragging._draggable._startPos = this._newPos;
			this._newPos._add(delta);

			this._map.dragging._draggable._onMove(e);

			// Prefetch border tiles for the current visible area after cancelling any scheduled calls to the prefetcher.
			this._map._docLayer._clearPreFetch();
			this._map._docLayer._preFetchTiles(true /* forceBorderCalc */);

			if (!horizontalEnd || !verticalEnd) {
				this.autoscrollAnimReq = L.Util.requestAnimFrame(this._autoscroll, this, true);
			} else {
				this._inSwipeAction = false;
			}
		}
		else {
			this._map.dragging._draggable._onUp(e);
			this._inSwipeAction = false;
		}
	}
});
