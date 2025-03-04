/* -*- js-indent-level: 8; fill-column: 100 -*- */
/* global app */
/*
 * L.Map.CalcTap is used to enable mobile taps.
 */

L.Map.mergeOptions({
	touchGesture: true,
});

/* global Hammer app $ GraphicSelection TileManager */
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
			L.DomEvent.on(this._map._mapPane, 'touchstart touchmove touchcancel', window.touch.touchOnly(L.DomEvent.preventDefault));
			L.DomEvent.on(this._map._mapPane, 'touchend', window.touch.touchOnly(function(e) {
				// sometimes inputs get stuck in hammer and further events get mixed with the old ones
				// this causes to a failure to use all the gestures properly.
				// This is a workaround until it is fixed by hammer.js
				if (hammer.input) {
					if (hammer.input.store)  {
						hammer.input.store = [];
					}
				}
				L.DomEvent.preventDefault(e);
			}));

			if (Hammer.prefixed(window, 'PointerEvent') !== undefined) {
				L.DomEvent.on(this._map._mapPane, 'pointerdown pointermove pointerup pointercancel', window.touch.touchOnly(L.DomEvent.preventDefault));
			}

			// IE10 has prefixed support, and case-sensitive
			if (window.MSPointerEvent && !window.PointerEvent) {
				L.DomEvent.on(this._map._mapPane, 'MSPointerDown MSPointerMove MSPointerUp MSPointerCancel', window.touch.touchOnly(L.DomEvent.preventDefault));
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
		this._hammer.on('hammer.input', window.memo.bind(window.touch.touchOnly(this._onHammer), this));
		this._hammer.on('tap', window.memo.bind(window.touch.touchOnly(this._onTap), this));
		this._hammer.on('panstart', window.memo.bind(window.touch.touchOnly(this._onPanStart), this));
		this._hammer.on('pan', window.memo.bind(window.touch.touchOnly(this._onPan), this));
		this._hammer.on('panend', window.memo.bind(window.touch.touchOnly(this._onPanEnd), this));
		this._hammer.on('pinchstart', window.memo.bind(window.touch.touchOnly(this._onPinchStart), this));
		this._hammer.on('pinchmove', window.memo.bind(window.touch.touchOnly(this._onPinch), this));
		this._hammer.on('pinchend', window.memo.bind(window.touch.touchOnly(this._onPinchEnd), this));
		this._hammer.on('tripletap', window.memo.bind(window.touch.touchOnly(this._onTripleTap), this));
		this._hammer.on('swipe', window.memo.bind(window.touch.touchOnly(this._onSwipe), this));
		app.events.on('updatepermission', this._onPermission.bind(this));
		this._onPermission({ detail: { perm: this._map._permission } });
	},

	removeHooks: function () {
		this._hammer.off('hammer.input', window.memo.bind(window.touch.touchOnly(this._onHammer), this));
		this._hammer.off('tap', window.memo.bind(window.touch.touchOnly(this._onTap), this));
		this._hammer.off('panstart', window.memo.bind(window.touch.touchOnly(this._onPanStart), this));
		this._hammer.off('pan', window.memo.bind(window.touch.touchOnly(this._onPan), this));
		this._hammer.off('panend', window.memo.bind(window.touch.touchOnly(this._onPanEnd), this));
		this._hammer.off('pinchstart', window.memo.bind(window.touch.touchOnly(this._onPinchStart), this));
		this._hammer.off('pinchmove', window.memo.bind(window.touch.touchOnly(this._onPinch), this));
		this._hammer.off('pinchend', window.memo.bind(window.touch.touchOnly(this._onPinchEnd), this));
		this._hammer.off('doubletap', window.memo.bind(window.touch.touchOnly(this._onDoubleTap), this));
		this._hammer.off('press', window.memo.bind(window.touch.touchOnly(this._onPress), this));
		this._hammer.off('tripletap', window.memo.bind(window.touch.touchOnly(this._onTripleTap), this));
		this._hammer.off('swipe', window.memo.bind(window.touch.touchOnly(this._onSwipe), this));
	},

	_onPermission: function (e) {
		if (e.detail.perm == 'edit') {
			this._hammer.on('doubletap', window.memo.bind(window.touch.touchOnly(this._onDoubleTap), this));
			this._hammer.on('press', window.memo.bind(window.touch.touchOnly(this._onPress), this));
		} else {
			this._hammer.off('doubletap', window.memo.bind(window.touch.touchOnly(this._onDoubleTap), this));
			this._hammer.off('press', window.memo.bind(window.touch.touchOnly(this._onPress), this));
		}
	},

	_onHammer: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		app.idleHandler.notifyActive();

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

			let twipsPoint = this._map._docLayer._latLngToTwips(latlng);
			twipsPoint = new app.definitions.simplePoint(twipsPoint.x, twipsPoint.y);

			if (app.calc.cellCursorVisible && app.calc.cellCursorRectangle.containsPoint(twipsPoint.toArray())) {
				this._state = L.Map.TouchGesture.CURSOR;
			} else if (app.calc.cellCursorVisible && funcWizardRangeBounds && funcWizardRangeBounds.contains(latlng)) {
				this._state = L.Map.TouchGesture.CURSOR;
			} else {
				this._state = L.Map.TouchGesture.MAP;
			}
			this._moving = false;
		}

		if (e.isLast && this._state !== L.Map.TouchGesture.MAP) {
			this._state = L.Map.TouchGesture.hitTest.MAP;
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

		window.IgnorePanning = undefined;
	},

	_onPress: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		let posInTwips = new app.definitions.simplePoint(mousePos.x, mousePos.y);

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
			// We will only send "buttondown" event because core side fires "buttonup" event internally.
			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 4, 0);
		};

		var waitForSelectionMsg = function () {
			// check new selection if any
			var graphicSelection = GraphicSelection.rectangle;
			if (!docLayer._cursorAtMispelledWord
				&& (!graphicSelection || !graphicSelection.containsPoint(posInTwips.toArray()))
				&& (!app.calc.cellCursorVisible || !app.calc.cellCursorRectangle.containsPoint(posInTwips.toArray()))) {
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
		var graphicSelection = GraphicSelection.rectangle;
		var bContainsSel = false;
		if (app.calc.cellCursorVisible)
			bContainsSel = docLayer.containsSelection(latlng);
		var textSelection;
		if (docLayer._selectionHandles.start.rectangle && docLayer._selectionHandles.end.rectangle) {
			// Oversimplication. See "inBand" function.
			textSelection = new app.definitions.simpleRectangle(0, docLayer._selectionHandles.end.rectangle.y1, app.file.size.x, 0);
			textSelection.height = docLayer._selectionHandles.end.rectangle.y2 - docLayer._selectionHandles.start.rectangle.y1;
		}

		if ((textSelection && textSelection.containsPoint(posInTwips.toArray()))
			|| (graphicSelection && graphicSelection.containsPoint(posInTwips.toArray()))
			|| (app.calc.cellCursorVisible && app.calc.cellCursorRectangle.containsPoint(posInTwips.toArray())) || bContainsSel) {
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

		app.idleHandler.notifyActive();
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

		let posInTwips = new app.definitions.simplePoint(mousePos.x, mousePos.y);

		this._map.fire('closemobilewizard');

		// The validity and content control dropdown marker icon (exists in calc and writer) needs to be notified of tap events if it is the target.
		var dropDownMarkers;
		if (this._map._docLayer.isWriter()) {
			dropDownMarkers = document.getElementsByClassName('html-object-section writer-drop-down-marker');
		} else if (this._map._docLayer.isCalc()) {
			dropDownMarkers = document.getElementsByClassName('leaflet-marker-icon spreadsheet-drop-down-marker');
		}
		if (dropDownMarkers && dropDownMarkers.length == 1 && dropDownMarkers[0] && e.target) {
			if (e.target == dropDownMarkers[0])
				return; // don't send the mouse-event to core
			else {
				let section = app.sectionContainer.getSectionWithName(L.CSections.ContentControl.name);

				if (section) {
					section = section.sectionProperties.dropdownSection;
					if (section && section.containsPoint(posInTwips.pToArray())) {
						section.onClick();
						return; // don't send the mouse-event to core
					}
				}
			}
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
			if (GraphicSelection.hasActiveSelection()) {
				// Need keyboard when cursor is visible.
				acceptInput = app.file.textCursor.visible;
			} else if (docLayer._docType === 'text') {
				acceptInput = true; // Always show the keyboard in Writer on tap.
			} else if (docLayer._docType === 'spreadsheet') {
				// If the tap is in the current cell, start editing.
				acceptInput = (app.calc.cellCursorVisible && app.calc.cellCursorRectangle.containsPoint(posInTwips.toArray()));
				if (acceptInput) {
					// Enter cell-edit mode on second tap of a selected cell.
					if (this._map.isEditMode()) {
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
			if (docLayer._docType === 'spreadsheet' && !GraphicSelection.hasActiveSelection()) {
				// Enter cell-edit mode on double-taping a cell.
				if (this._map.isEditMode()) {
					docLayer.postKeyboardEvent('input', 0, 769); // F2
				}
			} else {
				docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 2, 1, 0);
				docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 2, 1, 0);
			}

			// Show keyboard when no graphic selection, or  cursor is visible.
			var acceptInput = !GraphicSelection.hasActiveSelection() || app.file.textCursor.visible;

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

		app.util.cancelAnimFrame(this.autoscrollAnimReq);
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		let posInTwips = new app.definitions.simplePoint(mousePos.x, mousePos.y);

		let increaseRatio = 0.40;
		let increasedCellCursor = null;
		if (app.calc.cellCursorVisible) {
			increasedCellCursor = app.calc.cellCursorRectangle.clone();
			increasedCellCursor.y1 -= increasedCellCursor.height * increaseRatio;
			increasedCellCursor.y2 += increasedCellCursor.height * increaseRatio;
		}

		if (increasedCellCursor && increasedCellCursor.containsPoint(posInTwips.toArray())) {
			if (!app.calc.cellCursorRectangle.containsPoint(posInTwips.toArray())) {
				let y = posInTwips.y;
				let x = posInTwips.x;

				let heightBuffer = Math.abs(app.calc.cellCursorRectangle.pHeight) * increaseRatio;

				if (y < app.calc.cellCursorRectangle.y2) {
					y = y + heightBuffer;
				}

				if (y > app.calc.cellCursorRectangle.y1) {
					y = y - heightBuffer;
				}

				mousePos = new L.Point(x, y);
			}
		}

		if (this._state === L.Map.TouchGesture.CURSOR) {
			this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
		} else {
			this._map.dragging._draggable._onDown(this._constructFakeEvent(point, 'mousedown'));
		}

		// Keep the same keyboard state
		var acceptInput = this._map.canAcceptKeyboardInput();
		this._map.focus(acceptInput);
	},

	_onPan: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (window.IgnorePanning)
			return;

		if (this._inSwipeAction &&  Math.abs(e.velocity) < this._hammer.get('swipe').options.velocity) {
			this._cancelAutoscrollRAF();
		}

		var point = e.pointers[0],
			containerPoint = this._map.mouseEventToContainerPoint(point),
			layerPoint = this._map.containerPointToLayerPoint(containerPoint),
			latlng = this._map.layerPointToLatLng(layerPoint),
			mousePos = this._map._docLayer._latLngToTwips(latlng);
		if (this._state === L.Map.TouchGesture.CURSOR) {
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

		if (this._state === L.Map.TouchGesture.CURSOR) {
			this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
		} else {
			this._map.dragging._draggable._onUp(this._constructFakeEvent(point, 'mouseup'));
		}

		// Keep the same keyboard state
		var acceptInput = this._map.canAcceptKeyboardInput();
		this._map.focus(acceptInput);
	},

	_onPinchStart: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (this._inSwipeAction) {
			this._cancelAutoscrollRAF();
		}

		if (isNaN(e.center.x) || isNaN(e.center.y))
			return;

		this._pinchStartCenter = { x: e.center.x, y: e.center.y };
		const _pinchStartLatLng = this._map.mouseEventToLatLng({ clientX: e.center.x, clientY: e.center.y });
		this._map._docLayer.preZoomAnimation(_pinchStartLatLng);
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
		this._origCenter = this._map.mouseEventToLatLng({clientX: center.x, clientY: center.y});


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
				function (newMapCenter) { // mapUpdater
					thisObj._map.setView(newMapCenter, finalZoom);
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

	// Code and maths for the ergonomic scrolling is inspired by formulas at
	// https://ariya.io/2013/11/javascript-kinetic-scrolling-part-2
	// Some constants are changed based on the testing/experimenting/trial-error

	_onSwipe: function (e) {
		if (this._map.uiManager.isUIBlocked())
			return;

		if (window.IgnorePanning)
			return;

		let velocityX = this._map._docLayer.isCalcRTL() ? -e.velocityX : e.velocityX;
		let pointVelocity = new L.Point(velocityX, e.velocityY);
		if (this._inSwipeAction) {
			this._velocity = this._velocity.add(pointVelocity);
		}
		else {
			this._velocity = pointVelocity;
		}
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
		this.autoscrollAnimReq = app.util.requestAnimFrame(this._autoscroll, this, true);
	},

	_cancelAutoscrollRAF: function () {
		this._cancelAutoScroll = false;
		this._inSwipeAction = false;
		if (app.file.fileBasedView)
			this._map._docLayer._checkSelectedPart();
		app.util.cancelAnimFrame(this.autoscrollAnimReq);
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
			TileManager.clearPreFetch();
			TileManager.preFetchTiles(true /* forceBorderCalc */);

			if (!horizontalEnd || !verticalEnd) {
				this.autoscrollAnimReq = app.util.requestAnimFrame(this._autoscroll, this, true);
			} else {
				this._inSwipeAction = false;
				if (app.file.fileBasedView)
					this._map._docLayer._checkSelectedPart();
			}
		}
		else {
			this._map.dragging._draggable._onUp(e);
			this._inSwipeAction = false;
			if (app.file.fileBasedView)
				this._map._docLayer._checkSelectedPart();
		}
	}
});
